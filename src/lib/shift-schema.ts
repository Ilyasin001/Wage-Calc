import { z } from "zod";

/** Shared payload schema for the shift form (client builds it, server validates). */

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const shiftEntryPayloadSchema = z.object({
  staffId: z.string().min(1),
  isSupervisor: z.boolean(),
  startTime: z.string().regex(timeRe, "Invalid time"),
  endTime: z.string().regex(timeRe, "Invalid time"),
  breakMinutes: z
    .number()
    .int()
    .min(0, "Break cannot be negative")
    .max(23 * 60, "Break is too long"),
  additionalPence: z
    .number()
    .int()
    .min(0, "Additional amount cannot be negative")
    .max(1_000_000, "Additional amount is too large"),
});

export const shiftPayloadSchema = z
  .object({
    date: z.string().regex(dateRe, "Invalid date"),
    locationId: z.string().optional(),
    newLocationName: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    startTime: z.string().regex(timeRe, "Invalid shift start time"),
    endTime: z.string().regex(timeRe, "Invalid shift end time"),
    baseRatePence: z.number().int().positive("Base rate must be positive"),
    supervisorRatePence: z
      .number()
      .int()
      .positive("Supervisor rate must be positive"),
    entries: z
      .array(shiftEntryPayloadSchema)
      .min(1, "Add at least one staff member")
      .max(200),
  })
  .refine((s) => s.locationId || s.newLocationName, {
    message: "Choose a venue or enter a new one",
  });

export type ShiftPayload = z.infer<typeof shiftPayloadSchema>;
export type ShiftEntryPayload = z.infer<typeof shiftEntryPayloadSchema>;
