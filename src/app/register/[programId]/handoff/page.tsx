import Link from "next/link";
import { Shell, Card, StatusPill } from "@/components/Shell";
import { formatMoney } from "@/lib/registration";
import { loadStep } from "../data";
import { ReturnFromPayment } from "../return/ReturnFromPayment";

/**
 * Phase one stand-in for the LeagueApps redirect: this program has no checkout link on
 * it yet, so the spot is held and the player is shown what the handoff will do. The
 * button below is the same return leg LeagueApps would send them to.
 */
export default async function HandoffPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { bundle } = await loadStep(programId);
  const { registration } = bundle;

  if (registration.status === "complete") {
    return (
      <Shell>
        <Card className="space-y-3">
          <p>This registration is already paid.</p>
          <Link href={`/register/${programId}/done`} className="font-semibold text-pmc-red underline">
            See your confirmation
          </Link>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-5">
        <div className="space-y-2">
          <StatusPill tone="gray">Spot held</StatusPill>
          <h1 className="font-display text-3xl leading-none">Payment handoff</h1>
          <p className="text-sm leading-relaxed text-muted">
            Your spot is held until{" "}
            <strong className="text-ink">
              {registration.hold_expires_at
                ? new Date(registration.hold_expires_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "15 minutes from now"}
            </strong>
            . In the season ahead this is where PlayMakers sends you to LeagueApps to pay
            {registration.amount_due_cents ? ` ${formatMoney(registration.amount_due_cents)}` : ""}, and
            LeagueApps sends you straight back here.
          </p>
        </div>

        <Card className="space-y-3">
          <h2 className="font-display text-lg">No checkout link on this program yet</h2>
          <p className="text-sm leading-relaxed text-muted">
            A commissioner sets the LeagueApps link on the program record. Until then nothing is charged and
            no money moves through this app. Continue to finish registering and land on your confirmation, the
            same as coming back from LeagueApps.
          </p>
          <ReturnFromPayment programId={programId} registrationId={registration.id} label="Finish registering" />
        </Card>

        <p className="text-xs text-muted">
          {registration.payment_plan === "plan" ? "Payment plan" : "Paying in full"}
          {registration.discount_code ? ` · code ${registration.discount_code}` : ""}
        </p>
      </div>
    </Shell>
  );
}
