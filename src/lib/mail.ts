import nodemailer, { type Transporter } from "nodemailer";
import QRCode from "qrcode";
import { EVENT, SITE } from "./constants";
import { isRegistration, type Submission } from "./validation";
import { findByEmail } from "./supabase";
import { checkinUrl } from "./checkin-url";
import type { MauEmail } from "./mau-email";
import type { DinhKem } from "./dinh-kem";

/**
 * Máy chủ mặc định. Đọc từ env để đổi được mà không phải sửa code, nhưng CÓ giá
 * trị mặc định vì bộ biến môi trường đã chốt chỉ gồm bốn key SMTP_PORT /
 * SMTP_USER / SMTP_PASS / SMTP_FROM — không có SMTP_HOST.
 */
const SMTP_HOST_MAC_DINH = "zmhn112404.onemail.vn";

/**
 * Số kết nối SMTP mở song song khi gửi hàng loạt.
 *
 * ĐÂY LÀ CON SỐ QUAN TRỌNG NHẤT của việc bỏ Brevo. Brevo nhận cả 500 mẹ trong
 * MỘT lượt gọi HTTP; SMTP thì mỗi mẹ một lượt gửi riêng. Gửi tuần tự 500 lượt
 * không sống nổi trong giới hạn thời gian một hàm Vercel — đúng lý do
 * `guiHangLoat` từng được viết bằng REST API (spec 2026-08-05 §1).
 *
 * Pool nhiều kết nối là cách duy nhất để 500 mẹ vừa khít: 5 kết nối × ~200ms
 * mỗi thư ≈ 20 giây cho 500 thư, nằm trong `maxDuration = 60`.
 *
 * ĐỪNG NÂNG BỪA. Nhà cung cấp SMTP chia sẻ thường chặn khi thấy quá nhiều kết
 * nối đồng thời, và bị chặn giữa lượt gửi cho 500 mẹ là kiểu hỏng tệ nhất.
 */
const SO_KET_NOI = 5;

// Pool dùng lại giữa các lượt gọi ấm thay vì mở kết nối mới mỗi lần.
let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error("SMTP_USER / SMTP_PASS chưa được cấu hình");
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? SMTP_HOST_MAC_DINH,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // STARTTLS thương lượng trên cổng 587; TLS vẫn được áp dụng
    auth: { user, pass },
    // Pool phục vụ đường gửi hàng loạt. Mail đơn cũng đi qua đây và hưởng lợi:
    // lượt gửi thứ hai trong cùng một hàm ấm không phải bắt tay TLS lại.
    pool: true,
    maxConnections: SO_KET_NOI,
    maxMessages: Infinity,
  });
  return transporter;
}

/** Địa chỉ người gửi. Tách ra vì cả mail đơn lẫn hàng loạt đều cần, và đều phải fail sớm. */
function nguoiGui(): { name: string; address: string } {
  const address = process.env.SMTP_FROM;
  if (!address) throw new Error("SMTP_FROM chưa được cấu hình");
  return { name: process.env.SMTP_SENDER_NAME ?? SITE.name, address };
}

/**
 * Mã check-in đã cấp cho email này ở lần đăng ký sự kiện trước (nếu có), để lần
 * sau DÙNG LẠI thay vì sinh mã mới — giữ mã của một email cố định thì QR/email
 * cũ không bao giờ hết hiệu lực. Không có nó, upsert theo email cấp mã MỚI và
 * mọi QR đã gửi trước đó báo "không tìm thấy mã".
 *
 * NGUỒN SỰ THẬT ĐÃ ĐỔI: trước đây tra ở Brevo (attribute MA_CHECKIN). Brevo đã
 * bị gỡ khỏi dự án, nên giờ tra ở Supabase — bảng `registrations` là nơi duy
 * nhất còn giữ dữ liệu này.
 *
 * ĐÁNH ĐỔI PHẢI BIẾT: Brevo nằm trong luồng đăng ký với tư cách bắt buộc (ghi
 * hỏng là từ chối cả lượt đăng ký), còn ghi Supabase trước đây là non-fatal —
 * nuốt lỗi và vẫn báo thành công. Nghĩa là có thể tồn tại mẹ đã đăng ký mà
 * KHÔNG có dòng nào trong `registrations`; với những mẹ đó hàm này trả null và
 * họ sẽ được cấp mã mới. Vì vậy ghi Supabase ở `/api/dang-ky` PHẢI được nâng
 * thành fatal cùng lượt thay đổi này — xem route đó.
 *
 * Trả null khi email chưa từng đăng ký sự kiện → nơi gọi sinh mã mới.
 */
