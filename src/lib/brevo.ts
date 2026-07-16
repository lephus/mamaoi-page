import nodemailer, { type Transporter } from "nodemailer";
import QRCode from "qrcode";
import { EVENT, SITE } from "./constants";
import { isRegistration, type Submission } from "./validation";
import { checkinUrl } from "./checkin-url";

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
    if (data.facebook) attributes.FACEBOOK = data.facebook;
    if (checkinCode) attributes.MA_CHECKIN = checkinCode;
    // Sent only when it means something. A 0 here would read as "newborn"
    // rather than "not applicable — she is still pregnant".
    if (data.trangThai === "da_sinh" && data.beThangTuoi !== undefined) {
      attributes.BE_THANG_TUOI = data.beThangTuoi;
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

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

function shell(inner: string, footnote: string): string {
  // Styles are inlined because email clients strip <style> blocks.
  return `
<div style="margin:0;padding:24px;background:#fdf8f4;font-family:'Nunito',Arial,sans-serif;color:#292929;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;">
    ${inner}
    <p style="margin:24px 0 0;font-size:14px;line-height:20px;color:#737373;">
      Đội ngũ ${SITE.name}
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
 * Event confirmation, with the check-in QR attached.
 *
 * The QR is attached rather than hot-linked: most email clients block remote
 * images by default, and a QR the mother cannot see at the door is worse than
 * useless. The code is also printed as text so a volunteer can type it in.
 */
export async function sendEventEmail(
  data: Submission,
  checkinCode: string,
): Promise<void> {
  if (!isRegistration(data)) return;

  // QR nay dẫn thẳng tới trang check-in (quét bằng camera là mở trang), thay vì
  // chỉ mã trơn. Mã chữ + QR đính kèm vẫn giữ để gõ tay / admin tra khi máy quét lỗi.
  const url = checkinUrl(checkinCode);

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 480,
    margin: 2,
    color: { dark: "#292929", light: "#ffffff" },
  });

  const html = shell(
    `
    <h1 style="margin:0 0 8px;font-size:24px;">Cảm ơn mẹ đã đăng ký!</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#737373;">
      Chào ${escapeHtml(data.hoTen)}, mẹ đã có một chỗ tại <strong>${EVENT.shortName}</strong>.
    </p>
    <div style="background:#fce9e8;border-radius:16px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:14px;color:#737373;">Mã check-in của mẹ</p>
      <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:2px;color:#f08f8c;">${checkinCode}</p>
    </div>
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;">
      Mẹ vui lòng đưa mã QR đính kèm email này tại quầy check-in.
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${url}" style="display:inline-block;background:#f08f8c;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:9999px;">
        Mở trang check-in
      </a>
    </p>
    <table style="width:100%;font-size:15px;line-height:24px;">
      <tr><td style="padding:6px 0;color:#737373;">Thời gian</td><td style="padding:6px 0;font-weight:600;">${EVENT.dateLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#737373;">Địa điểm</td><td style="padding:6px 0;font-weight:600;">${EVENT.venue}</td></tr>
      <tr><td style="padding:6px 0;color:#737373;">Địa chỉ</td><td style="padding:6px 0;">${EVENT.address}</td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:16px;line-height:24px;">Hẹn gặp mẹ và bé tại sự kiện!</p>`,
    `Mẹ nhận được email này vì đã đăng ký tham dự ${EVENT.shortName}.`,
  );

  await send({ email: data.email, name: data.hoTen }, `Xác nhận đăng ký ${EVENT.shortName} — mã ${checkinCode}`, html, [
    { content: qrDataUrl.split(",")[1], name: `checkin-${checkinCode}.png` },
  ]);
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
