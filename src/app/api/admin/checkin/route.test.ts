import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as adminAuth from "@/lib/admin-auth";
import * as sheets from "@/lib/sheets";
import * as supabase from "@/lib/supabase";

/* `after` chạy callback SAU KHI response đã trả. Test cần chờ nó xong mới
   khẳng định được Sheet có bị gọi hay không, nên mock giữ lại promise.
   `vi.hoisted` vì `vi.mock` bị kéo lên trên mọi khai báo const. */
const { nenSauTraLoi } = vi.hoisted(() => ({ nenSauTraLoi: [] as Promise<unknown>[] }));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<unknown> | unknown) => {
    nenSauTraLoi.push(Promise.resolve().then(fn));
  },
}));

vi.mock("@/lib/admin-auth", () => ({ isAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/supabase", () => ({ adminUpdateCheckin: vi.fn() }));
vi.mock("@/lib/sheets", () => ({
  ghiCheckinVaoSheet: vi.fn(async () => {}),
  sheetsConfigured: vi.fn(() => true),
}));

const MA = "MO-ABC234";

const ROW = {
  id: "row-1",
  checkin_code: MA,
  ho_ten: "Nguyễn Thị Lan",
  checked_in: true,
  checked_in_at: "2026-08-30T02:30:00.000Z",
  checked_in_source: "admin",
} as unknown as supabase.RegistrationRow;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/admin/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/** Chờ mọi việc `after` đã xếp hàng chạy xong. */
const xongViecNen = async () => {
  await Promise.all(nenSauTraLoi);
  nenSauTraLoi.length = 0;
};

beforeEach(() => {
  vi.clearAllMocks();
  nenSauTraLoi.length = 0;
  vi.mocked(adminAuth.isAdmin).mockResolvedValue(true);
  vi.mocked(supabase.adminUpdateCheckin).mockResolvedValue(ROW);
  vi.mocked(sheets.sheetsConfigured).mockReturnValue(true);
  vi.mocked(sheets.ghiCheckinVaoSheet).mockResolvedValue(undefined);
});

describe("/api/admin/checkin", () => {
  it("chặn người chưa đăng nhập, không ghi gì", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    expect((await post({ id: "row-1", checkedIn: true })).status).toBe(401);
    expect(supabase.adminUpdateCheckin).not.toHaveBeenCalled();
    expect(sheets.ghiCheckinVaoSheet).not.toHaveBeenCalled();
  });

  it("thiếu id hoặc checkedIn không phải boolean → 400", async () => {
    expect((await post({ checkedIn: true })).status).toBe(400);
    expect((await post({ id: "row-1" })).status).toBe(400);
    expect(supabase.adminUpdateCheckin).not.toHaveBeenCalled();
  });

  it("check-in hộ: mirror sang Sheet với nguồn 'admin'", async () => {
    const res = await post({
      id: "row-1",
      checkedIn: true,
      checkedInAt: "2026-08-30T02:30:00.000Z",
    });
    expect(res.status).toBe(200);
    await xongViecNen();
    expect(sheets.ghiCheckinVaoSheet).toHaveBeenCalledWith(
      MA,
      "2026-08-30T02:30:00.000Z",
      "admin",
    );
  });

  it("bỏ tick: mirror lượt XOÁ sang Sheet, không để lại giờ ma", async () => {
    vi.mocked(supabase.adminUpdateCheckin).mockResolvedValue({
      ...ROW,
      checked_in: false,
      checked_in_at: null,
      checked_in_source: null,
    } as unknown as supabase.RegistrationRow);

    await post({ id: "row-1", checkedIn: false });
    await xongViecNen();
    expect(sheets.ghiCheckinVaoSheet).toHaveBeenCalledWith(MA, null, null);
  });

  /**
   * Tính chất quan trọng nhất của route này. Supabase là nguồn chính thức; Sheet
   * chỉ là bản mirror cho ops. Sheet hỏng mà trả lỗi thì một mẹ đứng ở cửa sẽ bị
   * báo check-in thất bại trong khi hệ thống ĐÃ ghi nhận chị ấy.
   */
  it("Sheet hỏng vẫn trả ok — check-in đã ghi xong ở Supabase", async () => {
    vi.mocked(sheets.ghiCheckinVaoSheet).mockRejectedValue(new Error("Google 403"));
    const res = await post({ id: "row-1", checkedIn: true });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    await expect(xongViecNen()).resolves.not.toThrow();
  });

  it("chưa cấu hình Sheets thì không gọi Google", async () => {
    vi.mocked(sheets.sheetsConfigured).mockReturnValue(false);
    await post({ id: "row-1", checkedIn: true });
    await xongViecNen();
    expect(sheets.ghiCheckinVaoSheet).not.toHaveBeenCalled();
  });

  it("Supabase hỏng thì 502, và KHÔNG đụng Sheet", async () => {
    vi.mocked(supabase.adminUpdateCheckin).mockRejectedValue(new Error("DB chết"));
    expect((await post({ id: "row-1", checkedIn: true })).status).toBe(502);
    await xongViecNen();
    expect(sheets.ghiCheckinVaoSheet).not.toHaveBeenCalled();
  });
});
