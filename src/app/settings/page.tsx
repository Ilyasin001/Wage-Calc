import { prisma } from "@/lib/db";
import { signOut } from "@/auth";
import { Card, SecondaryButton } from "@/components/ui";
import { RatesForm } from "./rates-form";
import { LocationsManager } from "./locations-manager";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Settings" };

function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}

export default async function SettingsPage() {
  const [settings, locations] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section>
        <h2 className="mb-2 font-medium">Standard hourly rates</h2>
        <Card>
          <RatesForm
            baseRate={penceToInput(settings?.baseRatePence ?? 0)}
            supervisorRate={penceToInput(settings?.supervisorRatePence ?? 0)}
          />
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Venues</h2>
        <LocationsManager
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </section>

      <section>
        <h2 className="mb-2 font-medium">Account</h2>
        <Card>
          <PasswordForm />
        </Card>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="mt-3"
        >
          <SecondaryButton type="submit">Sign out</SecondaryButton>
        </form>
      </section>
    </div>
  );
}
