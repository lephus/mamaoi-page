import nodemailer, { type Transporter } from "nodemailer";
import QRCode from "qrcode";
import { chuDeLabel, EVENT, SITE } from "./constants";
import { isRegistration, thangTuoiTuNgaySinh, type Submission } from "./validation";
import { checkinUrl } from "./checkin-url";
import type { MauEmail } from "./mau-email";

const BREVO_API = "https://api.brevo.com/v3";

/**
 * Contact management stays on the REST API (the xkeysib key) — it works today.
 * Only email SENDING moves to SMTP, per request. Both, however, are gated by
 * Brevo account activation: until the account is activated, transactional email
 * is refused ("SMTP account is not yet activated") no matter the transport.
 */
async function brevo(path: string, body: unknown): Promise<Response> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY chưa được cấu hình");

  return fetch(`${BREVO_API}${path}`, {
    method: "POST",
    headers: {
      "api-key": key,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
}

// Brevo SMTP relay. Reused across warm invocations rather than reconnecting.
let transporter: Transporter | null = null;
function getTransport(): Transporter {
  if (transporter) return transporter;
  const user = process.env.BREVO_SMTP_LOGIN;
  const pass = process.env.BREVO_SMTP_KEY;
  if (!user || !pass) {
    throw new Error("BREVO_SMTP_LOGIN / BREVO_SMTP_KEY chưa được cấu hình");
  }
  transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST ?? "smtp-relay.brevo.com",
    port: Number(process.env.BREVO_SMTP_PORT ?? 587),
    secure: false, // STARTTLS is negotiated on 587; TLS is still enforced
    auth: { user, pass },
  });
  return transporter;
}

/**
 * Upsert the contact into the right list.
 *
 * `updateEnabled` is what makes this Membership First rather than a form dump:
 * a mother who joins the app waitlist in July and registers for the event in
 * August must end up as ONE member with a richer profile, not two contacts.
 * Waitlist attributes are omitted rather than blanked, so the later event
 * registration only ever adds information.
 */
