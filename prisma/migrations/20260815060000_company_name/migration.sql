-- Company/account name, shown as the header on every PDF report.
-- Nullable so existing installs keep working until it is filled in.
ALTER TABLE "Settings" ADD COLUMN "companyName" TEXT;
