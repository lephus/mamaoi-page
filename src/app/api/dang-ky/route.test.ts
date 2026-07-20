import { describe, expect, it } from "vitest";
import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/dang-ky", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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
