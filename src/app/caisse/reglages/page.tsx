import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { listActiveTariffs } from "@/lib/ledger";
import { listManagers } from "@/lib/members";
import { readSettings } from "@/lib/settings";

import { DefaultCapCard } from "./default-cap-card";
import { ManagersCard } from "./managers-card";
import { SettingsCard } from "./settings-card";
import { TariffsCard } from "./tariffs-card";

export const metadata: Metadata = {
  title: "Réglages — Caisse du club",
};

/*
 * What the club can change about itself: the cap a new member starts with, the
 * quick-price buttons behind the bar, and who holds the till.
 */
export default async function Page() {
  await requireAdmin();

  const [settings, tariffs, managers] = await Promise.all([
    readSettings(),
    listActiveTariffs(),
    listManagers(),
  ]);

  return (
    <main id="contenu" className="flex w-full max-w-190 flex-col px-5 pb-25">
      <header className="flex items-center gap-2.5 px-0.5 pt-6 pb-4.5">
        <Link
          href="/caisse"
          aria-label="Retour à la caisse"
          className="text-ink-soft inline-flex min-h-11 items-center px-1 text-xl"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-lg font-semibold">Réglages</h1>
      </header>

      <DefaultCapCard defaultCapCents={settings.defaultCapCents} />
      <TariffsCard tariffs={tariffs} />
      <ManagersCard managers={managers} defaultCapCents={settings.defaultCapCents} />

      <SettingsCard
        title="Grand livre"
        description="Toutes les écritures du club, écritures annulées comprises, à imprimer ou à ouvrir dans un tableur."
      >
        <Link
          href="/caisse/grand-livre"
          className="rounded-field bg-ink text-surface inline-flex min-h-11 items-center px-4.5 text-sm font-semibold"
        >
          Imprimer / exporter
        </Link>
      </SettingsCard>
    </main>
  );
}
