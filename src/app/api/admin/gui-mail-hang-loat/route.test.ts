import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as adminAuth from "@/lib/admin-auth";
import * as brevo from "@/lib/brevo";
import * as supabase from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/supabase", () => ({ listRegistrations: vi.fn() }));
vi.mock("@/lib/brevo", async (goc) => ({
  // `dungEmail` gọi shell/escapeHtml thật qua brevo.ts — giữ nguyên bản thật để
  // test này khẳng định được HTML thật, chỉ thay đúng phần GỬI.
  ...(await goc<typeof brevo>()),
  guiHangLoat: vi.fn(async (ban: brevo.BanGuiMot[]) => ban.length),
}));

const ROWS = [
  {
    id: "id-1",
    ho_ten: "Nguyễn Thị Lan",
    email: "lan@example.com",
    checkin_code: "MO-ABC234",
  },
  {
    id: "id-2",
    ho_ten: "Trần Thị Mai",
    email: "mai@example.com",
    checkin_code: "MO-BCDEFG",
  },
] as unknown as supabase.RegistrationRow[];

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/admin/gui-mail-hang-loat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const CO_BAN = { tieuDe: "Sự kiện đổi địa điểm", noiDung: "Chào chị {{ten}}." };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.isAdmin).mockResolvedValue(true);
  vi.mocked(supabase.listRegistrations).mockResolvedValue(ROWS);
  vi.mocked(brevo.guiHangLoat).mockImplementation(async (ban) => ban.length);
});

describe("/api/admin/gui-mail-hang-loat", () => {
  it("chặn người chưa đăng nhập, và KHÔNG gửi gì", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    const res = await post({ ...CO_BAN, che_do: "that", ids: ["id-1"], xacNhanSoLuong: 1 });
    expect(res.status).toBe(401);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("chế độ lạ → 400", async () => {
    expect((await post({ ...CO_BAN, che_do: "xoaHet" })).status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("thiếu tiêu đề hoặc nội dung → 400", async () => {
    expect((await post({ che_do: "xem", noiDung: "x", idMau: "id-1" })).status).toBe(400);
    expect((await post({ che_do: "xem", tieuDe: "x", idMau: "id-1" })).status).toBe(400);
    expect(
      (await post({ che_do: "xem", tieuDe: "  ", noiDung: "  ", idMau: "id-1" })).status,
    ).toBe(400);
  });

  /**
   * Không chặn thì 500 mẹ nhận email mở đầu bằng "Chào chị {{name}}" — lỗi
   * không ai sửa lại được sau khi email đã đi.
   */
  it("chỗ điền lạ → 400 kèm token sai, KHÔNG gửi", async () => {
    const res = await post({
      che_do: "that",
      tieuDe: "x",
      noiDung: "Chào {{name}}",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("{{name}}");
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("chỗ điền lạ trong TIÊU ĐỀ cũng bị chặn", async () => {
    const res = await post({
      che_do: "that",
      tieuDe: "Chào {{name}}",
      noiDung: "x",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("xem trước: trả HTML thật, KHÔNG gửi gì", async () => {
    const res = await post({ ...CO_BAN, che_do: "xem", idMau: "id-1" });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.html).toContain("Chào chị Nguyễn Thị Lan.");
    expect(data.subject).toBe("Sự kiện đổi địa điểm");
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("xem trước với idMau không tồn tại → 404", async () => {
    expect((await post({ ...CO_BAN, che_do: "xem", idMau: "khong-co" })).status).toBe(404);
  });

  it("gửi thử: đúng 1 email, tới địa chỉ admin gõ, nội dung của mẹ mẫu", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmail: "toi@digitalunicorn.tech",
    });
    expect(res.status).toBe(200);
    expect(brevo.guiHangLoat).toHaveBeenCalledTimes(1);
    const ban = vi.mocked(brevo.guiHangLoat).mock.calls[0][0];
    expect(ban).toHaveLength(1);
    expect(ban[0].email).toBe("toi@digitalunicorn.tech");
    expect(ban[0].html).toContain("Chào chị Nguyễn Thị Lan.");
  });

  it("gửi thử với email sai định dạng → 400", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "thu",
      idMau: "id-1",
      toiEmail: "khong-phai-email",
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  /**
   * Cổng chặn quan trọng nhất của route. Một lượt "thu" không thể vô tình biến
   * thành lượt bắn 500 email: muốn thế nó phải mang đủ 500 ids VÀ đúng con số.
   */
  it("gửi thật: xacNhanSoLuong lệch ids.length → 400, KHÔNG gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-2"],
      xacNhanSoLuong: 1,
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("gửi thật: ids rỗng → 400", async () => {
    const res = await post({ ...CO_BAN, che_do: "that", ids: [], xacNhanSoLuong: 0 });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  /**
   * Client chỉ được nói "gửi cho id nào", không được nói "gửi tới email nào" —
   * nếu không, một tab admin bị chiếm có thể chuyển hướng cả đợt gửi sang hòm
   * thư lạ. Cùng nguyên tắc /api/admin/export đang dùng.
   */
  it("gửi thật: đọc email TỪ DB, bỏ qua email client khai", async () => {
    await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-2"],
      xacNhanSoLuong: 2,
      emails: ["ke-gian@evil.com"],
    });
    const ban = vi.mocked(brevo.guiHangLoat).mock.calls[0][0];
    expect(ban.map((b) => b.email).sort()).toEqual([
      "lan@example.com",
      "mai@example.com",
    ]);
  });

  it("gửi thật: mỗi mẹ nhận bản có tên mình", async () => {
    await post({ ...CO_BAN, che_do: "that", ids: ["id-1", "id-2"], xacNhanSoLuong: 2 });
    const ban = vi.mocked(brevo.guiHangLoat).mock.calls[0][0];
    expect(ban.find((b) => b.email === "lan@example.com")!.html).toContain(
      "Chào chị Nguyễn Thị Lan.",
    );
    expect(ban.find((b) => b.email === "mai@example.com")!.html).toContain(
      "Chào chị Trần Thị Mai.",
    );
  });

  it("gửi thật: có id không tồn tại trong DB → 400, KHÔNG gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-khong-co"],
      xacNhanSoLuong: 2,
    });
    expect(res.status).toBe(400);
    expect(brevo.guiHangLoat).not.toHaveBeenCalled();
  });

  it("gửi thật thành công → trả số đã gửi", async () => {
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1", "id-2"],
      xacNhanSoLuong: 2,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).daGui).toBe(2);
  });

  it("Brevo hỏng → 502 kèm lỗi thật, không báo thành công giả", async () => {
    vi.mocked(brevo.guiHangLoat).mockRejectedValue(new Error("Brevo từ chối: 400"));
    const res = await post({
      ...CO_BAN,
      che_do: "that",
      ids: ["id-1"],
      xacNhanSoLuong: 1,
    });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Brevo từ chối");
  });
});
