import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Memoria — Pages commémoratives",
    template: "%s — Memoria",
  },
  description: "Pages commémoratives accessibles par QR code.",
  // Aucune page n'est indexée tant que la politique de référencement n'est pas validée.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f5f2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
