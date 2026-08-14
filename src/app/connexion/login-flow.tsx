"use client";

import { useState } from "react";

import type { LoginCandidate } from "@/app/actions/auth";

import { MemberPicker } from "./member-picker";
import { PinStep } from "./pin-step";

/*
 * Signing in, in two steps: type a couple of letters of your name, then your
 * code. No identifier to remember and no password to invent — the whole point
 * for an audience that mostly signs in on a phone, standing at the bar.
 *
 * The state machine lives on the client so the two steps swap instantly. It
 * grants nothing: names are searched server-side and the code is checked by
 * the `logIn` action.
 */

export function LoginFlow() {
  const [selected, setSelected] = useState<LoginCandidate | null>(null);

  if (!selected) return <MemberPicker onPick={setSelected} />;

  return (
    <PinStep
      /* Remount on a change of member: no stale digits, no stale error. */
      key={selected.id}
      member={selected}
      onBack={() => setSelected(null)}
    />
  );
}
