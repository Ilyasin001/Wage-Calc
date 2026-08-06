import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { auth } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Wage-Calc",
    template: "%s · Wage-Calc",
  },
  description: "Shift wage calculator and payroll record",
  appleWebApp: {
    capable: true,
    title: "Wage-Calc",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <main className="mx-auto max-w-lg px-4 pb-24 pt-4">{children}</main>
        {session?.user && <BottomNav />}
      </body>
    </html>
  );
}
