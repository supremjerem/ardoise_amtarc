import type { MetadataRoute } from "next";

/*
 * Makes the app installable from the browser — "ajouter à l'écran d'accueil"
 * — which is how the club gets an app without an app store, as the handoff
 * asks. Served at /manifest.webmanifest, which proxy.ts already lets through.
 *
 * There is deliberately NO service worker. The obvious one would cache pages
 * for offline use, and every page here shows a balance: a cached slate is a
 * WRONG slate, and someone reading "vous devez 12 €" from last Tuesday is
 * worse off than someone who sees the browser say it cannot connect. Should
 * offline support ever be wanted, it needs a decision about what is safe to
 * show stale, and that belongs in an ADR rather than in a caching rule.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "L'ardoise du club — AMTARC",
    /* What fits under an icon on a home screen. */
    short_name: "Ardoise",
    description: "Consultez votre ardoise du bar du club et réglez vos consommations.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    /* Opens without browser chrome, like an installed app. */
    display: "standalone",
    background_color: "#faf6f0",
    theme_color: "#faf6f0",
    /*
     * No orientation lock: the till is used on a phone held upright and on a
     * laptop, and forcing one would break the other.
     */
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /*
       * Android crops an icon to the launcher's own shape. The artwork keeps
       * its subject well inside the safe circle, so the same file serves.
       */
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
