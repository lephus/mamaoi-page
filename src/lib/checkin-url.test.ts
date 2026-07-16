import { describe, it, expect, afterEach } from "vitest";
import { checkinUrl } from "@/lib/checkin-url";

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe("checkinUrl", () => {
  it("dùng NEXT_PUBLIC_SITE_URL khi được đặt", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://mamaoi-page.vercel.app";
    expect(checkinUrl("MO-23456A")).toBe(
      "https://mamaoi-page.vercel.app/check-in/MO-23456A",
    );
  });

  it("fallback về SITE.url khi không có env", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(checkinUrl("MO-23456A")).toBe("https://mamaoi.vn/check-in/MO-23456A");
  });

  it("không để lại dấu / thừa", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://x.vn";
    expect(checkinUrl("MO-ABCDEF")).toBe("https://x.vn/check-in/MO-ABCDEF");
  });
});
