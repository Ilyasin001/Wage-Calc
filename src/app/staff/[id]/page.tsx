import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { setStaffActive, updateStaff } from "@/lib/actions/staff";
import { SecondaryButton } from "@/components/ui";
import { StaffForm } from "../staff-form";

export const metadata = { title: "Edit staff" };

export default async function EditStaffPage({
  params,
}: PageProps<"/staff/[id]">) {
  const { id } = await params;
  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) notFound();

  const update = updateStaff.bind(null, staff.id);
  const toggleActive = setStaffActive.bind(null, staff.id, !staff.isActive);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{staff.name}</h1>
        {!staff.isActive && (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Deactivated
          </span>
        )}
      </div>

      <StaffForm
        action={update}
        initial={{
          name: staff.name,
          phone: staff.phone ?? "",
          role: staff.role,
        }}
        submitLabel="Save changes"
      />

      <form
        action={async () => {
          "use server";
          await toggleActive();
        }}
        className="mt-6"
      >
        <SecondaryButton type="submit">
          {staff.isActive ? "Deactivate" : "Reactivate"}
        </SecondaryButton>
      </form>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {staff.isActive
          ? "Deactivated staff are hidden from new shifts but stay in all past records, and can be reactivated at any time."
          : "Reactivating makes this person available for new shifts again."}
      </p>
    </div>
  );
}
