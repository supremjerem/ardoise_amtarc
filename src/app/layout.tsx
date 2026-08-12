import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";

import { LARGE_TEXT_CLASS, LARGE_TEXT_KEY } from "@/lib/large-text";

import "./globals.css";

/*
 * next/font downloads and self-hosts the fonts at build time: no request to
 * Google Fonts in production, and no layout shift on load.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/* User-facing strings are French: the club's members are French speakers. */
export const metadata: Metadata = {
  title: "L'ardoise du club — AMTARC",
  description: "Consultez votre ardoise du bar du club et réglez vos consommations.",
  applicationName: "Ardoise AMTARC",
  appleWebApp: { capable: true, title: "Ardoise", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  /*
   * iOS ignores the web manifest's icons and looks for this one when someone
   * adds the app to their home screen.
   */
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf6f0",
  width: "device-width",
  initialScale: 1,
  // Never block zooming: it is an essential crutch for this audience.
  maximumScale: 5,
  viewportFit: "cover",
};

/**
 * Applies the "large text" preference before first paint. Without this the
 * page would flash at normal size then jump — jarring, and confusing for
 * someone who deliberately turned the option on.
 */
const APPLY_TEXT_SIZE_PREFERENCE = `
try {
  if (localStorage.getItem('${LARGE_TEXT_KEY}') === '1') {
    document.documentElement.classList.add('${LARGE_TEXT_CLASS}');
  }
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
      /*
       * The script below deliberately adds a class here before React runs, so
       * the server's markup and the browser's differ by design — that
       * difference IS the feature, since it is what stops the page painting at
       * the wrong size first. React would otherwise report it as a hydration
       * mismatch on every load for anyone using large text. Scoped to this
       * element's own attributes; it does not extend to the tree below.
       */
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_TEXT_SIZE_PREFERENCE }} />
      </head>
      <body className="bg-canvas text-ink flex min-h-full flex-col items-center">
        {/*
         * Lets a keyboard or screen-reader user jump the header — which on
         * the till carries several links before the content starts. Invisible
         * until focused, which is the one time it is wanted.
         */}
        <a
          href="#contenu"
          className="bg-ink text-surface rounded-field sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-4 focus:py-3 focus:text-base focus:font-semibold"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
