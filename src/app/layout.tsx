import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bebas_Neue, Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas-neue",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Box 2 Box",
  description: "Connecting CrossFit Athletes",
  // Opened from the iPhone home screen, run full-screen like an app rather
  // than as a Safari tab (Android reads the same from src/app/manifest.ts).
  appleWebApp: {
    capable: true,
    title: "Box 2 Box",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f0ed" },
    { media: "(prefers-color-scheme: dark)", color: "#28282c" },
  ],
  // Lets the page use the full screen on notched phones; the safe-area
  // padding on <body> and BottomTabBar keeps content clear of the notch and
  // home indicator.
  viewportFit: "cover",
};

// Runs before first paint so a manually-chosen (not just system) theme never
// flashes the wrong mode — see ThemeToggle, which writes the same localStorage
// key and keeps this in sync while the app is open.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-b2b-page pt-[env(safe-area-inset-top)] font-sans text-b2b-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
