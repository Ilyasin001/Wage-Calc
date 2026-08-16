import { prisma } from "@/lib/db";
import { signOut } from "@/auth";
import { Card, SecondaryButton } from "@/components/ui";
import { Icon } from "@/components/icon";

const PoundIcon = () => (
  <Icon name="payments" size={20} className="text-secondary" />
);
const LocationIcon = () => (
  <Icon name="location_on" size={20} className="text-secondary" />
);
const PersonIcon = () => (
  <Icon name="person" size={20} className="text-secondary" />
);
import { CompanyForm } from "./company-form";
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
    <div className="space-y-6 pt-4">
      <h1 className="text-[20px] font-semibold text-on-surface">Settings</h1>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-on-surface">
          <PersonIcon />
          Company
        </h2>
        <Card>
          <CompanyForm companyName={settings?.companyName ?? ""} />
        </Card>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-on-surface">
          <PoundIcon />
          Standard hourly rates
        </h2>
        <Card>
          <RatesForm
            baseRate={penceToInput(settings?.baseRatePence ?? 0)}
            supervisorRate={penceToInput(settings?.supervisorRatePence ?? 0)}
          />
        </Card>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-on-surface">
          <LocationIcon />
          Venues
        </h2>
        <LocationsManager
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-on-surface">
          <PersonIcon />
          Account
        </h2>
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
