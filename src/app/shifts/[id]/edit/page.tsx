import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateShift } from "@/lib/actions/shifts";
import { utcToLondonTime } from "@/lib/time";
import { ShiftForm } from "@/components/shift-form";

export const metadata = { title: "Edit shift" };

function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}

export default async function EditShiftPage({
  params,
}: PageProps<"/shifts/[id]/edit">) {
  const { id } = await params;
  const [shift, staff, locations] = await Promise.all([
    prisma.shift.findUnique({
      where: { id },
      include: { entries: { include: { staff: true } } },
    }),
    prisma.staff.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!shift) notFound();

  // Deactivated staff stay pickable only if already on this shift.
  const staffIdsOnShift = new Set(shift.entries.map((e) => e.staffId));
  const options = staff
    .filter((s) => s.isActive || staffIdsOnShift.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, role: s.role }));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Edit shift</h1>
      <ShiftForm
        action={updateShift.bind(null, shift.id)}
        staff={options}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        initial={{
          date: shift.date,
          locationId: shift.locationId,
          description: shift.description ?? "",
          startTime: utcToLondonTime(shift.startAt),
          endTime: utcToLondonTime(shift.endAt),
          baseRate: penceToInput(shift.baseRatePence),
          supervisorRate: penceToInput(shift.supervisorRatePence),
          entries: shift.entries.map((e) => ({
            staffId: e.staffId,
            isSupervisor: e.isSupervisor === true,
            startTime: utcToLondonTime(e.startAt),
            endTime: utcToLondonTime(e.endAt),
            breakMinutes: e.breakMinutes,
            additional: e.additionalPence
              ? (e.additionalPence / 100).toFixed(2)
              : "",
          })),
        }}
        submitLabel="Save changes"
        lockedStaffIds={shift.entries
          .filter((e) => e.paid)
          .map((e) => e.staffId)}
      />
    </div>
  );
}
