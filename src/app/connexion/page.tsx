import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LargeTextToggle } from "@/components/large-text-toggle";
import { listMembersForLogin } from "@/lib/members";
import { readCurrentMember } from "@/lib/session";

import { LoginFlow } from "./login-flow";

export const metadata: Metadata = {
  title: "Connexion — L'ardoise du club",
};

/*
 * The member list is read on every visit rather than cached: a member added
 * behind the bar has to appear on the next person's screen, not on the next
 * deployment.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  /*
   * Whoever is genuinely signed in has no business here. Checked against the
   * database rather than against the cookie, so a stale cookie leaves the
   * login screen reachable instead of bouncing between two redirects.
   */
  const signedIn = await readCurrentMember();
  if (signedIn) redirect(signedIn.isAdmin ? "/caisse" : "/moi");

  const members = await listMembersForLogin();

  return (
    <main id="contenu" className="flex min-h-full w-full max-w-110 flex-col px-5 pb-10">
      <header className="px-1 pt-14 pb-7 text-center">
        <p className="font-display text-brand-letters text-md font-bold tracking-[0.125em]">
          AMTARC
        </p>
        <h1 className="font-display mt-1.5 text-2xl font-semibold">L&apos;ardoise du club</h1>
      </header>

      <LoginFlow members={members} />

      {/*
       * Reachable before signing in on purpose: someone who needs bigger text
       * needs it to read this screen, not once they are past it.
       */}
      <div className="mt-5 flex justify-center">
        <LargeTextToggle />
      </div>
    </main>
  );
}
