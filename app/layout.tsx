import type { Metadata, Viewport } from "next";
import { DM_Sans, Figtree, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import ThemeStyle from "@/components/ThemeStyle";
import "./globals.css";

// Schriften der drei Stile; next/font liefert sie vom eigenen Server aus (keine Google-Anfrage im Browser)
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dmsans", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kalender",
  description: "Mein persönlicher Kalender",
  // iPhone: vom Home-Bildschirm aus ohne Safari-Leiste starten
  appleWebApp: {
    capable: true,
    title: "Kalender",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f9fafb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${jakarta.variable} ${dmSans.variable} ${grotesk.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeStyle />
        {children}
      </body>
    </html>
  );
}
