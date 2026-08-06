import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatMinutesAsHours,
  formatPence,
  formatTime,
  parsePoundsToPence,
} from "./format";

describe("formatPence", () => {
  it("formats whole pounds", () => {
    expect(formatPence(1200)).toBe("£12.00");
  });
  it("formats with thousands separators", () => {
    expect(formatPence(391250)).toBe("£3,912.50");
  });
  it("formats zero", () => {
    expect(formatPence(0)).toBe("£0.00");
  });
  it("formats single pence", () => {
    expect(formatPence(1)).toBe("£0.01");
  });
});

describe("parsePoundsToPence", () => {
  it("parses plain pounds", () => {
    expect(parsePoundsToPence("12")).toBe(1200);
  });
  it("parses pounds and pence", () => {
    expect(parsePoundsToPence("12.50")).toBe(1250);
  });
  it("parses a single decimal digit as tens of pence", () => {
    expect(parsePoundsToPence("12.5")).toBe(1250);
  });
  it("accepts £ prefix and commas", () => {
    expect(parsePoundsToPence("£1,234.56")).toBe(123456);
  });
  it("rejects negatives", () => {
    expect(parsePoundsToPence("-5")).toBeNull();
  });
  it("rejects three decimal places", () => {
    expect(parsePoundsToPence("1.005")).toBeNull();
  });
  it("rejects non-numeric input", () => {
    expect(parsePoundsToPence("abc")).toBeNull();
    expect(parsePoundsToPence("")).toBeNull();
  });
});

describe("time formatting (Europe/London)", () => {
  // 2026-01-05T18:00Z is winter (GMT): displays as 18:00.
  it("uses 24-hour clock in winter (GMT)", () => {
    expect(formatTime(new Date("2026-01-05T18:00:00Z"))).toBe("18:00");
  });
  // 2026-08-03T18:00Z is summer (BST, UTC+1): displays as 19:00.
  it("applies BST offset in summer", () => {
    expect(formatTime(new Date("2026-08-03T18:00:00Z"))).toBe("19:00");
  });
  it("formats dates", () => {
    expect(formatDate(new Date("2026-08-03T18:00:00Z"))).toBe(
      "Mon, 3 Aug 2026",
    );
  });
  it("formats date-times", () => {
    expect(formatDateTime(new Date("2026-08-03T18:00:00Z"))).toBe(
      "Mon 3 Aug, 19:00",
    );
  });
  it("shows a post-midnight BST time as the next day", () => {
    // 23:30Z on the 3rd is 00:30 BST on the 4th.
    expect(formatDateTime(new Date("2026-08-03T23:30:00Z"))).toBe(
      "Tue 4 Aug, 00:30",
    );
  });
});

describe("formatMinutesAsHours", () => {
  it("formats hours and minutes", () => {
    expect(formatMinutesAsHours(450)).toBe("7h 30m");
  });
  it("omits zero minutes", () => {
    expect(formatMinutesAsHours(420)).toBe("7h");
  });
  it("formats sub-hour durations", () => {
    expect(formatMinutesAsHours(45)).toBe("45m");
  });
  it("formats zero", () => {
    expect(formatMinutesAsHours(0)).toBe("0m");
  });
});
