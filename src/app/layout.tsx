import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { TopAppBar } from "@/components/top-app-bar";
import { auth } from "@/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
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
  themeColor: "#f8f9ff",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  return (
    <html
      lang="en-GB"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-background font-sans text-[14px] leading-5 text-on-background">
        {session?.user && <TopAppBar />}
        <main
          className={`mx-auto w-full max-w-2xl px-5 pb-[100px] ${session?.user ? "pt-[60px]" : "pt-4"}`}
        >
          {children}
        </main>
        {session?.user && <BottomNav />}
      </body>
    </html>
  );
}
