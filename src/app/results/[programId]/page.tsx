import Link from "next/link";
import { Card, Shell } from "@/components/Shell";
import { requireOnboarded } from "@/lib/session";

type ResultRow = {
  category_id: string;
  category_label: string;
  sort_order: number;
  member_id: string;
  display_name: string;
  team_name: string | null;
};

export default async function ResultsPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { supabase, isAdmin } = await requireOnboarded();

  const [{ data: program }, { data, error }] = await Promise.all([
    supabase.from("programs").select("name, results_published_at").eq("id", programId).maybeSingle(),
    supabase.rpc("program_results", { p_program: programId }),
  ]);

  const rows = (data ?? []) as ResultRow[];
  const groups = new Map<string, { label: string; players: ResultRow[] }>();
  for (const r of rows) {
    const g = groups.get(r.category_id) ?? { label: r.category_label, players: [] };
    g.players.push(r);
    groups.set(r.category_id, g);
  }

  return (
    <Shell isAdmin={isAdmin}>
      <div className="space-y-6">
        <div className="space-y-1">
          <Link href="/home" className="text-sm text-muted underline">
            Home
          </Link>
          <h1 className="font-display text-3xl">All-star teams</h1>
          {program && <p className="text-muted">{program.name}</p>}
          {isAdmin && program && !program.results_published_at && (
            <p className="rounded-md bg-pmc-red/10 p-2 text-sm text-pmc-red">
              Preview: players can&apos;t see this until you publish.
            </p>
          )}
        </div>

        {error && (
          <Card>
            <p className="text-muted">Results haven&apos;t been announced yet.</p>
          </Card>
        )}

        {[...groups.values()].map((g) => (
          <Card key={g.label} className="space-y-3">
            <h2 className="font-display text-xl text-pmc-red">{g.label}</h2>
            <ul className="divide-y divide-line">
              {g.players.map((p) => (
                <li key={p.member_id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="font-semibold">{p.display_name}</span>
                  <span className="text-sm text-muted">{p.team_name}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
