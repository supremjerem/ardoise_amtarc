import { redirect } from "next/navigation";

import { requireMember } from "@/lib/auth";

/*
 * The root has no screen of its own: it hands over to the right home page.
 * A till manager starts on the till, everyone else on their own slate — and
 * `requireMember` sends anyone not signed in to /connexion.
 */
export default async function Page() {
  const member = await requireMember();
  redirect(member.isAdmin ? "/caisse" : "/moi");
}
