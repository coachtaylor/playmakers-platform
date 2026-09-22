import { redirect } from "next/navigation";
import { Shell, Card } from "@/components/Shell";
import { loadStep } from "../data";
import { ReturnFromPayment } from "./ReturnFromPayment";

/**
 * Where LeagueApps sends the player after checkout. Phase one does not verify the
 * payment: there is no webhook and no order lookup, so this records the reference
 * LeagueApps passed back and completes the registration.
 */
export default async function ReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ reference?: string; order_id?: string }>;
}) {
  const { programId } = await params;
  const { reference, order_id } = await searchParams;
  const { bundle } = await loadStep(programId);

  if (bundle.registration.status === "complete") redirect(`/register/${programId}/done`);

  return (
    <Shell>
      <div className="space-y-5">
        <div className="space-y-2">
          <h1 className="font-display text-3xl leading-none">Welcome back</h1>
          <p className="text-sm leading-relaxed text-muted">
            One tap to put you in the pool. If you did not finish paying at LeagueApps, go back and pay
            first — your spot is held for 15 minutes.
          </p>
        </div>
        <Card>
          <ReturnFromPayment
            programId={programId}
            registrationId={bundle.registration.id}
            paymentReference={reference ?? order_id}
            label="Put me in the draft pool"
          />
        </Card>
      </div>
    </Shell>
  );
}
