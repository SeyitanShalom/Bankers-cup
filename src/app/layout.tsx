import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@/components/analytics";
import { NavigationProvider } from "@/components/navigation-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteLoader } from "@/components/site-loader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bankers Cup",
  description: "Competition management website for the Bankers Cup football tournament.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full pt-32 lg:pt-16">
        <NavigationProvider>
          {/* Keep this boundary stable across navigation. A route loading.tsx
              would replace the page behind the transparent overlay too early. */}
          <Suspense fallback={<SiteLoader initial />}>
            <SiteHeader />
            {children}
            <SiteFooter />
            <Analytics />
          </Suspense>
        </NavigationProvider>
      </body>
    </html>
  );
}
