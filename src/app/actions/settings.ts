"use server";

import { eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { settings, tariffs } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { requireAdminAction } from "@/lib/auth";
import { MAX_AMOUNT_CENTS, parseMoney } from "@/lib/money";

/*
 * The club's own settings: what a new member's cap starts at, and the
 * quick-price buttons behind the bar.
 *
 * Every export is a public network endpoint and begins by proving the caller
 * manages the till.
 */

const tariffId = z.uuid({ message: "Tarif introuvable." });

const tariffInput = z.object({
  label: z.string().trim().min(1, "Donnez un nom à ce tarif.").max(40, "Ce nom est trop long."),
  amount: z.string(),
});

export type TariffInput = z.input<typeof tariffInput>;

/**
 * Sets the cap new members start with.
 *
 * Existing members keep theirs: this is a starting point for the next arrival,
 * not a club-wide reset that would silently move everyone's alert threshold.
 */
export async function updateDefaultCap(amount: string): Promise<ActionResult> {
  await requireAdminAction();

  const cents = parseMoney(amount);
  if (cents === null) return { ok: false, message: "Plafond invalide. Exemple : 25" };
  if (cents > MAX_AMOUNT_CENTS) return { ok: false, message: "Ce plafond paraît trop élevé." };

  await db
    .update(settings)
    .set({ defaultCapCents: cents, updatedAt: new Date() })
    .where(eq(settings.id, 1));

  revalidatePath("/caisse/reglages");
  revalidatePath("/caisse");

  return { ok: true, message: "Plafond par défaut enregistré." };
}

/** Adds a quick-price button, at the end of the row. */
export async function createTariff(input: TariffInput): Promise<ActionResult> {
  await requireAdminAction();

  const parsed = tariffInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const amountCents = parseMoney(parsed.data.amount);
  if (amountCents === null) return { ok: false, message: "Montant invalide. Exemple : 3,50" };
  if (amountCents <= 0) return { ok: false, message: "Le montant doit être supérieur à zéro." };
  if (amountCents > MAX_AMOUNT_CENTS)
    return { ok: false, message: "Ce montant paraît trop élevé." };

  /* New buttons go after the existing ones rather than reshuffling the row. */
  const [{ highest }] = await db.select({ highest: max(tariffs.sortOrder) }).from(tariffs);

  await db.insert(tariffs).values({
    label: parsed.data.label,
    amountCents,
    sortOrder: (highest ?? -1) + 1,
  });

  revalidateTariffs();

  return { ok: true, message: `« ${parsed.data.label} » a été ajouté.` };
}

/** Renames a quick-price button or changes its amount. */
export async function updateTariff(id: string, input: TariffInput): Promise<ActionResult> {
  await requireAdminAction();

  const parsedId = tariffId.safeParse(id);
  if (!parsedId.success) return { ok: false, message: parsedId.error.issues[0].message };

  const parsed = tariffInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const amountCents = parseMoney(parsed.data.amount);
  if (amountCents === null) return { ok: false, message: "Montant invalide. Exemple : 3,50" };
  if (amountCents <= 0) return { ok: false, message: "Le montant doit être supérieur à zéro." };
  if (amountCents > MAX_AMOUNT_CENTS)
    return { ok: false, message: "Ce montant paraît trop élevé." };

  const [existing] = await db
    .select({ id: tariffs.id })
    .from(tariffs)
    .where(eq(tariffs.id, parsedId.data))
    .limit(1);

  if (!existing) return { ok: false, message: "Tarif introuvable." };

  await db
    .update(tariffs)
    .set({ label: parsed.data.label, amountCents })
    .where(eq(tariffs.id, existing.id));

  revalidateTariffs();

  return { ok: true, message: `« ${parsed.data.label} » a été modifié.` };
}

/**
 * Retires a quick-price button.
 *
 * Deactivated, not deleted: entries recorded with it keep their note, and a
 * drink that comes back next season can be reactivated in the database rather
 * than reinvented. The price of a past round must not move because a tariff
 * changed today.
 */
export async function retireTariff(id: string): Promise<ActionResult> {
  await requireAdminAction();

  const parsedId = tariffId.safeParse(id);
  if (!parsedId.success) return { ok: false, message: parsedId.error.issues[0].message };

  const [existing] = await db
    .select({ id: tariffs.id, label: tariffs.label })
    .from(tariffs)
    .where(eq(tariffs.id, parsedId.data))
    .limit(1);

  if (!existing) return { ok: false, message: "Tarif introuvable." };

  await db.update(tariffs).set({ isActive: false }).where(eq(tariffs.id, existing.id));

  revalidateTariffs();

  return { ok: true, message: `« ${existing.label} » a été retiré.` };
}

/** The tariffs show on the settings screen and in the transaction dialog. */
function revalidateTariffs(): void {
  revalidatePath("/caisse/reglages");
  revalidatePath("/caisse");
  revalidatePath("/caisse/membre", "layout");
}
