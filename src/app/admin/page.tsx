import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Shell, StatusPill } from "@/components/Shell";
import { requireSession } from "@/lib/session";
import { votingStatus } from "@/lib/types";

export default async function AdminPage() {
  const { supabase, isAdmin } = await requireSession();
  if (!isAdmin) redirect("/home");

  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, org_id, voting_opens_at, voting_closes_at, results_published_at, seasons(label)")
    .order("created_at", { ascending: false });

  return (
    <Shell isAdmin>
      <div className="space-y-6">
        <h1 className="font-display text-3xl">Commissioner</h1>
        {(programs ?? []).length === 0 && (
          <Card>
            <p className="text-muted">No leagues yet.</p>
          </Card>
        )}
        {(programs ?? []).map((p) => {
          const status = votingStatus(p);
          const season = (p.seasons as unknown as { label: string } | null)?.label;
          return (
            <Link key={p.id} href={`/admin/programs/${p.id}`} className="block">
              <Card className="space-y-1 hover:border-ink">
                <p className="text-sm text-muted">{season}</p>
                <p className="font-semibold">{p.name}</p>
                <StatusPill tone={status === "open" ? "red" : status === "published" ? "green" : "gray"}>
                  {status === "open"
                    ? "Voting open"
                    : status === "published"
                      ? "Results published"
                      : status === "closed"
                        ? "Voting closed"
                        : "Voting not open"}
                </StatusPill>
              </Card>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}
