"use client";

import Link from "next/link";
import { useState } from "react";

import { MemberModal } from "@/app/caisse/member-modal";
import { Avatar } from "@/components/avatar";

import { AddButton, SettingsCard } from "./settings-card";

/*
 * Who holds the till.
 *
 * Read-only here, on purpose: promoting or demoting someone happens on their
 * own record, where the code that comes with the role can be set at the same
 * time. This card answers "who has the keys?" and offers the one thing that
 * has no other home — creating a manager from scratch.
 */

export function ManagersCard({
  managers,
  defaultCapCents,
}: {
  managers: { id: string; name: string; avatarColorIndex: number }[];
  defaultCapCents: number;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <SettingsCard
      title="Responsables de caisse"
      description="Chaque action de caisse est enregistrée au nom de son auteur."
      action={<AddButton onClick={() => setCreating(true)} label="Ajouter un responsable" />}
    >
      <ul className="flex flex-col">
        {managers.map((manager) => (
          <li key={manager.id}>
            <Link
              href={`/caisse/membre/${manager.id}`}
              className="hover:bg-hover rounded-field -mx-2 flex items-center gap-3 px-2 py-2 transition-colors"
            >
              <Avatar name={manager.name} colorIndex={manager.avatarColorIndex} size="sm" />
              <span className="text-base font-medium">{manager.name}</span>
            </Link>
          </li>
        ))}
      </ul>

      {creating && (
        <MemberModal
          onClose={() => setCreating(false)}
          defaultCapCents={defaultCapCents}
          initialIsAdmin
        />
      )}
    </SettingsCard>
  );
}
