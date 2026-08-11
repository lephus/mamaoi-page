import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as adminAuth from "@/lib/admin-auth";
import * as mail from "@/lib/mail";
import * as sheets from "@/lib/sheets";
import * as supabase from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdmin: vi.fn(async () => true) }));

vi.mock("@/lib/mail", () => ({
    guiEmailTheoMau: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => ({
  findByEmail: vi.fn(async () => null),
  insertRegistrationThuCong: vi.fn(async () => {}),
}));

vi.mock("@/lib/sheets", () => ({
  sheetsConfigured: vi.fn(() => true),
  appendRegistrationThuCong: vi.fn(async () => {}),
}));

const HOP_LE = { hoTen: "Nguyễn Thị Lan", email: "lan@example.com", guiEmail: true };

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/admin/them-dang-ky", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/** Không lượt ghi nào chạm tới bất kỳ kho nào. */
function khongGhiGi() {
  expect(supabase.insertRegistrationThuCong).not.toHaveBeenCalled();
  expect(mail.guiEmailTheoMau).not.toHaveBeenCalled();
  expect(sheets.appendRegistrationThuCong).not.toHaveBeenCalled();
}

beforeEach(() => {
  // `clearAllMocks` chỉ xoá LỊCH SỬ GỌI, không gỡ implementation — một
  // `mockRejectedValue` đặt trong test hỏng-hóc sẽ sống tiếp sang mọi test sau
  // và làm chúng đỏ vì lý do chẳng liên quan. Dựng lại TOÀN BỘ nhánh thành công
  // ở đây, kể cả những mock chưa test nào ghi đè, để mỗi test tự đứng một mình.
  vi.clearAllMocks();
  vi.mocked(adminAuth.isAdmin).mockResolvedValue(true);
  vi.mocked(sheets.sheetsConfigured).mockReturnValue(true);
  vi.mocked(sheets.appendRegistrationThuCong).mockResolvedValue(undefined);
  vi.mocked(supabase.findByEmail).mockResolvedValue(null);
  vi.mocked(supabase.insertRegistrationThuCong).mockResolvedValue(undefined);
  vi.mocked(mail.guiEmailTheoMau).mockResolvedValue(undefined);
});

describe("/api/admin/them-dang-ky", () => {
  it("chặn người chưa đăng nhập và không ghi gì", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    expect((await post(HOP_LE)).status).toBe(401);
    khongGhiGi();
  });

  it("từ chối email/họ tên sai, kèm fieldErrors tiếng Việt", async () => {
    const res = await post({ hoTen: "A", email: "khong-phai-email" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.fieldErrors.hoTen).toBeTruthy();
    expect(data.fieldErrors.email).toBe("Email không hợp lệ");
    khongGhiGi();
  });

  it("body không phải JSON thì 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/them-dang-ky", {
        method: "POST",
        body: "khong-phai-json",
      }),
    );
    expect(res.status).toBe(400);
    khongGhiGi();
  });

  /**
   * Cổng quan trọng nhất của route. `insertRegistration` sẵn có upsert theo
   * email; dùng nhầm nó ở đây thì một mẹ đã đăng ký đầy đủ sẽ bị ghi đè SĐT và
   * tỉnh/thành thật thành "--" chỉ vì ops gõ trùng email — mất im lặng, không có
   * đường lấy lại.
   */
  it("email đã có đăng ký thì 409, trả mã cũ, KHÔNG ghi đè", async () => {
    vi.mocked(supabase.findByEmail).mockResolvedValue({
      checkin_code: "MO-CU1234",
      ho_ten: "Tên Thật Của Mẹ",
    } as supabase.RegistrationRow);

    const res = await post(HOP_LE);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("MO-CU1234");
    expect(data.hoTen).toBe("Tên Thật Của Mẹ");
    khongGhiGi();
  });

  it("tạo thành công: ghi đủ Supabase, email, Sheet", async () => {
    const res = await post(HOP_LE);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.code).toMatch(/^MO-[2-9A-HJ-NP-Z]{6}$/);
    expect(data.warnings).toEqual([]);

    expect(supabase.insertRegistrationThuCong).toHaveBeenCalledOnce();
    expect(sheets.appendRegistrationThuCong).toHaveBeenCalledOnce();
    expect(mail.guiEmailTheoMau).toHaveBeenCalledWith(
      "xacNhan",
      { email: "lan@example.com", hoTen: "Nguyễn Thị Lan" },
      data.code,
    );
  });

  it("hàng ghi xuống mang '--' và để trống field phân khúc", async () => {
    await post(HOP_LE);
    const hang = vi.mocked(supabase.insertRegistrationThuCong).mock.calls[0][0];
    expect(hang.sdt).toBe("--");
    expect(hang.tinh_thanh).toBe("--");
    expect(hang.trang_thai).toBeNull();
    expect(hang.nguon_biet_den).toBeNull();
    expect(hang.ho_ten).toBe("Nguyễn Thị Lan");
  });

  it("có nhập sdt thì ghi xuống DB dạng đã chuẩn hoá", async () => {
    const data = await (await post({ ...HOP_LE, sdt: "090 123 4567" })).json();
    // Trả về bản ĐÃ chuẩn hoá, để ops đối chiếu được với thứ thật sự đã lưu.
    expect(data.sdt).toBe("0901234567");
    expect(vi.mocked(supabase.insertRegistrationThuCong).mock.calls[0][0].sdt).toBe(
      "0901234567",
    );
  });

  it("sdt sai định dạng thì 400 và không ghi gì", async () => {
    const res = await post({ ...HOP_LE, sdt: "123" });
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.sdt).toBe("Số điện thoại không hợp lệ");
    khongGhiGi();
  });

  // Cùng dòng Sheet với Supabase, không phải một bản dựng lại riêng.
  it("Sheet nhận đúng hàng đã ghi xuống Supabase", async () => {
    await post(HOP_LE);
    expect(vi.mocked(sheets.appendRegistrationThuCong).mock.calls[0][0]).toEqual(
      vi.mocked(supabase.insertRegistrationThuCong).mock.calls[0][0],
    );
  });

  /**
   * HÀNH VI ĐÃ ĐỔI khi Brevo bị gỡ. Trước đây route tra `existingCheckinCode` ở
   * Brevo để dùng lại mã của một email mất dòng Supabase. Giờ nguồn duy nhất là
   * Supabase — mà cổng chặn trùng ngay trên đã `findByEmail` và trả 409 nếu có
   * dòng, nên tới được đây luôn nghĩa là email này chưa có mã nào. Mã mới là
   * đúng, và không còn lượt gọi DB thừa nào để tra lại.
   */
  it("email chưa có dòng → luôn sinh mã MỚI", async () => {
    const data = await (await post(HOP_LE)).json();
    expect(data.code).toMatch(/^MO-[2-9A-HJ-NP-Z]{6}$/);
    expect(mail.guiEmailTheoMau).toHaveBeenCalledWith(
      "xacNhan",
      expect.anything(),
      data.code,
    );
  });

  /**
   * Khác `/api/dang-ky`, nơi Supabase chỉ là cảnh báo: ở đây không có mẹ nào
   * đang chờ trước màn hình để phải cứu lấy lượt submit, mà `findByCode` đọc từ
   * Supabase — thiếu dòng nghĩa là QR quét vào báo "không tìm thấy mã". Và tuyệt
   * đối KHÔNG được gửi tấm QR đó đi trước khi biết nó sống.
   */
  it("Supabase hỏng thì 502 và KHÔNG gửi email QR", async () => {
    vi.mocked(supabase.insertRegistrationThuCong).mockRejectedValue(new Error("DB chết"));
    const res = await post(HOP_LE);
    expect(res.status).toBe(502);
    expect(mail.guiEmailTheoMau).not.toHaveBeenCalled();
  });

  it("email hỏng chỉ là cảnh báo — mã đã lưu, gửi lại được", async () => {
    vi.mocked(mail.guiEmailTheoMau).mockRejectedValue(new Error("SMTP chết"));
    const res = await post(HOP_LE);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.warnings).toContain("email");
  });

  it("Sheet hỏng chỉ là cảnh báo", async () => {
    vi.mocked(sheets.appendRegistrationThuCong).mockRejectedValue(new Error("Google 403"));
    const data = await (await post(HOP_LE)).json();
    expect(data.ok).toBe(true);
    expect(data.warnings).toContain("sheets");
  });

  it("không tick gửi mail thì không gửi gì, nhưng vẫn tạo", async () => {
    const res = await post({ ...HOP_LE, guiEmail: false });
    expect(res.status).toBe(200);
    expect(mail.guiEmailTheoMau).not.toHaveBeenCalled();
    expect(supabase.insertRegistrationThuCong).toHaveBeenCalledOnce();
  });

  it("consent chỉ bật khi ops tick", async () => {
    await post({ ...HOP_LE, dongYNhanTin: true });
    expect(vi.mocked(supabase.insertRegistrationThuCong).mock.calls[0][0].dong_y_nhan_tin).toBe(
      true,
    );
  });

  it("chuẩn hoá email hoa/thường + khoảng trắng trước khi tra trùng", async () => {
    await post({ ...HOP_LE, email: "  LAN@Example.COM " });
    expect(supabase.findByEmail).toHaveBeenCalledWith("lan@example.com");
  });

  // Dev chưa cấu hình Sheets/Supabase thì không được ném lỗi, chỉ bỏ qua bước đó.
  it("chưa cấu hình Sheets thì bỏ qua bước append, không báo lỗi", async () => {
    vi.mocked(sheets.sheetsConfigured).mockReturnValue(false);
    const data = await (await post(HOP_LE)).json();
    expect(data.ok).toBe(true);
    expect(sheets.appendRegistrationThuCong).not.toHaveBeenCalled();
    expect(data.warnings).toEqual([]);
  });
});
