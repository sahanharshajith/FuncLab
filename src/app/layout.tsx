import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FuncLab — Function Calculator & Graphing Platform",
  description:
    "Define mathematical functions, auto-detect variables, evaluate multiple functions at once and explore them with interactive 2D, polar, parametric, implicit and 3D graphs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
