import { describe, expect, it } from "vitest";
import {
  basePayPence,
  entryPay,
  rangesOverlap,
  shiftTotalPence,
  validateEntry,
  validateRates,
  workedMinutes,
  type EntryInput,
  type ShiftRates,
} from "./wage";

const rates: ShiftRates = { baseRatePence: 1200, supervisorRatePence: 1500 };

function entry(overrides: Partial<EntryInput> = {}): EntryInput {
  return {
    // 18:00 → 02:00 next day (8h span), the typical evening shift
    startAt: new Date("2026-08-03T18:00:00Z"),
    endAt: new Date("2026-08-04T02:00:00Z"),
    breakMinutes: 60,
    isSupervisor: false,
    additionalPence: 0,
    ...overrides,
  };
}

describe("workedMinutes", () => {
  it("subtracts the break from the elapsed span", () => {
    expect(workedMinutes(entry())).toBe(420); // 480 − 60
  });
  it("handles zero break (supervisor default)", () => {
    expect(workedMinutes(entry({ breakMinutes: 0 }))).toBe(480);
  });
  it("handles an overnight span correctly", () => {
    expect(
      workedMinutes(
        entry({
          startAt: new Date("2026-08-03T22:00:00Z"),
          endAt: new Date("2026-08-04T06:00:00Z"),
          breakMinutes: 60,
        }),
      ),
    ).toBe(420);
  });
  it("pays elapsed real time across the March clock change", () => {
    // 2026-03-29: 01:00 GMT jumps to 02:00 BST. 23:00Z→05:00Z is 6 real hours.
    expect(
      workedMinutes(
        entry({
          startAt: new Date("2026-03-28T23:00:00Z"),
          endAt: new Date("2026-03-29T05:00:00Z"),
          breakMinutes: 0,
        }),
      ),
    ).toBe(360);
  });
  it("handles a short 15-minute entry", () => {
    expect(
      workedMinutes(
        entry({
          startAt: new Date("2026-08-03T18:00:00Z"),
          endAt: new Date("2026-08-03T18:15:00Z"),
          breakMinutes: 0,
        }),
      ),
    ).toBe(15);
  });
});

describe("basePayPence — integer pence, half-up rounding", () => {
  it("computes whole-hour pay exactly", () => {
    expect(basePayPence(420, 1200)).toBe(8400); // 7h × £12.00
  });
  it("computes quarter-hour fractions exactly when they divide evenly", () => {
    expect(basePayPence(435, 1200)).toBe(8700); // 7h15 × £12.00 = £87.00
  });
  it("rounds a half-penny up", () => {
    expect(basePayPence(15, 1250)).toBe(313); // 312.5p → 313p
  });
  it("rounds below a half-penny down", () => {
    expect(basePayPence(15, 1249)).toBe(312); // 312.25p → 312p
  });
  it("rounds three-quarters of a penny up", () => {
    expect(basePayPence(45, 1249)).toBe(937); // 936.75p → 937p
  });
  it("handles zero minutes", () => {
    expect(basePayPence(0, 1200)).toBe(0);
  });
  it("stays exact at large values (no float drift)", () => {
    // 12h at £99.99/h = 719928 / 60 → exact
    expect(basePayPence(720, 9999)).toBe(119988);
  });
});

describe("entryPay", () => {
  it("uses the base rate for regular staff", () => {
    const pay = entryPay(entry(), rates);
    expect(pay.ratePence).toBe(1200);
    expect(pay.basePayPence).toBe(8400);
    expect(pay.totalPence).toBe(8400);
  });
  it("uses the supervisor rate for the supervisor", () => {
    const pay = entryPay(entry({ isSupervisor: true, breakMinutes: 0 }), rates);
    expect(pay.ratePence).toBe(1500);
    expect(pay.basePayPence).toBe(12000); // 8h × £15
  });
  it("adds the additional amount on top of base pay", () => {
    const pay = entryPay(entry({ additionalPence: 2500 }), rates);
    expect(pay.basePayPence).toBe(8400);
    expect(pay.totalPence).toBe(10900);
  });
  it("reports worked minutes in the breakdown", () => {
    expect(entryPay(entry(), rates).workedMinutes).toBe(420);
  });
});

describe("shiftTotalPence", () => {
  it("sums a realistic shift", () => {
    const entries: EntryInput[] = [
      entry({ isSupervisor: true, breakMinutes: 0 }), // 8h × £15 = £120
      entry(), // 7h × £12 = £84
      entry({ additionalPence: 1000 }), // £84 + £10 = £94
      entry({
        // left two hours early: 18:00–00:00, 6h − 1h break = 5h × £12 = £60
        endAt: new Date("2026-08-04T00:00:00Z"),
      }),
    ];
    expect(shiftTotalPence(entries, rates)).toBe(12000 + 8400 + 9400 + 6000);
  });
  it("returns 0 for an empty shift", () => {
    expect(shiftTotalPence([], rates)).toBe(0);
  });
});

