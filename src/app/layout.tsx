import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
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
  if (localStorage.getItem('ardoise:large-text') === '1') {
    document.documentElement.classList.add('large-text');
  }
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} ${poppins.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_TEXT_SIZE_PREFERENCE }} />
      </head>
      <body className="bg-canvas text-ink flex min-h-full flex-col items-center">{children}</body>
    </html>
  );
}
