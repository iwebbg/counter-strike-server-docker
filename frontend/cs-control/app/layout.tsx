import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "CS 1.6 Server CP";
export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description: "Self-hosted Counter-Strike 1.6 fleet control panel.",
  applicationName: appName,
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07100e" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bg">
      <body>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
