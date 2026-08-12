"use client";

import { useState } from "react";

import type { LoginMember } from "@/lib/members";

import { MemberPicker } from "./member-picker";
import { PinStep } from "./pin-step";

/*
 * Signing in, in two steps: pick your name, then type your code.
 *
 * No identifier to remember and no keyboard to fight with — the whole point
 * for an audience that mostly signs in on a phone, standing at the bar.
 *
 * The state machine lives on the client so the two steps swap instantly. It
 * grants nothing: authentication happens server-side, in the `logIn` action.
 */

export function LoginFlow({ members }: { members: LoginMember[] }) {
  const [selected, setSelected] = useState<LoginMember | null>(null);

  if (!selected) {
    return <MemberPicker members={members} onPick={setSelected} />;
  }

  return (
    <PinStep
      /* Remount on a change of member: no stale digits, no stale error. */
      key={selected.id}
      member={selected}
      onBack={() => setSelected(null)}
    />
  );
}
