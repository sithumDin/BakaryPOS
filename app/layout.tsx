import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { APP_BRANDING } from "@/lib/branding";

export const metadata: Metadata = {
  title: APP_BRANDING.name,
  description: APP_BRANDING.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
