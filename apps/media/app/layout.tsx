import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RUNDINGAN MEDIA",
    template: "%s | RUNDINGAN MEDIA",
  },
  description:
    "Newsroom, editorial production, publishing, advertising, and audience operations.",
  applicationName: "RUNDINGAN MEDIA",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
