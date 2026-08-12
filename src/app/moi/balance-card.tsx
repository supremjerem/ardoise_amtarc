import { capPercentage, describeBalance, isOverCap, type BalanceStatus } from "@/lib/balance";
import { formatMoney } from "@/lib/money";

/*
 * The one thing a member opens the app for: what do I owe?
 *
 * The figure is stated plainly, in the largest type on the screen, with a bar
 * showing how close it is to their cap. No jargon, no accounting sign
 * convention — "Avoir en votre faveur" rather than a negative number.
 */

/* Written out in full so Tailwind generates them. */
const AMOUNT_COLOURS: Record<BalanceStatus, string> = {
  debt: "text-debt",
  credit: "text-credit",
  settled: "text-paid",
};

const BAR_COLOURS: Record<BalanceStatus, string> = {
  debt: "bg-debt",
  credit: "bg-credit",
  settled: "bg-paid",
};

export function BalanceCard({
  balanceCents,
  capCents,
}: {
  balanceCents: number;
  capCents: number;
}) {
  const balance = describeBalance(balanceCents);
  const percentage = capPercentage(balanceCents, capCents);

  return (
    <section className="bg-surface rounded-card shadow-card px-5.5 py-6.5 text-center">
      <h2 className="text-ink-soft text-label font-semibold tracking-[0.5px] uppercase">
        {balance.statusLabel}
      </h2>

      <p className={`font-display text-amount mt-2 font-bold ${AMOUNT_COLOURS[balance.status]}`}>
        {balance.amountLabel}
      </p>

      {capCents > 0 && (
        <>
          <div
            className="bg-track mt-5 h-2 overflow-hidden rounded-md"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Part de votre plafond utilisée : ${percentage} %`}
          >
            <div
              className={`h-full rounded-md ${BAR_COLOURS[balance.status]}`}
              /* A percentage is only known at render, so it cannot be a class. */
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="text-ink-soft text-label mt-2.5">
            Votre plafond&nbsp;: {formatMoney(capCents)}
          </p>
        </>
      )}
    </section>
  );
}

/** Shown only once the member is actually over their cap. */
export function CapAlert({ balanceCents, capCents }: { balanceCents: number; capCents: number }) {
  if (!isOverCap(balanceCents, capCents)) return null;

  return (
    <p
      role="alert"
      className="bg-debt-bg text-debt-ink rounded-tile mt-3.5 px-4 py-3.5 text-sm leading-relaxed font-medium"
    >
      Vous avez dépassé votre plafond ({formatMoney(capCents)}). Merci de régler auprès du
      responsable de caisse dès que possible.
    </p>
  );
}
