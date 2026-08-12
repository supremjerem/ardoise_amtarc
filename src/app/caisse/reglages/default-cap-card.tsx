"use client";

import { useState, useTransition } from "react";

import { updateDefaultCap } from "@/app/actions/settings";
import { useToast } from "@/app/caisse/toast";
import { centsToInputValue } from "@/lib/money";

import { SettingsCard } from "./settings-card";

/*
 * The cap a new member starts with.
 *
 * Changing it does not touch anyone already in the club: their caps were set
 * individually and moving them all at once would silently redraw who counts as
 * over their limit.
 */
export function DefaultCapCard({ defaultCapCents }: { defaultCapCents: number }) {
  const showToast = useToast();
  const [amount, setAmount] = useState(centsToInputValue(defaultCapCents));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateDefaultCap(amount);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      showToast(result.message);
    });
  }

  return (
    <SettingsCard
      title="Plafond par défaut"
      description="Appliqué aux nouveaux membres. Les plafonds déjà fixés ne changent pas."
    >
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="sr-only">Plafond par défaut en euros</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            className="border-line rounded-input bg-surface text-ink w-25 border px-3 py-2.25 text-base"
          />
          <span className="text-ink-soft text-base">€</span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-input bg-ink text-surface px-4 py-2.25 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-debt mt-2.5 text-sm font-semibold">
          {error}
        </p>
      )}
    </SettingsCard>
  );
}
