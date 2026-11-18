import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

/* Polices auto-hébergées par Next.js (aucune requête vers Google côté visiteur). */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

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
  themeColor: "#f3f6fc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`h-full ${inter.variable} ${cormorant.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
