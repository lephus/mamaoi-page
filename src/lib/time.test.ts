import { describe, it, expect, afterEach, vi } from "vitest";
import {
  formatCheckinTime,
  isoToVNLocalInput,
  vnLocalInputToISO,
  ngayVN,
  homNayVN,
} from "@/lib/time";

describe("time (giờ VN, UTC+7)", () => {
  it("formatCheckinTime: ISO → HH:MM DD/MM/YYYY", () => {
    expect(formatCheckinTime("2026-08-30T01:03:00.000Z")).toBe("08:03 30/08/2026");
  });
  it("isoToVNLocalInput: ISO → giá trị datetime-local", () => {
    expect(isoToVNLocalInput("2026-08-30T01:03:00.000Z")).toBe("2026-08-30T08:03");
  });
  it("vnLocalInputToISO: datetime-local (giờ VN) → ISO/UTC", () => {
    expect(vnLocalInputToISO("2026-08-30T08:03")).toBe("2026-08-30T01:03:00.000Z");
  });
  it("khứ hồi ISO ↔ local", () => {
    const iso = "2026-08-30T01:03:00.000Z";
    expect(vnLocalInputToISO(isoToVNLocalInput(iso))).toBe(iso);
  });
});

describe("ngayVN", () => {
  it("đổi ISO date sang dd/mm/yyyy", () => {
    expect(ngayVN("2026-01-20")).toBe("20/01/2026");
  });

  it("giữ số 0 đầu của ngày và tháng", () => {
    expect(ngayVN("2026-03-05")).toBe("05/03/2026");
  });

  it("null thành chuỗi rỗng", () => {
    expect(ngayVN(null)).toBe("");
  });

  it("chuỗi rỗng thành chuỗi rỗng", () => {
    expect(ngayVN("")).toBe("");
  });

  // Bẫy múi giờ: `new Date("2026-01-20")` parse thành UTC midnight, format ở
  // múi giờ âm sẽ ra 19/01. Test này khoá việc KHÔNG đi qua Date.
  it("không lùi ngày do múi giờ", () => {
    expect(ngayVN("2026-01-01")).toBe("01/01/2026");
  });
});

describe("homNayVN", () => {
  afterEach(() => vi.useRealTimers());

  it("trả hôm nay theo giờ VN, không phải UTC", () => {
    vi.useFakeTimers();
    // 2026-07-20T23:30Z = 06:30 sáng 21/07 giờ VN. UTC nói 20, VN nói 21.
    vi.setSystemTime(new Date("2026-07-20T23:30:00Z"));
    expect(homNayVN()).toBe("2026-07-21");
  });

  it("không nhảy ngày ở giữa trưa VN", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T05:00:00Z")); // 12:00 trưa VN
    expect(homNayVN()).toBe("2026-07-20");
  });
});
