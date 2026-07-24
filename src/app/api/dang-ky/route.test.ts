import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as brevo from "@/lib/brevo";
import * as sheets from "@/lib/sheets";
import * as supabase from "@/lib/supabase";

/**
 * Bốn dịch vụ ngoài đều bị chặn: test chạy ở env `node`, không có mạng và cũng
 * không được phép có — mục tiêu là kiểm tra THỨ TỰ và nhánh rẽ của route.
 */
vi.mock("@/lib/brevo", () => ({
  existingCheckinCode: vi.fn(async () => null),
  upsertContact: vi.fn(async () => {}),
  sendEventEmail: vi.fn(async () => {}),
  sendWaitlistEmail: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseConfigured: vi.fn(() => true),
  insertRegistration: vi.fn(async () => {}),
  insertWaitlist: vi.fn(async () => {}),
}));

vi.mock("@/lib/sheets", () => ({
  sheetsConfigured: vi.fn(() => true),
  docEmailDaDangKy: vi.fn(async () => new Set<string>()),
  appendRegistration: vi.fn(async () => {}),
  appendWaitlist: vi.fn(async () => {}),
}));

/** Sheet đang có `n` mẹ khác — không mẹ nào trùng email với `dangKyHopLe()`. */
function sheetCo(n: number): Set<string> {
  return new Set(Array.from({ length: n }, (_, i) => `me${i}@email.com`));
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/dang-ky", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Một lượt đăng ký hợp lệ, nhánh đơn giản nhất (chưa có bé). */
function dangKyHopLe(email = "mai@email.com") {
  return {
    nguon: "su-kien",
    hoTen: "Nguyễn Thị Mai",
    email,
    sdt: "0901234567",
    tinhThanh: "TP. Hồ Chí Minh",
    trangThai: "chuan_bi_mang_thai",
    chuDeQuanTam: ["thai_ky"],
    nguonBietDen: "facebook",
    dongYNhanTin: true,
  };
}

/** Trong hạn: 25/07/2026, ngay sau khi mở đăng ký. */
const TRONG_HAN = new Date("2026-07-25T10:00:00+07:00");
/** Quá hạn: 00:00 ngày 31/08/2026 giờ VN, đúng một ms sau khi đóng. */
const QUA_HAN = new Date("2026-08-31T00:00:00+07:00");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.supabaseConfigured).mockReturnValue(true);
  vi.mocked(sheets.sheetsConfigured).mockReturnValue(true);
  vi.mocked(sheets.docEmailDaDangKy).mockResolvedValue(new Set());

  // Ghim đồng hồ cho MỌI test trong file. Route giờ có cổng chặn theo hạn
  // 30/08/2026, nên để đồng hồ thật thì sau ngày đó toàn bộ test sức chứa nhận
  // 409 "hết hạn" thay vì đi tới cổng sức chứa — cả file tự hỏng theo lịch.
  vi.useFakeTimers();
  vi.setSystemTime(TRONG_HAN);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/dang-ky — gộp lỗi khi thiếu trangThai", () => {
  it("trả lỗi trangThai VÀ lỗi field chung trong cùng một lần", async () => {
    const res = await POST(post({ nguon: "su-kien" }));
    expect(res.status).toBe(400);
    const { fieldErrors } = await res.json();

    expect(fieldErrors.trangThai).toBe("Vui lòng chọn tình trạng hiện tại");
    // Đây là phần mà union short-circuit đã nuốt mất trước khi sửa:
    expect(fieldErrors.hoTen).toBe("Vui lòng nhập họ tên");
    expect(fieldErrors.email).toBeTruthy();
    expect(fieldErrors.sdt).toBe("Số điện thoại không hợp lệ");
    expect(fieldErrors.tinhThanh).toBe("Vui lòng chọn thành phố");
    expect(fieldErrors.chuDeQuanTam).toBe("Vui lòng chọn ít nhất một chủ đề");
    expect(fieldErrors.dongYNhanTin).toBe("Vui lòng đồng ý để hoàn tất đăng ký");
  });

  it("waitlist không bị dính schema sự kiện", async () => {
    const res = await POST(post({ nguon: "app-waitlist", email: "hong" }));
    expect(res.status).toBe(400);
    const { fieldErrors } = await res.json();
    expect(fieldErrors.email).toBe("Email không hợp lệ");
    expect(fieldErrors.hoTen).toBeUndefined();
    expect(fieldErrors.trangThai).toBeUndefined();
  });
});

describe("POST /api/dang-ky — cổng chặn hết hạn", () => {
  it("quá hạn: trả 409 kèm closed", async () => {
    vi.setSystemTime(QUA_HAN);

    const res = await POST(post(dangKyHopLe()));
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.closed).toBe(true);
    expect(body.error).toContain("Đã đóng đăng ký");
  });

  /**
   * Cùng lý do với cổng sức chứa: đặt sau Brevo thì mẹ đã cầm email xác nhận kèm
   * mã QR cho một sự kiện đã xong rồi mới bị báo là muộn.
   */
  it("quá hạn: KHÔNG chạm Brevo, không đọc Sheet, không ghi dòng nào", async () => {
    vi.setSystemTime(QUA_HAN);

    await POST(post(dangKyHopLe()));

    expect(brevo.upsertContact).not.toHaveBeenCalled();
    expect(brevo.sendEventEmail).not.toHaveBeenCalled();
    expect(sheets.docEmailDaDangKy).not.toHaveBeenCalled();
    expect(supabase.insertRegistration).not.toHaveBeenCalled();
    expect(sheets.appendRegistration).not.toHaveBeenCalled();
  });

  /** 23:59:59.999 ngày 30/08 giờ VN vẫn phải nhận — hạn là HẾT ngày sự kiện. */
  it("giây cuối cùng của ngày 30/08 vẫn đăng ký được", async () => {
    vi.setSystemTime(new Date("2026-08-30T23:59:59.999+07:00"));

    const res = await POST(post(dangKyHopLe()));
    expect(res.status).toBe(200);
  });

  it("trong hạn: đi bình thường", async () => {
    vi.setSystemTime(TRONG_HAN);

    const res = await POST(post(dangKyHopLe()));
    expect(res.status).toBe(200);
    expect(brevo.upsertContact).toHaveBeenCalledOnce();
  });

  /** Waitlist app không có hạn — sự kiện xong rồi mẹ vẫn để lại email nhận tin. */
  it("waitlist app không dính cổng hết hạn", async () => {
    vi.setSystemTime(QUA_HAN);

    const res = await POST(
      post({ nguon: "app-waitlist", email: "mai@email.com", dongYNhanTin: true }),
    );

    expect(res.status).toBe(200);
    expect(supabase.insertWaitlist).toHaveBeenCalledOnce();
  });
});

