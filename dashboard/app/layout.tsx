import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Remote Camera Dashboard",
  description: "Remote monitoring dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}