export async function upsertContact(
  data: Submission,
  checkinCode?: string,
): Promise<void> {
  const listId = isRegistration(data)
    ? Number(process.env.BREVO_LIST_EVENT ?? 3)
    : Number(process.env.BREVO_LIST_WAITLIST ?? 4);

  const attributes: Record<string, string | number | boolean> = {
    NGUON: data.nguon,
    DONG_Y_NHAN_TIN: data.dongYNhanTin,
  };

  if (isRegistration(data)) {
    attributes.HO_TEN = data.hoTen;
    attributes.SDT = data.sdt;
    attributes.TINH_THANH = data.tinhThanh;
    attributes.TRANG_THAI = data.trangThai;
    attributes.DI_CUNG_CHONG = data.diCungChong;
    attributes.NGUON_BIET_DEN = data.nguonBietDen;
    attributes.CHU_DE_QUAN_TAM = data.chuDeQuanTam.map(chuDeLabel).join(", ");
    if (data.facebook) attributes.FACEBOOK = data.facebook;
    if (checkinCode) attributes.MA_CHECKIN = checkinCode;

    // Mỗi nhánh chỉ gửi attribute của CHÍNH nó. `updateEnabled: true` nghĩa là
    // gửi chuỗi rỗng sẽ XOÁ TRẮNG giá trị cũ — một mẹ đăng ký lần hai sau khi
    // sinh sẽ mất sạch thông tin bé nếu ta gửi "" cho nhánh không áp dụng.
    //
    // Phải so === "da_sinh" tường minh, không dùng `else`: hai nhánh chuẩn bị /
    // IVF không có field bé, và chỉ gửi TRANG_THAI. `else` sẽ đọc data.tenBe...
    // vốn không tồn tại trên các nhánh đó.
    if (data.trangThai === "mang_thai") {
      attributes.THAI_TUAN = data.thaiTuan;
    } else if (data.trangThai === "da_sinh") {
      attributes.TEN_BE = data.tenBe;
      attributes.BE_NGAY_SINH = data.beNgaySinh.toISOString().slice(0, 10);
      attributes.BE_GIOI_TINH = data.beGioiTinh;
      attributes.BE_THANG_TUOI = thangTuoiTuNgaySinh(data.beNgaySinh, new Date());
    }
  }

  const res = await brevo("/contacts", {
    email: data.email,
    updateEnabled: true,
    listIds: [listId],
    attributes,
  });

  if (!res.ok) {
    throw new Error(`Brevo contact failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Contact cho đăng ký ops TẠO TAY ở `/admin/them-dang-ky` — chỉ có email, họ tên,
 * và SĐT nếu ops có.
 *
 * Cố ý KHÔNG gửi "--" cho TINH_THANH/TRANG_THAI, và bỏ hẳn SDT khi ops không
 * nhập: các attribute chưa biết VẮNG MẶT khỏi payload. `updateEnabled: true`
 * nghĩa là thứ ta gửi sẽ nằm lại và ĐÈ LÊN dữ liệu thật khi mẹ tự đăng ký đầy đủ
 * sau này — "--" trong ô số điện thoại của CRM còn tệ hơn một ô trống. Đây đúng
 * là lý lẽ đã áp cho nhánh waitlist ở `upsertContact` bên trên: chỉ được phép
 * THÊM thông tin.
 *
 * MA_CHECKIN là lý do lượt ghi này bắt buộc thành công: nó là nơi `existingCheckinCode`
 * đọc ra để giữ mã của một email cố định. Không ghi được thì lần sau mẹ tự đăng
 * ký bằng email đó sẽ được cấp mã MỚI, và tấm QR ta vừa gửi chết.
 */
export async function upsertContactThuCong(
  nguoiNhan: { email: string; hoTen: string; sdt?: string; dongYNhanTin: boolean },
  checkinCode: string,
): Promise<void> {
  const attributes: Record<string, string | number | boolean> = {
    NGUON: "su-kien",
    HO_TEN: nguoiNhan.hoTen,
    MA_CHECKIN: checkinCode,
    DONG_Y_NHAN_TIN: nguoiNhan.dongYNhanTin,
  };
  if (nguoiNhan.sdt) attributes.SDT = nguoiNhan.sdt;

  const res = await brevo("/contacts", {
    email: nguoiNhan.email,
    updateEnabled: true,
    listIds: [Number(process.env.BREVO_LIST_EVENT ?? 3)],
    attributes,
  });

  if (!res.ok) {
    throw new Error(`Brevo contact failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Mã check-in đã cấp cho email này ở lần đăng ký sự kiện trước (nếu có), để lần
 * sau DÙNG LẠI thay vì sinh mã mới — giữ mã của một email cố định thì QR/email cũ
 * không bao giờ hết hiệu lực (nếu không, upsert theo email ghi đè mã cũ và mọi QR
 * đã gửi trước đó báo "không tìm thấy mã").
 *
 * Tra ở Brevo — nguồn sự thật của contact, luôn nằm trong luồng đăng ký — chứ
 * không ở Supabase (non-fatal, có thể tắt). Trả null khi email chưa có contact
 * (404) hoặc mới chỉ ở waitlist app (chưa có MA_CHECKIN); cả hai đều nghĩa là
 * "chưa từng đăng ký sự kiện" → gọi nơi dùng sẽ sinh mã mới.
 */
export async function existingCheckinCode(email: string): Promise<string | null> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY chưa được cấu hình");

  const res = await fetch(`${BREVO_API}/contacts/${encodeURIComponent(email)}`, {
    headers: { "api-key": key, accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Brevo get contact failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { attributes?: Record<string, unknown> };
  const code = data.attributes?.MA_CHECKIN;
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
 * `kyTen` là tuỳ chọn vì hai mẫu gửi lại (BTC soạn) có chữ ký riêng — "Trân
 * trọng & Cảm ơn, Mama Ơi Team". Ghim cứng "Đội ngũ Mama Ơi" thì email sẽ ký
 * tên hai lần liên tiếp. Bỏ trống = giữ nguyên chữ ký cũ, nên mail xác nhận
 * đang chạy production không đổi một ký tự nào.
 */
export function shell(inner: string, footnote: string, kyTen?: string): string {
  // Styles are inlined because email clients strip <style> blocks.
  return `
<div style="margin:0;padding:24px;background:#fdf8f4;font-family:'Nunito',Arial,sans-serif;color:#292929;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;">
    ${inner}
    <p style="margin:24px 0 0;font-size:14px;line-height:20px;color:#737373;">
      ${kyTen ?? `Đội ngũ ${SITE.name}`}
    </p>
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:18px;color:#a3a3a3;text-align:center;">
    ${footnote}
  </p>
</div>`;
}

async function send(
  to: { email: string; name?: string },
  subject: string,
  html: string,
  attachment?: { content: string; name: string }[],
): Promise<void> {
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? SITE.name;
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL chưa được cấu hình");

  await getTransport().sendMail({
    from: { name: senderName, address: senderEmail },
    to: to.name ? { name: to.name, address: to.email } : to.email,
    subject,
    html,
    // `content` is the QR's base64 payload (data-URL prefix already stripped).
    attachments: attachment?.map((a) => ({
      filename: a.name,
      content: a.content,
      encoding: "base64",
      contentType: "image/png",
    })),
  });
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

/** Giới hạn messageVersions mỗi lượt gọi — luật của Brevo, không phải con số tuỳ chọn. */
const TOI_DA_MOI_LO = 1000;

export type BanGuiMot = {
  email: string;
  hoTen: string;
  subject: string;
  html: string;
};

/**
 * Gửi hàng loạt qua API GIAO DỊCH của Brevo, mỗi người nhận một bản riêng.
 *
 * KHÔNG dùng `send()` ở trên: nó đi qua SMTP relay, mỗi lần một email tuần tự —
 * 500 mẹ là 500 lượt bắt tay SMTP, không sống nổi trong giới hạn thời gian một
 * hàm trên Vercel.
 *
 * KHÔNG nhét nhiều địa chỉ vào một trường `to`: làm thế là lộ email của cả 500
 * mẹ cho nhau. `messageVersions` cho mỗi bản một `to` riêng.
 *
 * Chia lô 1000 (giới hạn Brevo). Với sức chứa 500 hiện tại thì luôn đúng một
 * lượt gọi; vòng lặp tồn tại chỉ để ngày nào đó EVENT_CAPACITY được nâng lên
 * thì hệ thống không ÂM THẦM cắt bớt người nhận.
 *
 * Ném lỗi kèm nguyên văn phản hồi Brevo VÀ số đã gửi được. Báo "đã gửi" khi
 * chưa gửi được nghĩa là không ai gửi lại, và 500 mẹ không biết tin.
 */
export async function guiHangLoat(ban: BanGuiMot[]): Promise<number> {
  if (ban.length === 0) return 0;

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? SITE.name;
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL chưa được cấu hình");

  let daGui = 0;
  for (let i = 0; i < ban.length; i += TOI_DA_MOI_LO) {
    const lo = ban.slice(i, i + TOI_DA_MOI_LO);
    const res = await brevo("/smtp/email", {
      sender: { name: senderName, email: senderEmail },
      // Bản gốc chỉ là chỗ dựa cho payload; mỗi messageVersion tự mang
      // subject/htmlContent riêng và đó mới là thứ tới hộp thư của mẹ.
      subject: lo[0].subject,
      htmlContent: lo[0].html,
      messageVersions: lo.map((b) => ({
        to: [{ email: b.email, name: b.hoTen }],
        subject: b.subject,
        htmlContent: b.html,
      })),
    });
    if (!res.ok) {
      const chiTiet = await res.text().catch(() => "");
      throw new Error(
        `Brevo từ chối (đã gửi ${daGui}/${ban.length}): ${res.status} ${chiTiet}`.trim(),
      );
    }
    daGui += lo.length;
  }
  return daGui;
}
