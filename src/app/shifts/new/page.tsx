import { prisma } from "@/lib/db";
import { createShift } from "@/lib/actions/shifts";
import { todayLondon } from "@/lib/time";
import { ShiftForm } from "@/components/shift-form";

export const metadata = { title: "New shift" };

function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}

export default async function NewShiftPage() {
  const [settings, staff, locations] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <ShiftForm
        action={createShift}
        staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        initial={{
          date: todayLondon(),
          locationId: locations.length === 0 ? "__new__" : "",
          description: "",
          startTime: "18:00",
          endTime: "23:00",
          baseRate: penceToInput(settings?.baseRatePence ?? 0),
          supervisorRate: penceToInput(settings?.supervisorRatePence ?? 0),
          entries: [],
        }}
        submitLabel="Save shift"
      />
    </div>
  );
}
