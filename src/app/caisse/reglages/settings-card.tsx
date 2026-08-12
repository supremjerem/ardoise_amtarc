/*
 * The panel every settings block sits in: a title, a line explaining what the
 * setting actually does, and the control itself.
 *
 * The explanation is not decoration. "Plafond par défaut" alone does not say
 * whether changing it moves everybody's alert threshold, which is exactly what
 * someone hesitates over before touching it.
 */
export function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  /** Optional control on the title row, such as "+ Ajouter". */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface rounded-panel mb-4 p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>

      {description && <p className="text-ink-soft text-label mb-3">{description}</p>}

      {children}
    </section>
  );
}

/**
 * The "+ Ajouter" pill on a card's title row.
 *
 * `label` is what a screen reader announces: "+ Ajouter" repeated on every
 * card says nothing about which list is being added to.
 */
export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-chip hover:bg-chip-hover rounded-pill text-label shrink-0 px-3 py-1.75 font-semibold transition-colors"
    >
      <span aria-hidden="true">+ Ajouter</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
