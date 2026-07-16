import { describe, it, expect, beforeAll } from "vitest";
import {
  verifyCredentials,
  signSession,
  verifySession,
} from "@/lib/admin-auth";

beforeAll(() => {
  process.env.ADMIN_EMAIL = "admin@digitalunicorn.fr";
  process.env.ADMIN_PASSWORD = "secret-pass";
  process.env.ADMIN_SESSION_SECRET = "unit-test-secret";
});

describe("admin-auth", () => {
  it("verifyCredentials: đúng email/mật khẩu (email không phân biệt hoa thường)", () => {
    expect(verifyCredentials("admin@digitalunicorn.fr", "secret-pass")).toBe(true);
    expect(verifyCredentials("ADMIN@digitalunicorn.fr", "secret-pass")).toBe(true);
  });
  it("verifyCredentials: từ chối sai", () => {
    expect(verifyCredentials("admin@digitalunicorn.fr", "wrong")).toBe(false);
    expect(verifyCredentials("x@y.z", "secret-pass")).toBe(false);
  });
  it("signSession → verifySession hợp lệ", () => {
    expect(verifySession(signSession())).toBe(true);
  });
  it("verifySession: từ chối token rỗng / giả mạo / hết hạn", () => {
    expect(verifySession(undefined)).toBe(false);
    expect(verifySession("abc.def")).toBe(false);
    const token = signSession();
    expect(verifySession(token.slice(0, -2) + "xx")).toBe(false); // đổi chữ ký
    expect(verifySession(signSession(-1000))).toBe(false); // đã hết hạn
  });
});
