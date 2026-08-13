"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { members } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { requireAdminAction } from "@/lib/auth";
import { AVATAR_PALETTE_SIZE } from "@/lib/avatar";
import { MAX_AMOUNT_CENTS, parseMoney } from "@/lib/money";
import { hashPin, requiredPinLength, validatePin } from "@/lib/pin";
import { destroyMemberSessions } from "@/lib/session";

/*
 * Member records: creating them, editing them, and retiring them.
 *
 * Every export is a public network endpoint and begins by proving the caller
 * manages the till.
 */

const memberInput = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(80, "Ce nom est trop long."),
  licenceNumber: z.string().trim().max(30).optional(),
  email: z.union([z.literal(""), z.email("Cette adresse e-mail n'est pas valide.")]).optional(),
  phone: z.string().trim().max(30).optional(),
  cap: z.string(),
  isAdmin: z.boolean(),
  /* Empty on edit means "leave the current code alone". */
  pin: z.string().optional(),
});

export type MemberInput = z.input<typeof memberInput>;

/** Normalises an optional text field: blank becomes absent, not "". */
function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Reads the cap, which is typed in euros and stored in cents. */
function readCap(input: string): { ok: true; cents: number } | { ok: false; message: string } {
  const cents = parseMoney(input);
  if (cents === null) return { ok: false, message: "Plafond invalide. Exemple : 25" };
  if (cents > MAX_AMOUNT_CENTS) return { ok: false, message: "Ce plafond paraît trop élevé." };
  return { ok: true, cents };
}

/** Creates a member and the code they will sign in with. */
export async function createMember(input: MemberInput): Promise<ActionResult> {
  const manager = await requireAdminAction();

  const parsed = memberInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const cap = readCap(parsed.data.cap);
  if (!cap.ok) return cap;

  const pin = parsed.data.pin ?? "";
  const pinCheck = validatePin(pin, parsed.data.isAdmin);
  if (!pinCheck.ok) return { ok: false, message: pinCheck.message };

  /*
   * The palette rotates on the number of members, so consecutive arrivals do
   * not land on the same colour.
   */
  const [{ total }] = await db.select({ total: count() }).from(members);

  await db.insert(members).values({
    name: parsed.data.name.trim(),
    licenceNumber: optionalText(parsed.data.licenceNumber),
    email: optionalText(parsed.data.email),
    phone: optionalText(parsed.data.phone),
    isAdmin: parsed.data.isAdmin,
    pinHash: await hashPin(pin),
    capCents: cap.cents,
    avatarColorIndex: total % AVATAR_PALETTE_SIZE,
  });

  await recordAudit({
    actorId: manager.id,
    action: "member.create",
    entity: "member",
    payload: { name: parsed.data.name.trim(), isAdmin: parsed.data.isAdmin, capCents: cap.cents },
  });

  revalidatePath("/caisse");
  revalidatePath("/connexion");

  return { ok: true, message: `${parsed.data.name.trim()} a été ajouté.` };
}

/**
 * Edits a member.
 *
 * Two rules that only show up here:
 *
 *  - Promoting someone to till manager lengthens the code they need, from four
 *    digits to six. Their existing four-digit code cannot carry over, so a new
 *    one has to be set in the same breath.
 *  - The last till manager cannot be demoted. Nobody would be left who could
 *    put it back, and the club would be locked out of its own till.
 */
