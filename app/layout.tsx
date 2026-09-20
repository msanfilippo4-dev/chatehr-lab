import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fordham Practice EHR | HINF 6105",
  description: "A synthetic electronic health record for Fordham HINF 6105 coursework and demonstrations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
