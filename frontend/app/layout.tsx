import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans-body",
});

const display = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const DESCRIPTION = "Attendance, leave and payroll in one calm workspace. Built for HR teams that would rather talk to people than chase spreadsheets.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Rostra | HR, attendance, leave and payroll", template: "%s | Rostra" },
  description: DESCRIPTION,
  applicationName: "Rostra",
  manifest: "/manifest.webmanifest",
  openGraph: { title: "Rostra", description: DESCRIPTION, siteName: "Rostra", type: "website" },
  twitter: { card: "summary_large_image", title: "Rostra", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#f4f5ff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-800">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                className: "glass-card border-[var(--border)] text-[var(--foreground)]",
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
