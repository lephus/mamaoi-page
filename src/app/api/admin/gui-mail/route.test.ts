import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import * as adminAuth from "@/lib/admin-auth";
import * as mail from "@/lib/mail";
import * as supabase from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdmin: vi.fn(async () => true) }));

vi.mock("@/lib/mail", async (goc) => ({
  // `noiDungEmail` để thật — bản xem trước phải là HTML thật, không phải stub.
  ...(await goc<typeof mail>()),
  guiEmailTheoMau: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => ({ findByCode: vi.fn() }));

const MA = "MO-ABC234";

/** Dòng trong DB. Tên và email ở đây MỚI là sự thật. */
const ROW = {
  id: "1",
  checkin_code: MA,
  ho_ten: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0900000000",
  checked_in: false,
} as unknown as supabase.RegistrationRow;

const get = (qs: string) => GET(new Request(`http://localhost/api/admin/gui-mail?${qs}`));
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/admin/gui-mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  // Xoá lịch sử gọi của MỌI mock, không riêng mock gửi mail: test "bản mẫu
  // không đụng DB" khẳng định findByCode chưa từng được gọi, nên nó phải sạch
  // lịch sử của các test chạy trước.
  vi.clearAllMocks();
  vi.mocked(adminAuth.isAdmin).mockResolvedValue(true);
  vi.mocked(supabase.findByCode).mockResolvedValue(ROW);
});

describe("/api/admin/gui-mail", () => {
  it("chặn người chưa đăng nhập, và KHÔNG gửi gì", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    expect((await get(`code=${MA}&mau=capLai`)).status).toBe(401);
    expect((await post({ code: MA, mau: "capLai" })).status).toBe(401);
    expect(mail.guiEmailTheoMau).not.toHaveBeenCalled();
  });

  it("từ chối mã sai định dạng và mẫu lạ", async () => {
    expect((await post({ code: "LUNG-TUNG", mau: "capLai" })).status).toBe(400);
    expect((await post({ code: MA, mau: "xoaHetDuLieu" })).status).toBe(400);
    expect(mail.guiEmailTheoMau).not.toHaveBeenCalled();
  });

  it("mã không có trong DB thì 404, không gửi mù", async () => {
    vi.mocked(supabase.findByCode).mockResolvedValue(null);
    expect((await post({ code: MA, mau: "capLai" })).status).toBe(404);
    expect(mail.guiEmailTheoMau).not.toHaveBeenCalled();
  });

  /**
   * Tính chất quan trọng nhất của route này. Client chỉ được nói "gửi cho mã
   * nào", không được nói "gửi tới email nào" — nếu không, một tab admin bị
   * chiếm có thể chuyển hướng vé vào cửa của bất kỳ mẹ nào sang hòm thư lạ.
   */
  it("gửi tới email TRONG DB, bỏ qua email/tên client khai", async () => {
    const res = await post({
      code: MA,
      mau: "capLai",
      email: "ke-gian@evil.com",
      hoTen: "Kẻ Gian",
    });

    expect(res.status).toBe(200);
    expect(mail.guiEmailTheoMau).toHaveBeenCalledWith(
      "capLai",
      { email: "lan@example.com", hoTen: "Nguyễn Thị Lan" },
      MA,
    );
  });

  it("chuẩn hoá mã viết thường thành hoa", async () => {
    await post({ code: "mo-abc234", mau: "suCo" });
    expect(supabase.findByCode).toHaveBeenCalledWith(MA);
  });

  it("gửi hỏng thì trả 502 chứ không báo thành công giả", async () => {
    vi.mocked(mail.guiEmailTheoMau).mockRejectedValue(new Error("SMTP chết"));
    const res = await post({ code: MA, mau: "capLai" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("SMTP chết");
  });

  /**
   * Bản mẫu: xem được câu chữ của từng mẫu KHI CHƯA chọn mẹ nào. Thiếu nó thì
   * dropdown "Mẫu email" trông như hỏng — đổi mẫu mà bên cạnh không nhúc nhích.
   */
  it("GET bản mẫu không cần mã, không đụng DB", async () => {
    const res = await get("mau=suCo&mauThu=1");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mauThu).toBe(true);
    expect(data.subject).toBe("[Mama Ơi] Xin lỗi vì sự cố kỹ thuật – Gửi mã QR check-in");
    expect(supabase.findByCode).not.toHaveBeenCalled();
    expect(mail.guiEmailTheoMau).not.toHaveBeenCalled();
  });

  it("bản mẫu vẫn phải đăng nhập", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    expect((await get("mau=suCo&mauThu=1")).status).toBe(401);
  });

  it("bản mẫu vẫn chặn mẫu lạ", async () => {
    expect((await get("mau=xoaHetDuLieu&mauThu=1")).status).toBe(400);
  });

  it("GET trả bản xem trước thật, không gửi email nào", async () => {
    const res = await get(`code=${MA}&mau=capLai`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subject).toBe("[Mama Ơi] Cấp lại mã QR check-in sự kiện");
    expect(data.html).toContain(MA);
    expect(data.html).toContain("Xin chào Nguyễn Thị Lan,");
    expect(data.email).toBe("lan@example.com");
    expect(mail.guiEmailTheoMau).not.toHaveBeenCalled();
  });
});
