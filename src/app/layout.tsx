import type { Metadata, Viewport } from "next";
import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Sixthdeck",
  description: "A cyberdeck for the Sixth World: searchable rules, a proper dice roller, guided runner creation and automated character sheets.",
};

export const viewport: Viewport = {
  themeColor: "#080a0e",
  width: "device-width",
  initialScale: 1,
};

// Apply the saved theme before first paint so the page never flashes the wrong skin.
const THEME_BOOT = `try{var s=JSON.parse(localStorage.getItem('sixthdeck.settings')||'{}').state||{};var e=document.documentElement;if(s.theme)e.dataset.theme=s.theme;if(s.motion)e.dataset.motion=s.motion;if(s.fontScale)e.style.setProperty('--font-scale',s.fontScale);if(s.customAccent)e.style.setProperty('--accent',s.customAccent)}catch(_){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
