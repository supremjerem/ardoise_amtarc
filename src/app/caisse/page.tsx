import Link from "next/link";

import { logOut } from "@/app/actions/auth";
import { requireAdmin } from "@/lib/auth";

/*
 * PLACEHOLDER — the till dashboard (totals, member list, transaction modal) is
 * still to come. Stubbed for the same reason as /moi: the login flow needs a
 * destination, and the guard belongs here from day one.
 */
export default async function Page() {
  const member = await requireAdmin();

  return (
    <main className="flex w-full max-w-115 flex-col gap-4 px-5 py-6">
      <p className="font-display text-brand-letters text-label font-bold tracking-[0.125em]">
        AMTARC
      </p>
      <h1 className="font-display text-xl font-semibold">Caisse du club</h1>

      <p className="text-ink-soft text-base">
        Connecté en tant que {member.name}. Le tableau de bord s&apos;affichera ici.
      </p>

      <Link href="/moi" className="text-accent-ink text-base font-semibold">
        Mon ardoise
      </Link>

      <form action={logOut}>
        <button type="submit" className="text-ink-soft text-base font-semibold">
          Déconnexion
        </button>
      </form>
    </main>
  );
}
