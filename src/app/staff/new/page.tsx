import { createStaff } from "@/lib/actions/staff";
import { StaffForm } from "../staff-form";

export const metadata = { title: "Add staff" };

export default function NewStaffPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Add staff member</h1>
      <StaffForm action={createStaff} submitLabel="Add staff member" />
    </div>
  );
}
