import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bebas_Neue, Inter } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { theme: true } })
    : null;
  const theme = (user?.theme ?? "PINK").toLowerCase();

  return (
    <html lang="en" data-theme={theme} className={`${bebasNeue.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-b2b-bg font-sans text-b2b-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
