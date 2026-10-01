import type { Metadata, Viewport } from "next";
import { DM_Sans, Figtree, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import ThemeStyle from "@/components/ThemeStyle";
import { STYLE_CSS, THEME_BOOT_SCRIPT } from "@/lib/palettes";
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
      data-style="A"
      suppressHydrationWarning
      className={`${jakarta.variable} ${dmSans.variable} ${grotesk.variable} ${figtree.variable} h-full antialiased`}
    >
      <head>
        {/* Platz für die Styles von FullCalendar: Ohne ihn fügt FullCalendar ein eigenes
            <style> vor unserem ein, und React meldet beim Hydrieren einen Unterschied.
            Next.js setzt globals.css davor: Überschreibungen von FullCalendar-Regeln dort
            brauchen also eine höhere Spezifität als die Originalregel */}
        <style data-fullcalendar="" />
        <style dangerouslySetInnerHTML={{ __html: STYLE_CSS }} />
        {/* Gespeicherten Stil vor dem ersten Zeichnen setzen (kein Aufblitzen) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeStyle />
        {children}
      </body>
    </html>
  );
}