export async function existingCheckinCode(email: string): Promise<string | null> {
  const row = await findByEmail(email);
  const code = row?.checkin_code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

/**
 * Năm khai báo dưới đây được export để `mail-hang-loat.ts` dựng email gửi hàng
 * loạt bằng ĐÚNG khung này. Dựng khung thứ hai ở file khác là mầm mống hai email
 * cùng thương hiệu mà trông khác nhau, và không ai phát hiện cho tới khi mẹ hỏi.
 */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

/**
 * `kyTen` có BA trạng thái, đừng gộp lại thành hai:
 *
 *  - **bỏ trống** (`undefined`) → ký "Đội ngũ Mama Ơi". Mail xác nhận và mail
 *    waitlist đang chạy production đi đường này, không đổi một ký tự nào.
 *  - **một chuỗi** → ký đúng chuỗi đó. Hai mẫu gửi lại (BTC soạn) có chữ ký
 *    riêng "Trân trọng & Cảm ơn, Mama Ơi Team"; ghim cứng mặc định thì email sẽ
 *    ký tên hai lần liên tiếp.
 *  - **`null`** → KHÔNG vẽ đoạn chữ ký nào cả. Email gửi hàng loạt đi đường
 *    này: nội dung do admin gõ tay nên lời kết là việc của họ, và một chữ ký
 *    đóng cứng bên dưới sẽ đá nhau với lời kết họ vừa viết.
 *
 * `null` phải là một giá trị riêng chứ không dùng chuỗi rỗng: `"" ?? x` trả về
 * `""` (`??` chỉ bắt null/undefined), nên chuỗi rỗng vẫn vẽ ra một thẻ `<p>`
 * trống mang nguyên 24px margin — khoảng hở thừa dưới đáy thư mà không ai hiểu
 * từ đâu ra.
 */
export function shell(
  inner: string,
  footnote: string,
  kyTen?: string | null,
): string {
  const doanKyTen =
    kyTen === null
      ? ""
      : `<p style="margin:24px 0 0;font-size:14px;line-height:20px;color:#737373;">
      ${kyTen ?? `Đội ngũ ${SITE.name}`}
    </p>`;

  // Styles are inlined because email clients strip <style> blocks.
  return `
<div style="margin:0;padding:24px;background:#fdf8f4;font-family:'Nunito',Arial,sans-serif;color:#292929;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;">
    ${inner}
    ${doanKyTen}
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:18px;color:#a3a3a3;text-align:center;">
    ${footnote}
  </p>
</div>`;
}

/**
 * Gửi MỘT email cho MỘT người, qua REST API.
 *
 * Trường `to` cố tình chỉ mang đúng một địa chỉ: mọi email đi qua đây đều là
 * thư cá nhân (kèm mã check-in riêng của mẹ đó), nên nhét thêm địa chỉ vào đây
 * là đưa vé vào cửa của mẹ này cho mẹ khác. Muốn gửi cho nhiều người thì dùng
 * `guiHangLoat` — nó có `messageVersions`, mỗi người một bản riêng.
 *
 * `attachment` mang base64 THUẦN (đã bỏ tiền tố data-URL); `kemNodemailer` đổi
 * sang hình dạng nodemailer cần. Kiểu file suy ra từ đuôi trong `name`.
 */
/** `DinhKem` → dạng nodemailer cần. `content` là base64 THUẦN, đã bỏ tiền tố data-URL. */
function kemNodemailer(ds: DinhKem[]) {
  return ds.map((a) => ({
    filename: a.name,
    content: a.content,
    encoding: "base64" as const,
  }));
}

/**
 * Gửi MỘT email cho MỘT người.
 *
 * `to` cố tình chỉ mang đúng một địa chỉ: mọi email đi qua đây đều là thư cá
 * nhân (kèm mã check-in riêng của mẹ đó), nên nhét thêm địa chỉ vào đây là đưa
 * vé vào cửa của mẹ này cho mẹ khác.
 *
 * Ném lỗi khi gửi hỏng, KHÔNG BAO GIỜ báo thành công giả: nơi gọi (luồng đăng
 * ký) nuốt lỗi này thành cảnh báo non-fatal, nên nếu ta im lặng ở đây thì mẹ
 * đăng ký xong, thấy màn hình thành công, mà email kèm QR không bao giờ tới —
 * và không còn dấu vết nào cả.
 */
async function send(
  to: { email: string; name?: string },
  subject: string,
  html: string,
  attachment?: DinhKem[],
): Promise<void> {
  const from = nguoiGui();

  const ket = await getTransport().sendMail({
    from,
    to: to.name ? { name: to.name, address: to.email } : to.email,
    subject,
    html,
    ...(attachment && attachment.length > 0
      ? { attachments: kemNodemailer(attachment) }
      : {}),
  });

  // `sendMail` không ném khi máy chủ nhận thư nhưng TỪ CHỐI người nhận — địa
  // chỉ đó nằm ở `rejected`. Không kiểm là báo thành công cho một thư chắc chắn
  // không tới.
  if (ket.rejected?.length) {
    throw new Error(
      `Máy chủ SMTP từ chối người nhận: ${ket.rejected.join(", ")}`,
    );
  }
}

/**
 * QR đính kèm, KHÔNG hot-link: phần lớn email client chặn ảnh từ xa theo mặc
 * định, mà một mã QR mẹ không nhìn thấy được ở cửa còn tệ hơn là không có. Mã
 * vẫn được in ra dạng chữ để tình nguyện viên gõ tay khi máy quét chịu thua.
 *
 * QR trỏ thẳng tới trang check-in (quét bằng camera là mở trang), không phải mã trơn.
 */
async function qrDinhKem(code: string): Promise<{ content: string; name: string }[]> {
  const qrDataUrl = await QRCode.toDataURL(checkinUrl(code), {
    width: 480,
    margin: 2,
    color: { dark: "#292929", light: "#ffffff" },
  });
  return [{ content: qrDataUrl.split(",")[1], name: `checkin-${code}.png` }];
}

/**
 * Ô mã dạng chữ. Tách khỏi nút bên dưới chứ không gộp một khối: mẫu `xacNhan`
 * xen một câu GIỮA ô mã và nút, và mail đó đang chạy production — gộp lại là
 * âm thầm đổi bố cục email mà mẹ đã nhận hàng trăm bản.
 */
function khoiMa(code: string, nhan: string): string {
  return `
    <div style="background:#fce9e8;border-radius:16px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:14px;color:#737373;">${nhan}</p>
      <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:2px;color:#f08f8c;">${code}</p>
    </div>`;
}

function nutCheckin(code: string): string {
  return `
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${checkinUrl(code)}" style="display:inline-block;background:#f08f8c;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:9999px;">
        Mở trang check-in
      </a>
    </p>`;
}

export const P = 'style="margin:0 0 16px;font-size:16px;line-height:24px;"';
/** Chữ ký BTC soạn cho hai mẫu gửi lại. `&` phải escape để HTML hợp lệ. */
export const KY_TEN_BTC = "Trân trọng &amp; Cảm ơn,<br>Mama Ơi Team";
export const FOOTNOTE_BTC = `Bạn nhận được email này vì đã đăng ký tham dự ${EVENT.shortName}.`;

/**
 * Nội dung ba mẫu email. Tách khỏi việc GỬI để `/admin/gui-mail` xem trước được
 * đúng thứ sắp gửi đi — xem trước dựng lại HTML ở nơi khác là mầm mống bản xem
 * trước và bản gửi thật nói hai đằng.
 *
 * Câu chữ hai mẫu `capLai` / `suCo` là nguyên văn BTC soạn, đừng sửa.
 */
export function noiDungEmail(
  mau: MauEmail,
  hoTen: string,
  code: string,
): { subject: string; html: string } {
  const ten = escapeHtml(hoTen);

  if (mau === "capLai") {
    return {
      subject: "[Mama Ơi] Cấp lại mã QR check-in sự kiện",
      html: shell(
        `
    <h1 style="margin:0 0 16px;font-size:24px;">Cấp lại mã QR check-in</h1>
    <p ${P}>Xin chào ${ten},</p>
    <p ${P}>Chúng mình là Mama Ơi Team.</p>
    <p ${P}>Hệ thống ghi nhận mã QR check-in trước đó của bạn đã được sử dụng. Để đảm bảo bạn vẫn check-in được vào ngày sự kiện, team gửi lại mã QR mới đính kèm email này.</p>
    ${khoiMa(code, "Mã check-in của bạn")}
    ${nutCheckin(code)}
    <p style="margin:0 0 8px;font-size:16px;line-height:24px;font-weight:700;">Lưu ý quan trọng:</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:24px;">
      <li style="margin-bottom:6px;">Đây là mã QR duy nhất có hiệu lực, vui lòng lưu lại cẩn thận (chụp màn hình hoặc lưu email).</li>
      <li style="margin-bottom:6px;">Không chia sẻ mã QR cho người khác dưới bất kỳ hình thức nào.</li>
      <li>BTC sẽ không giải quyết các trường hợp mã QR đã bị sử dụng khi đến check-in tại sự kiện.</li>
    </ul>
    <p style="margin:0;font-size:16px;line-height:24px;">Nếu có bất kỳ thắc mắc nào, bạn vui lòng phản hồi trực tiếp email này nhé.</p>`,
        FOOTNOTE_BTC,
        KY_TEN_BTC,
      ),
    };
  }

  if (mau === "suCo") {
    return {
      subject: "[Mama Ơi] Xin lỗi vì sự cố kỹ thuật – Gửi mã QR check-in",
      html: shell(
        // Giữ đúng "Chào bạn," (không chèn tên) như BTC soạn — tên mẹ vẫn nằm ở
        // dòng người nhận của email.
        `
    <h1 style="margin:0 0 16px;font-size:24px;">Gửi mã QR check-in của bạn</h1>
    <p ${P}>Chào bạn,</p>
    <p ${P}>Chúng mình là Mama Ơi Team.</p>
    <p ${P}>Team xin lỗi vì sự cố kỹ thuật khiến thông tin đăng ký của bạn chưa được ghi nhận đầy đủ trong hệ thống. Rất mong bạn thông cảm cho sự bất tiện này.</p>
    <p ${P}>Team gửi kèm mã QR check-in của bạn trong email này. Vui lòng lưu lại cẩn thận (chụp màn hình hoặc lưu email) để sử dụng khi đến sự kiện.</p>
    ${khoiMa(code, "Mã check-in của bạn")}
    ${nutCheckin(code)}
    <p ${P}>Lưu ý: BTC sẽ không giải quyết các trường hợp mã QR đã bị sử dụng khi đến check-in tại sự kiện, vì vậy bạn vui lòng không chia sẻ mã QR cho người khác.</p>
    <p style="margin:0;font-size:16px;line-height:24px;">Nếu có bất kỳ thắc mắc nào, bạn vui lòng phản hồi trực tiếp email này nhé.</p>`,
        FOOTNOTE_BTC,
        KY_TEN_BTC,
      ),
    };
  }

  return {
    subject: `Xác nhận đăng ký ${EVENT.shortName} — mã ${code}`,
    html: shell(
      `
    <h1 style="margin:0 0 8px;font-size:24px;">Cảm ơn mẹ đã đăng ký!</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#737373;">
      Chào ${ten}, mẹ đã có một chỗ tại <strong>${EVENT.shortName}</strong>.
    </p>
    ${khoiMa(code, "Mã check-in của mẹ")}
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;">
      Mẹ vui lòng đưa mã QR đính kèm email này tại quầy check-in.
    </p>
    ${nutCheckin(code)}
    <table style="width:100%;font-size:15px;line-height:24px;">
      <tr><td style="padding:6px 0;color:#737373;">Thời gian</td><td style="padding:6px 0;font-weight:600;">${EVENT.dateLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#737373;">Địa điểm</td><td style="padding:6px 0;font-weight:600;">${EVENT.venue}</td></tr>
      <tr><td style="padding:6px 0;color:#737373;">Địa chỉ</td><td style="padding:6px 0;">${EVENT.address}</td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:16px;line-height:24px;">Hẹn gặp mẹ và bé tại sự kiện!</p>`,
      `Mẹ nhận được email này vì đã đăng ký tham dự ${EVENT.shortName}.`,
    ),
  };
}

/** Gửi một mẫu bất kỳ kèm QR. Dùng bởi cả luồng đăng ký lẫn /admin/gui-mail. */
export async function guiEmailTheoMau(
  mau: MauEmail,
  nguoiNhan: { email: string; hoTen: string },
  code: string,
): Promise<void> {
  const { subject, html } = noiDungEmail(mau, nguoiNhan.hoTen, code);
  await send(
    { email: nguoiNhan.email, name: nguoiNhan.hoTen },
    subject,
    html,
    await qrDinhKem(code),
  );
}

/** Event confirmation, with the check-in QR attached. */
export async function sendEventEmail(
  data: Submission,
  checkinCode: string,
): Promise<void> {
  if (!isRegistration(data)) return;
  await guiEmailTheoMau(
    "xacNhan",
    { email: data.email, hoTen: data.hoTen },
    checkinCode,
  );
}

/** App waitlist confirmation. No QR — there is nothing to check in to yet. */
export async function sendWaitlistEmail(data: Submission): Promise<void> {
  const html = shell(
    `
    <h1 style="margin:0 0 8px;font-size:24px;">Cảm ơn mẹ đã quan tâm!</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#737373;">
      Mẹ sẽ là một trong những người đầu tiên biết khi ứng dụng <strong>${SITE.name}</strong> ra mắt.
    </p>
    <p style="margin:0;font-size:16px;line-height:24px;">
      Trong lúc chờ đợi, mẹ có thể tham gia <strong>${EVENT.shortName}</strong> —
      ${EVENT.dateLabel} tại ${EVENT.venue}.
    </p>`,
    `Mẹ nhận được email này vì đã đăng ký nhận tin từ ${SITE.name}.`,
  );

  await send({ email: data.email }, `Chào mừng mẹ đến với ${SITE.name}!`, html);
}

export type BanGuiMot = {
  email: string;
  hoTen: string;
  subject: string;
  html: string;
};

/**
 * Gửi hàng loạt: MỖI mẹ MỘT thư riêng, qua pool SMTP.
 *
 * KHÔNG nhét nhiều địa chỉ vào một trường `to`. Làm thế là lộ email của cả 500
 * mẹ cho nhau — sự cố riêng tư thật, không phải chi tiết kỹ thuật. Đây là tính
 * chất quan trọng nhất của hàm này và nó không được phép mất khi đổi nhà cung
 * cấp.
 *
 * Gửi SONG SONG có giới hạn (`SO_KET_NOI`) chứ không tuần tự: 500 lượt bắt tay
 * SMTP nối đuôi nhau không sống nổi trong `maxDuration = 60`. Pool của
 * nodemailer tự xếp hàng, ta chỉ cần chia lô để đo được tiến độ và để một lô
 * hỏng không kéo theo cả phần còn lại.
 *
 * Đính kèm dùng CHUNG cho mọi người nhận — mỗi thư mang một bản sao. Khác Brevo
 * trước đây (một payload, một khối đính kèm), giờ mỗi thư tự mang file, nên
 * đính kèm 3MB × 500 mẹ là 1.5GB rời khỏi máy chủ SMTP. Đó là lý do trần 3MB ở
 * `dinh-kem.ts` càng phải giữ.
 *
 * Ném lỗi kèm SỐ ĐÃ GỬI ĐƯỢC. Báo "đã gửi" khi chưa gửi được nghĩa là không ai
 * gửi lại, và 500 mẹ không biết tin.
 */
export async function guiHangLoat(
  ban: BanGuiMot[],
  dinhKem?: DinhKem[],
): Promise<number> {
  if (ban.length === 0) return 0;

  const from = nguoiGui();
  const kem =
    dinhKem && dinhKem.length > 0 ? kemNodemailer(dinhKem) : undefined;
  const tt = getTransport();

  let daGui = 0;
  const hong: string[] = [];

  for (let i = 0; i < ban.length; i += SO_KET_NOI) {
    const lo = ban.slice(i, i + SO_KET_NOI);
    const ket = await Promise.allSettled(
      lo.map((b) =>
        tt.sendMail({
          from,
          to: { name: b.hoTen, address: b.email },
          subject: b.subject,
          html: b.html,
          ...(kem ? { attachments: kem } : {}),
        }),
      ),
    );

    for (const [j, k] of ket.entries()) {
      if (k.status === "rejected") {
        hong.push(`${lo[j].email}: ${k.reason?.message ?? k.reason}`);
      } else if (k.value.rejected?.length) {
        // Máy chủ nhận thư nhưng từ chối người nhận — không ném, phải tự bắt.
        hong.push(`${lo[j].email}: máy chủ từ chối người nhận`);
      } else {
        daGui += 1;
      }
    }
  }

  // Hỏng một phần vẫn phải NỔI thành lỗi, kèm con số thật. Trả về daGui rồi im
  // lặng là admin tưởng xong, và những mẹ trong danh sách hỏng không bao giờ
  // được gửi lại.
  if (hong.length > 0) {
    const vaiCai = hong.slice(0, 5).join("; ");
    const conLai = hong.length > 5 ? ` (và ${hong.length - 5} lỗi nữa)` : "";
    throw new Error(
      `Gửi hỏng ${hong.length}/${ban.length} (đã gửi ${daGui}): ${vaiCai}${conLai}`,
    );
  }

  return daGui;
}
