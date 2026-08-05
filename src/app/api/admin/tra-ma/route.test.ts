import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import * as adminAuth from "@/lib/admin-auth";
import * as supabase from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/supabase", () => ({ findByCode: vi.fn() }));

const MA = "MO-ABC234";

/** Dòng đầy đủ trong DB — có cả những cột KHÔNG được lọt ra client. */
const ROW = {
  id: "row-1",
  checkin_code: MA,
  ho_ten: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0900000000",
  facebook: "fb.com/lan",
  tinh_thanh: "TP.HCM",
  trang_thai: "mang_thai",
  thai_tuan: 20,
  be_thang_tuoi: null,
  di_cung_chong: true,
  checked_in: false,
  checked_in_at: null,
  checked_in_source: null,
} as unknown as supabase.RegistrationRow;

const get = (qs: string) => GET(new Request(`http://localhost/api/admin/tra-ma?${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.isAdmin).mockResolvedValue(true);
  vi.mocked(supabase.findByCode).mockResolvedValue(ROW);
});

describe("/api/admin/tra-ma", () => {
  it("chặn người chưa đăng nhập, không đụng DB", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    expect((await get(`code=${MA}`)).status).toBe(401);
    expect(supabase.findByCode).not.toHaveBeenCalled();
  });

  it("mã sai định dạng → 400, không đụng DB", async () => {
    expect((await get("code=LUNG-TUNG")).status).toBe(400);
    expect((await get("")).status).toBe(400);
    expect(supabase.findByCode).not.toHaveBeenCalled();
  });

  it("mã không có trong DB → 404", async () => {
    vi.mocked(supabase.findByCode).mockResolvedValue(null);
    expect((await get(`code=${MA}`)).status).toBe(404);
  });

  it("chuẩn hoá mã viết thường thành hoa", async () => {
    await get("code=mo-abc234");
    expect(supabase.findByCode).toHaveBeenCalledWith(MA);
  });

  it("trả đủ các trường màn hình quét cần", async () => {
    const { row } = await (await get(`code=${MA}`)).json();
    expect(row).toMatchObject({
      id: "row-1",
      ho_ten: "Nguyễn Thị Lan",
      checkin_code: MA,
      tinh_thanh: "TP.HCM",
      trang_thai: "mang_thai",
      thai_tuan: 20,
      di_cung_chong: true,
      checked_in: false,
      checked_in_at: null,
      checked_in_source: null,
    });
  });

  /**
   * Đây là điện thoại CÁ NHÂN của nhân viên thời vụ đứng quầy, không phải máy
   * ops. Thẻ xác nhận không cần email/SĐT/Facebook, nên chúng không được rời
   * server. Khác /api/admin/registrations (trả full row) một cách CÓ CHỦ Ý.
   */
  it("KHÔNG để email / SĐT / Facebook lọt ra client", async () => {
    const res = await get(`code=${MA}`);
    const text = await res.text();
    expect(text).not.toContain("lan@example.com");
    expect(text).not.toContain("0900000000");
    expect(text).not.toContain("fb.com/lan");
    expect(JSON.parse(text).row).not.toHaveProperty("email");
    expect(JSON.parse(text).row).not.toHaveProperty("sdt");
    expect(JSON.parse(text).row).not.toHaveProperty("facebook");
  });

  it("DB hỏng → 502, không giả vờ không tìm thấy", async () => {
    vi.mocked(supabase.findByCode).mockRejectedValue(new Error("DB chết"));
    expect((await get(`code=${MA}`)).status).toBe(502);
  });
});
