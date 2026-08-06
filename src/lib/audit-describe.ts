import { formatPence, formatTime } from "@/lib/format";

/** Turns audit-log change JSON into accountant-readable lines (D17). */

type Change = { from: unknown; to: unknown };

function isChange(v: unknown): v is Change {
  return typeof v === "object" && v !== null && "from" in v && "to" in v;
}

function fmtValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (field.endsWith("Pence") || field === "additionalPence") {
    return formatPence(Number(v));
  }
  if (field.endsWith("At") && typeof v === "string") {
    return formatTime(new Date(v));
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

const fieldLabels: Record<string, string> = {
  date: "date",
  locationId: "venue",
  description: "description",
  startAt: "start time",
  endAt: "finish time",
  baseRatePence: "base rate",
  supervisorRatePence: "supervisor rate",
  breakMinutes: "break minutes",
  additionalPence: "additional amount",
  isSupervisor: "supervisor",
  paid: "paid",
  name: "name",
  phone: "phone",
  role: "role",
  isActive: "active",
};

export function describeAuditChanges(
  changesJson: string,
  staffNames: Map<string, string>,
  locationNames: Map<string, string>,
): string[] {
  let changes: Record<string, unknown>;
  try {
    changes = JSON.parse(changesJson);
  } catch {
    return [changesJson];
  }

  const nameOf = (id: unknown) => staffNames.get(String(id)) ?? "a staff member";
  const lines: string[] = [];

  for (const [field, value] of Object.entries(changes)) {
    if (field === "entryChanges" && Array.isArray(value)) {
      for (const raw of value) {
        const ec = raw as Record<string, unknown>;
        if ("addedStaffId" in ec) {
          lines.push(`Added ${nameOf(ec.addedStaffId)} to the shift`);
        } else if ("removedStaffId" in ec) {
          lines.push(`Removed ${nameOf(ec.removedStaffId)} from the shift`);
        } else if ("staffId" in ec) {
          const who = nameOf(ec.staffId);
          for (const [f, v] of Object.entries(ec)) {
            if (f === "staffId" || !isChange(v)) continue;
            lines.push(
              `${who}: ${fieldLabels[f] ?? f} ${fmtValue(f, v.from)} → ${fmtValue(f, v.to)}`,
            );
          }
        }
      }
      continue;
    }
    if (isChange(value)) {
      const from =
        field === "locationId"
          ? (locationNames.get(String(value.from)) ?? "—")
          : fmtValue(field, value.from);
      const to =
        field === "locationId"
          ? (locationNames.get(String(value.to)) ?? "—")
          : fmtValue(field, value.to);
      lines.push(`${fieldLabels[field] ?? field}: ${from} → ${to}`);
    }
  }
  return lines.length > 0 ? lines : ["Details recorded"];
}
