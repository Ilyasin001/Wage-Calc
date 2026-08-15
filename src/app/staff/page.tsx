import { prisma } from "@/lib/db";
import { Fab } from "@/components/fab";
import { StaffList } from "./staff-list";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const staff = await prisma.staff.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="pt-4">
      <h1 className="mb-4 text-[20px] font-semibold text-on-surface">
        Staff Roster
      </h1>
      <StaffList
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          role: s.role,
          isActive: s.isActive,
        }))}
      />
      <Fab href="/staff/new" label="Add staff" />
    </div>
  );
}
