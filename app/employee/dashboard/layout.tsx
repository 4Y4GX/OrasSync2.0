import type { ReactNode } from "react";
import "./dashboard.css";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default function EmployeeDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`${inter.variable} ${space.variable} ${jetbrains.variable}`}>
      {children}
    </div>
  );
}
