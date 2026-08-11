import { logOut } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { requireMember } from "@/lib/auth";

/*
 * PLACEHOLDER — "Mon ardoise" proper (balance card, cap gauge, history) is the
 * next item on the roadmap. This stub exists so the login flow lands somewhere
 * real, and to keep the guard in place from the start.
 */
export default async function Page() {
  const member = await requireMember();

  return (
    <main className="flex w-full max-w-115 flex-col gap-4 px-5 py-6">
      <div className="flex items-center gap-2.5">
        <Avatar name={member.name} colorIndex={member.avatarColorIndex} size="sm" />
        <p className="text-md font-semibold">{member.name}</p>
      </div>

      <p className="text-ink-soft text-base">Votre ardoise s&apos;affichera ici.</p>

      <form action={logOut}>
        <button type="submit" className="text-ink-soft text-base font-semibold">
          Déconnexion
        </button>
      </form>
    </main>
  );
}
