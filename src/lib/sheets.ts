import { JWT } from "google-auth-library";
import { isRegistration, type Submission } from "./validation";

/**
 * Mirrors each submission into a Google Sheet for the ops team, who will run
 * check-in from a spreadsheet rather than the Brevo UI.
 *
 * Brevo is the source of truth; this is a mirror. The route handler must treat
 * a failure here as non-fatal.
 */

const SHEET_RANGE = "Sheet1!A:L";

function client(): JWT {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY chưa được cấu hình");
  }
  return new JWT({
    email,
    // Env vars cannot carry real newlines, so the key is stored with literal
    // "\n" sequences and rehydrated here.
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/** Column order must match the sheet's header row exactly. */
function toRow(data: Submission, checkinCode?: string): string[] {
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  if (!isRegistration(data)) {
    // Waitlist rows leave the event columns empty rather than inventing values.
    return [now, data.nguon, "", data.email, "", "", "", "", "", "", data.dongYNhanTin ? "Có" : "Không", ""];
  }

  return [
    now,
    data.nguon,
    data.hoTen,
    data.email,
    // The leading apostrophe stops Sheets from eating the leading zero of
    // "09..." and rendering it in scientific notation.
    `'${data.sdt}`,
    data.facebook || "",
    data.tinhThanh,
    data.trangThai === "mang_thai" ? "Đang mang thai" : "Đã sinh",
    data.trangThai === "da_sinh" && data.beThangTuoi !== undefined
      ? String(data.beThangTuoi)
      : "",
    data.diCungChong ? "Có" : "Không",
    data.dongYNhanTin ? "Có" : "Không",
    checkinCode ?? "",
  ];
}

export async function appendSubmission(
  data: Submission,
  checkinCode?: string,
): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID chưa được cấu hình");

  const { token } = await client().getAccessToken();

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/` +
    `${encodeURIComponent(SHEET_RANGE)}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [toRow(data, checkinCode)] }),
  });

  if (!res.ok) {
    throw new Error(`Sheets append failed (${res.status}): ${await res.text()}`);
  }
}

/** Whether the mirror is configured at all. The site runs fine without it. */
export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}