export async function updateMember(memberId: string, input: MemberInput): Promise<ActionResult> {
  const manager = await requireAdminAction();

  const id = z.uuid().safeParse(memberId);
  if (!id.success) return { ok: false, message: "Membre introuvable." };

  const parsed = memberInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const cap = readCap(parsed.data.cap);
  if (!cap.ok) return cap;

  const [existing] = await db
    .select({ id: members.id, name: members.name, isAdmin: members.isAdmin })
    .from(members)
    .where(and(eq(members.id, id.data), isNull(members.archivedAt)))
    .limit(1);

  if (!existing) return { ok: false, message: "Membre introuvable." };

  if (existing.isAdmin && !parsed.data.isAdmin && (await isLastManager(existing.id))) {
    return {
      ok: false,
      message: "Il doit rester au moins un responsable de caisse. Nommez-en un autre d'abord.",
    };
  }

  const pin = parsed.data.pin?.trim() ?? "";
  const roleChanged = existing.isAdmin !== parsed.data.isAdmin;

  if (!pin && roleChanged) {
    const digits = requiredPinLength(parsed.data.isAdmin);
    return {
      ok: false,
      message: `Ce changement de rôle demande un nouveau code à ${digits} chiffres.`,
    };
  }

  if (pin) {
    const pinCheck = validatePin(pin, parsed.data.isAdmin);
    if (!pinCheck.ok) return { ok: false, message: pinCheck.message };
  }

  await db
    .update(members)
    .set({
      name: parsed.data.name.trim(),
      licenceNumber: optionalText(parsed.data.licenceNumber),
      email: optionalText(parsed.data.email),
      phone: optionalText(parsed.data.phone),
      isAdmin: parsed.data.isAdmin,
      capCents: cap.cents,
      updatedAt: new Date(),
      ...(pin ? { pinHash: await hashPin(pin) } : {}),
    })
    .where(eq(members.id, existing.id));

  /* A new code must not leave old sessions signed in on the old one. */
  if (pin) await destroyMemberSessions(existing.id);

  /*
   * `pinChanged` records THAT the code moved, never what it became. The whole
   * point of hashing it is that nothing else stores it.
   */
  await recordAudit({
    actorId: manager.id,
    action: roleChanged ? "member.role-change" : "member.update",
    entity: "member",
    entityId: existing.id,
    payload: {
      name: parsed.data.name.trim(),
      isAdmin: parsed.data.isAdmin,
      wasAdmin: existing.isAdmin,
      capCents: cap.cents,
      pinChanged: Boolean(pin),
    },
  });

  revalidatePath("/caisse");
  revalidatePath(`/caisse/membre/${existing.id}`);
  revalidatePath("/connexion");
  revalidatePath("/moi");

  return { ok: true, message: `${parsed.data.name.trim()} a été modifié.` };
}

/**
 * Retires a member from the club.
 *
 * Archived, never deleted: their entries are accounting records and stay in
 * the ledger (docs/adr/0005). They stop appearing anywhere, their sessions are
 * closed, and their balance leaves the totals.
 */
export async function archiveMember(memberId: string): Promise<ActionResult> {
  const manager = await requireAdminAction();

  const id = z.uuid().safeParse(memberId);
  if (!id.success) return { ok: false, message: "Membre introuvable." };

  if (id.data === manager.id) {
    return { ok: false, message: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  const [existing] = await db
    .select({ id: members.id, name: members.name, isAdmin: members.isAdmin })
    .from(members)
    .where(and(eq(members.id, id.data), isNull(members.archivedAt)))
    .limit(1);

  if (!existing) return { ok: false, message: "Membre introuvable." };

  if (existing.isAdmin && (await isLastManager(existing.id))) {
    return { ok: false, message: "Il doit rester au moins un responsable de caisse." };
  }

  await db
    .update(members)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(members.id, existing.id));

  await destroyMemberSessions(existing.id);

  await recordAudit({
    actorId: manager.id,
    action: "member.archive",
    entity: "member",
    entityId: existing.id,
    payload: { name: existing.name, wasAdmin: existing.isAdmin },
  });

  revalidatePath("/caisse");
  revalidatePath("/connexion");

  return { ok: true, message: `${existing.name} a été supprimé.` };
}

/** Is this the only till manager left standing? */
async function isLastManager(memberId: string): Promise<boolean> {
  const [{ others }] = await db
    .select({ others: count() })
    .from(members)
    .where(and(eq(members.isAdmin, true), isNull(members.archivedAt), ne(members.id, memberId)));

  return others === 0;
}
