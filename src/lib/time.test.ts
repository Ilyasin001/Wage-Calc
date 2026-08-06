import { describe, expect, it } from "vitest";
import {
  addDays,
  londonToUtc,
  mondayOf,
  resolveEntryEnd,
  resolveEntryStart,
  utcToLondonDate,
  utcToLondonTime,
} from "./time";

describe("londonToUtc", () => {
  it("converts winter (GMT) wall time 1:1", () => {
    expect(londonToUtc("2026-01-05", "18:00").toISOString()).toBe(
      "2026-01-05T18:00:00.000Z",
    );
  });
  it("converts summer (BST) wall time with +1 offset", () => {
    expect(londonToUtc("2026-08-03", "18:00").toISOString()).toBe(
      "2026-08-03T17:00:00.000Z",
    );
  });
  it("handles the spring-forward day", () => {
    // 2026-03-29: clocks jump 01:00→02:00. 03:00 BST = 02:00 UTC.
    expect(londonToUtc("2026-03-29", "03:00").toISOString()).toBe(
      "2026-03-29T02:00:00.000Z",
    );
  });
  it("round-trips through utcToLondonTime", () => {
    const utc = londonToUtc("2026-08-03", "22:15");
    expect(utcToLondonTime(utc)).toBe("22:15");
    expect(utcToLondonDate(utc)).toBe("2026-08-03");
  });
});

describe("date helpers", () => {
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });
  it("mondayOf finds the pay-week start (D13)", () => {
    expect(mondayOf("2026-08-06")).toBe("2026-08-03"); // Thursday → Monday
    expect(mondayOf("2026-08-03")).toBe("2026-08-03"); // Monday → itself
    expect(mondayOf("2026-08-09")).toBe("2026-08-03"); // Sunday → prev Monday
  });
});

describe("entry time resolution (overnight ambiguity)", () => {
  // Overnight shift: Mon 3 Aug 18:00 → Tue 4 Aug 02:00 BST
  const shiftDate = "2026-08-03";
  const shiftStart = londonToUtc(shiftDate, "18:00");

  it("keeps an on-time start on the shift date", () => {
    expect(
      resolveEntryStart(shiftDate, shiftStart, "18:00").toISOString(),
    ).toBe(londonToUtc("2026-08-03", "18:00").toISOString());
  });
  it("keeps an early arrival on the shift date", () => {
    expect(
      resolveEntryStart(shiftDate, shiftStart, "17:30").toISOString(),
    ).toBe(londonToUtc("2026-08-03", "17:30").toISOString());
  });
  it("puts a post-midnight start on the next day", () => {
    expect(
      resolveEntryStart(shiftDate, shiftStart, "00:30").toISOString(),
    ).toBe(londonToUtc("2026-08-04", "00:30").toISOString());
  });
  it("resolves an end after midnight to the next day", () => {
    const start = resolveEntryStart(shiftDate, shiftStart, "18:00");
    expect(resolveEntryEnd(start, "02:00").toISOString()).toBe(
      londonToUtc("2026-08-04", "02:00").toISOString(),
    );
  });
  it("resolves a same-evening end to the same day", () => {
    const start = resolveEntryStart(shiftDate, shiftStart, "18:00");
    expect(resolveEntryEnd(start, "23:30").toISOString()).toBe(
      londonToUtc("2026-08-03", "23:30").toISOString(),
    );
  });
  it("handles a day shift with no ambiguity", () => {
    const dayStart = londonToUtc("2026-08-03", "09:00");
    const start = resolveEntryStart("2026-08-03", dayStart, "09:00");
    expect(resolveEntryEnd(start, "17:00").toISOString()).toBe(
      londonToUtc("2026-08-03", "17:00").toISOString(),
    );
  });
});
