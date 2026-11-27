import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROLAPRAK — Generator Laporan Praktikum",
  description: "Buat laporan praktikum secara terstruktur dengan bantuan AI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}