describe("POST /api/dang-ky — cổng chặn sức chứa (đếm trên Google Sheet)", () => {
  it("hết chỗ: trả 409 kèm full + gioiHan", async () => {
    vi.mocked(sheets.docEmailDaDangKy).mockResolvedValue(sheetCo(500));

    const res = await POST(post(dangKyHopLe()));
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.full).toBe(true);
    expect(body.gioiHan).toBe(500);
    expect(body.error).toContain("500");
  });

  /** Mốc cuối: 499 mẹ trong Sheet thì mẹ thứ 500 vẫn phải vào được. */
  it("còn đúng một chỗ: vẫn nhận", async () => {
    vi.mocked(sheets.docEmailDaDangKy).mockResolvedValue(sheetCo(499));

    const res = await POST(post(dangKyHopLe()));
    expect(res.status).toBe(200);
  });

  /**
   * Đây là lý do cổng chặn phải nằm TRƯỚC Brevo. Gọi Brevo rồi mới chặn nghĩa là
   * mẹ đã nhận email xác nhận kèm mã QR cho một chỗ không tồn tại.
   */
  it("hết chỗ: KHÔNG chạm tới Brevo, không gửi email nào, không ghi dòng nào", async () => {
    vi.mocked(sheets.docEmailDaDangKy).mockResolvedValue(sheetCo(500));

    await POST(post(dangKyHopLe()));

    expect(brevo.upsertContact).not.toHaveBeenCalled();
    expect(brevo.sendEventEmail).not.toHaveBeenCalled();
    expect(supabase.insertRegistration).not.toHaveBeenCalled();
    expect(sheets.appendRegistration).not.toHaveBeenCalled();
  });

  it("chỗ mới: đi tiếp, ghi Supabase và append Sheet", async () => {
    const res = await POST(post(dangKyHopLe()));

    expect(res.status).toBe(200);
    expect(brevo.upsertContact).toHaveBeenCalledOnce();
    expect(supabase.insertRegistration).toHaveBeenCalledOnce();
    expect(sheets.appendRegistration).toHaveBeenCalledOnce();
  });

  /**
   * Mẹ đã có chỗ mà bị chặn thì hoá ra bị đuổi khỏi chỗ mình đang giữ, chỉ vì
   * gửi lại form để sửa số điện thoại.
   */
  it("email đã có trong Sheet: vẫn qua được dù sự kiện đang đầy", async () => {
    const day = sheetCo(500);
    day.add("mai@email.com");
    vi.mocked(sheets.docEmailDaDangKy).mockResolvedValue(day);

    const res = await POST(post(dangKyHopLe("mai@email.com")));

    expect(res.status).toBe(200);
    expect(supabase.insertRegistration).toHaveBeenCalledOnce();
  });

  it("đọc Sheet lỗi: fail open — mẹ vẫn đăng ký được, kèm cảnh báo suc-chua", async () => {
    vi.mocked(sheets.docEmailDaDangKy).mockRejectedValue(new Error("Google Sheets 403"));

    const res = await POST(post(dangKyHopLe()));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.warnings).toContain("suc-chua");
    expect(brevo.upsertContact).toHaveBeenCalledOnce();
  });

  it("chưa cấu hình Sheets: không chặn, không đọc gì", async () => {
    vi.mocked(sheets.sheetsConfigured).mockReturnValue(false);

    const res = await POST(post(dangKyHopLe()));

    expect(res.status).toBe(200);
    expect(sheets.docEmailDaDangKy).not.toHaveBeenCalled();
  });

  /**
   * Cổng chặn KHÔNG được đụng tới Supabase nữa — nguồn đếm duy nhất là Sheet.
   * Supabase sập thì mẹ vẫn đăng ký được, chỉ mất bản ghi check-in (non-fatal).
   */
  it("Supabase sập: cổng chặn vẫn chạy bình thường trên Sheet", async () => {
    vi.mocked(supabase.supabaseConfigured).mockReturnValue(false);
    vi.mocked(sheets.docEmailDaDangKy).mockResolvedValue(sheetCo(500));

    const res = await POST(post(dangKyHopLe()));

    expect(res.status).toBe(409);
    expect(supabase.insertRegistration).not.toHaveBeenCalled();
  });

  it("waitlist app không dính cổng chặn", async () => {
    vi.mocked(sheets.docEmailDaDangKy).mockResolvedValue(sheetCo(500));

    const res = await POST(
      post({ nguon: "app-waitlist", email: "mai@email.com", dongYNhanTin: true }),
    );

    expect(res.status).toBe(200);
    expect(sheets.docEmailDaDangKy).not.toHaveBeenCalled();
    expect(supabase.insertWaitlist).toHaveBeenCalledOnce();
  });
});