describe("validateEntry", () => {
  it("accepts a valid entry", () => {
    expect(validateEntry(entry())).toEqual([]);
  });
  it("rejects times off the 15-minute grid", () => {
    expect(
      validateEntry(entry({ startAt: new Date("2026-08-03T18:07:00Z") })),
    ).toContain("start-not-on-15-minute-boundary");
    expect(
      validateEntry(entry({ endAt: new Date("2026-08-04T02:00:30Z") })),
    ).toContain("end-not-on-15-minute-boundary");
  });
  it("rejects end equal to start", () => {
    const t = new Date("2026-08-03T18:00:00Z");
    expect(validateEntry(entry({ startAt: t, endAt: t }))).toContain(
      "end-not-after-start",
    );
  });
  it("rejects end before start", () => {
    expect(
      validateEntry(
        entry({
          startAt: new Date("2026-08-03T18:00:00Z"),
          endAt: new Date("2026-08-03T17:00:00Z"),
        }),
      ),
    ).toContain("end-not-after-start");
  });
  it("rejects a negative break", () => {
    expect(validateEntry(entry({ breakMinutes: -15 }))).toContain(
      "negative-break",
    );
  });
  it("rejects a break equal to the whole span", () => {
    expect(validateEntry(entry({ breakMinutes: 480 }))).toContain(
      "break-consumes-entire-time",
    );
  });
  it("rejects a break exceeding the span", () => {
    expect(validateEntry(entry({ breakMinutes: 600 }))).toContain(
      "break-consumes-entire-time",
    );
  });
  it("accepts a break one step below the span", () => {
    expect(validateEntry(entry({ breakMinutes: 465 }))).toEqual([]);
  });
  it("rejects a negative additional amount (D14/A6)", () => {
    expect(validateEntry(entry({ additionalPence: -1 }))).toContain(
      "negative-additional",
    );
  });
  it("collects multiple issues at once", () => {
    const issues = validateEntry(
      entry({
        startAt: new Date("2026-08-03T18:07:00Z"),
        breakMinutes: -5,
        additionalPence: -100,
      }),
    );
    expect(issues).toContain("start-not-on-15-minute-boundary");
    expect(issues).toContain("negative-break");
    expect(issues).toContain("negative-additional");
  });
});

describe("validateRates", () => {
  it("accepts positive integer rates", () => {
    expect(validateRates(rates)).toEqual([]);
  });
  it("rejects zero and negative rates", () => {
    expect(
      validateRates({ baseRatePence: 0, supervisorRatePence: -5 }),
    ).toEqual(["base-rate-not-positive", "supervisor-rate-not-positive"]);
  });
  it("rejects fractional pence", () => {
    expect(
      validateRates({ baseRatePence: 1200.5, supervisorRatePence: 1500 }),
    ).toEqual(["base-rate-not-positive"]);
  });
});

describe("rangesOverlap (D10)", () => {
  const at = (iso: string) => new Date(iso);

  it("allows touching boundaries — finish one shift, start the next", () => {
    expect(
      rangesOverlap(
        at("2026-08-03T09:00:00Z"),
        at("2026-08-03T17:00:00Z"),
        at("2026-08-03T17:00:00Z"),
        at("2026-08-04T01:00:00Z"),
      ),
    ).toBe(false);
  });
  it("detects partial overlap", () => {
    expect(
      rangesOverlap(
        at("2026-08-03T09:00:00Z"),
        at("2026-08-03T17:00:00Z"),
        at("2026-08-03T16:00:00Z"),
        at("2026-08-03T22:00:00Z"),
      ),
    ).toBe(true);
  });
  it("detects containment", () => {
    expect(
      rangesOverlap(
        at("2026-08-03T09:00:00Z"),
        at("2026-08-03T22:00:00Z"),
        at("2026-08-03T12:00:00Z"),
        at("2026-08-03T14:00:00Z"),
      ),
    ).toBe(true);
  });
  it("detects identical ranges", () => {
    expect(
      rangesOverlap(
        at("2026-08-03T09:00:00Z"),
        at("2026-08-03T17:00:00Z"),
        at("2026-08-03T09:00:00Z"),
        at("2026-08-03T17:00:00Z"),
      ),
    ).toBe(true);
  });
  it("detects overnight overlap across midnight", () => {
    expect(
      rangesOverlap(
        at("2026-08-03T22:00:00Z"),
        at("2026-08-04T06:00:00Z"),
        at("2026-08-04T05:00:00Z"),
        at("2026-08-04T13:00:00Z"),
      ),
    ).toBe(true);
  });
  it("clears disjoint ranges on different days", () => {
    expect(
      rangesOverlap(
        at("2026-08-03T09:00:00Z"),
        at("2026-08-03T17:00:00Z"),
        at("2026-08-04T09:00:00Z"),
        at("2026-08-04T17:00:00Z"),
      ),
    ).toBe(false);
  });
  it("clears same-day non-touching ranges (double shift with a gap)", () => {
    expect(
      rangesOverlap(
        at("2026-08-03T09:00:00Z"),
        at("2026-08-03T13:00:00Z"),
        at("2026-08-03T14:00:00Z"),
        at("2026-08-03T22:00:00Z"),
      ),
    ).toBe(false);
  });
});
