import { describe, it, expect } from "vitest";
import { formatCheckinTime, isoToVNLocalInput, vnLocalInputToISO } from "@/lib/time";

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
