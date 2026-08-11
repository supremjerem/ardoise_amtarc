import type { Metadata } from "next";

import { listMembersForLogin } from "@/lib/members";

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
  const members = await listMembersForLogin();

  return (
    <main className="flex min-h-full w-full max-w-110 flex-col px-5 pb-10">
      <header className="px-1 pt-14 pb-7 text-center">
        <p className="font-display text-brand-letters text-md font-bold tracking-[0.125em]">
          AMTARC
        </p>
        <h1 className="font-display mt-1.5 text-2xl font-semibold">L&apos;ardoise du club</h1>
      </header>

      <LoginFlow members={members} />
    </main>
  );
}
