import type { Metadata, Viewport } from "next";
import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/permanent-marker/latin-400.css";
import "@fontsource/pirata-one/latin-400.css";
import "@fontsource/saira-stencil-one/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/cinzel/latin-400.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/crimson-pro/latin-400.css";
import "@fontsource/crimson-pro/latin-600.css";
import "@fontsource/uncial-antiqua/latin-400.css";
import "@fontsource/alegreya/latin-400.css";
import "@fontsource/alegreya/latin-700.css";
import "@fontsource/shippori-mincho/latin-400.css";
import "@fontsource/shippori-mincho/latin-700.css";
import "@fontsource/teko/latin-500.css";
import "@fontsource/teko/latin-600.css";
import "@fontsource/rajdhani/latin-500.css";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/oxanium/latin-500.css";
import "@fontsource/oxanium/latin-700.css";
import "@fontsource/vt323/latin-400.css";
import "@fontsource/share-tech-mono/latin-400.css";
import "@fontsource/major-mono-display/latin-400.css";
import "@fontsource/syne-mono/latin-400.css";
import "@fontsource/rubik-glitch/latin-400.css";
import "@fontsource/archivo/latin-400.css";
import "@fontsource/archivo/latin-600.css";
import "@fontsource/archivo/latin-700.css";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { FONT_BOOT } from "@/lib/style/catalog";

export const metadata: Metadata = {
  title: "Sixthdeck",
  description: "A cyberdeck for the Sixth World: searchable rules, a proper dice roller, guided runner creation and automated character sheets.",
};

export const viewport: Viewport = {
  themeColor: "#080a0e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Apply the saved theme before first paint so the page never flashes the wrong skin.
const THEME_BOOT = `try{var F=${JSON.stringify(FONT_BOOT)};var s=JSON.parse(localStorage.getItem('sixthdeck.settings')||'{}').state||{};var e=document.documentElement,d=e.dataset,st=e.style;["theme","motion","font","corners","density","backdrop","ornament","heads"].forEach(function(k){if(s[k])d[k]=s[k]});if(s.brackets===false&&!s.ornament)d.ornament='none';var f=F[s.font];var z=s.theme==='zaibatsu'&&(!s.font||s.font==='street');if(f||z){f=f||F.street;st.setProperty('--ff-display',z?F.terminal[0]:f[0]);st.setProperty('--ff-sans',f[1]);st.setProperty('--ff-ui',z?F.terminal[0]:f[2])}if(s.glyph)d.glyph='on';if(s.glyph)st.setProperty('--glyph',JSON.stringify(s.glyph+'\\uFE0E'));if(s.motifStrength!=null)st.setProperty('--motif-k',s.motifStrength);if(s.fontScale)st.setProperty('--font-scale',s.fontScale);if(s.customAccent)st.setProperty('--accent',s.customAccent)}catch(_){}`;

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
