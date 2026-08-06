import Link from "next/link";
import { prisma } from "@/lib/db";
import { StaffList } from "./staff-list";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const staff = await prisma.staff.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Staff</h1>
        <Link
          href="/staff/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Add staff
        </Link>
      </div>
      <StaffList
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          role: s.role,
          isActive: s.isActive,
        }))}
      />
    </div>
  );
}
