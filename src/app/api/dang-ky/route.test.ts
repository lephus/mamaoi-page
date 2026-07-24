import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as brevo from "@/lib/brevo";
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
  giuChoDangKy: vi.fn(async () => "moi"),
  insertRegistration: vi.fn(async () => {}),
  insertWaitlist: vi.fn(async () => {}),
}));

vi.mock("@/lib/sheets", () => ({
  sheetsConfigured: vi.fn(() => false),
  appendRegistration: vi.fn(async () => {}),
  appendWaitlist: vi.fn(async () => {}),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.supabaseConfigured).mockReturnValue(true);
  vi.mocked(supabase.giuChoDangKy).mockResolvedValue("moi");
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

describe("POST /api/dang-ky — cổng chặn sức chứa", () => {
  it("hết chỗ: trả 409 kèm full + gioiHan", async () => {
    vi.mocked(supabase.giuChoDangKy).mockResolvedValue("het_cho");

    const res = await POST(post(dangKyHopLe()));
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.full).toBe(true);
    expect(body.gioiHan).toBe(500);
    expect(body.error).toContain("500");
  });

  /**
   * Đây là lý do cổng chặn phải nằm TRƯỚC Brevo. Gọi Brevo rồi mới chặn nghĩa là
   * mẹ đã nhận email xác nhận kèm mã QR cho một chỗ không tồn tại.
   */
  it("hết chỗ: KHÔNG chạm tới Brevo, không gửi email nào", async () => {
    vi.mocked(supabase.giuChoDangKy).mockResolvedValue("het_cho");

    await POST(post(dangKyHopLe()));

    expect(brevo.upsertContact).not.toHaveBeenCalled();
    expect(brevo.sendEventEmail).not.toHaveBeenCalled();
  });

  it("chỗ mới: đi tiếp và KHÔNG upsert lại (RPC đã insert)", async () => {
    const res = await POST(post(dangKyHopLe()));

    expect(res.status).toBe(200);
    expect(brevo.upsertContact).toHaveBeenCalledOnce();
    expect(supabase.insertRegistration).not.toHaveBeenCalled();
  });

  /**
   * Mẹ đã có chỗ mà bị chặn thì hoá ra bị đuổi khỏi chỗ mình đang giữ, chỉ vì
   * gửi lại form để sửa số điện thoại.
   */
  it("email đã đăng ký: vẫn qua được dù sự kiện đang đầy, và làm mới dòng cũ", async () => {
    vi.mocked(supabase.giuChoDangKy).mockResolvedValue("da_dang_ky");

    const res = await POST(post(dangKyHopLe()));

    expect(res.status).toBe(200);
    expect(supabase.insertRegistration).toHaveBeenCalledOnce();
  });

  it("Supabase lỗi: fail open — mẹ vẫn đăng ký được, kèm cảnh báo suc-chua", async () => {
    vi.mocked(supabase.giuChoDangKy).mockRejectedValue(new Error("connection refused"));

    const res = await POST(post(dangKyHopLe()));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.warnings).toContain("suc-chua");
    expect(brevo.upsertContact).toHaveBeenCalledOnce();
  });

  it("chưa cấu hình Supabase: không chặn, không ghi gì", async () => {
    vi.mocked(supabase.supabaseConfigured).mockReturnValue(false);

    const res = await POST(post(dangKyHopLe()));

    expect(res.status).toBe(200);
    expect(supabase.giuChoDangKy).not.toHaveBeenCalled();
    expect(supabase.insertRegistration).not.toHaveBeenCalled();
  });

  it("waitlist app không dính cổng chặn", async () => {
    vi.mocked(supabase.giuChoDangKy).mockResolvedValue("het_cho");

    const res = await POST(
      post({ nguon: "app-waitlist", email: "mai@email.com", dongYNhanTin: true }),
    );

    expect(res.status).toBe(200);
    expect(supabase.giuChoDangKy).not.toHaveBeenCalled();
    expect(supabase.insertWaitlist).toHaveBeenCalledOnce();
  });
});
