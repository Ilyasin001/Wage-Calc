import { z } from "zod";

/**
 * Shared payload schema for the shift form (client builds it, server
 * validates). A shift holds one or more batches; a batch holds one or more
 * staff entries and supplies their default times.
 */

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

export const batchPayloadSchema = z.object({
  name: z.string().trim().max(60).optional(),
  startTime: z.string().regex(timeRe, "Invalid batch start time"),
  endTime: z.string().regex(timeRe, "Invalid batch finish time"),
  entries: z
    .array(shiftEntryPayloadSchema)
    .min(1, "Each batch needs at least one staff member")
    .max(200),
});

export const shiftPayloadSchema = z
  .object({
    date: z.string().regex(dateRe, "Invalid date"),
    locationId: z.string().optional(),
    newLocationName: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    startTime: z.string().regex(timeRe, "Invalid shift start time"),
    endTime: z.string().regex(timeRe, "Invalid shift finish time"),
    baseRatePence: z.number().int().positive("Base rate must be positive"),
    supervisorRatePence: z
      .number()
      .int()
      .positive("Supervisor rate must be positive"),
    batches: z
      .array(batchPayloadSchema)
      .min(1, "Add at least one batch")
      .max(20, "That is too many batches"),
  })
  .refine((s) => s.locationId || s.newLocationName, {
    message: "Choose a venue or enter a new one",
  })
  .refine((s) => s.batches.some((b) => b.entries.length > 0), {
    message: "Add at least one staff member",
  });

export type ShiftPayload = z.infer<typeof shiftPayloadSchema>;
export type BatchPayload = z.infer<typeof batchPayloadSchema>;
export type ShiftEntryPayload = z.infer<typeof shiftEntryPayloadSchema>;
