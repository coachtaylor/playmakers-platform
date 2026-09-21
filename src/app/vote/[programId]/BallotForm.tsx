"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { isEligible, type AwardCategory, type Candidate } from "@/lib/types";
import { submitBallot } from "./actions";

export function BallotForm({
  programId,
  myMemberId,
  categories,
  candidates,
  initial,
}: {
  programId: string;
  myMemberId: string;
  categories: AwardCategory[];
  candidates: Candidate[];
  initial: Record<string, string[]>;
}) {
  const [picks, setPicks] = useState<Record<string, string[]>>(() => {
    const start: Record<string, string[]> = {};
    for (const c of categories) start[c.id] = initial[c.id] ?? [];
    return start;
  });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();

  function toggle(cat: AwardCategory, memberId: string) {
    setMessage(null);
    setPicks((prev) => {
      const current = prev[cat.id] ?? [];
      if (current.includes(memberId)) return { ...prev, [cat.id]: current.filter((id) => id !== memberId) };
      if (current.length >= cat.slots) return prev;
      return { ...prev, [cat.id]: [...current, memberId] };
    });
  }

  function save() {
    startTransition(async () => {
      const result = await submitBallot(
        programId,
        categories.map((c) => ({ category_id: c.id, member_ids: picks[c.id] ?? [] })),
      );
      setMessage(
        result.ok
          ? { tone: "ok", text: "Ballot saved. You can change it until voting closes." }
          : { tone: "error", text: result.error ?? "We couldn't save your ballot." },
      );
      if (result.ok) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const totalPicks = Object.values(picks).reduce((n, list) => n + list.length, 0);

  return (
    <div className="space-y-6">
      {message && (
        <div
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-md p-3 text-sm ${message.tone === "ok" ? "bg-good/10 text-good" : "bg-pmc-red/10 text-pmc-red"}`}
        >
          {message.text}{" "}
          {message.tone === "ok" && (
            <Link href="/home" className="font-semibold underline">
              Back to home
            </Link>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="search" className="block text-sm font-semibold">
          Find a player
        </label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or team"
          className="w-full rounded-md border border-line bg-white px-3 py-2.5"
        />
      </div>

      {categories.map((cat) => (
        <CategoryPicker
          key={cat.id}
          category={cat}
          candidates={candidates.filter(
            (c) =>
              c.member_id !== myMemberId &&
              isEligible(c, cat) &&
              (!q || c.display_name.toLowerCase().includes(q) || (c.team_name ?? "").toLowerCase().includes(q)),
          )}
          allCandidates={candidates}
          selected={picks[cat.id] ?? []}
          onToggle={(id) => toggle(cat, id)}
        />
      ))}

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={save}
          disabled={pending || totalPicks === 0}
          className="w-full rounded-md bg-pmc-red px-4 py-3 font-semibold text-white hover:bg-pmc-red-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : `Submit ballot (${totalPicks} ${totalPicks === 1 ? "pick" : "picks"})`}
        </button>
      </div>
    </div>
  );
}

function CategoryPicker({
  category,
  candidates,
  allCandidates,
  selected,
  onToggle,
}: {
  category: AwardCategory;
  candidates: Candidate[];
  allCandidates: Candidate[];
  selected: string[];
  onToggle: (memberId: string) => void;
}) {
  const full = selected.length >= category.slots;
  const byTeam = useMemo(() => {
    const groups = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const key = c.team_name ?? "Free agents";
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return [...groups.entries()];
  }, [candidates]);
  const selectedNames = selected
    .map((id) => allCandidates.find((c) => c.member_id === id)?.display_name)
    .filter(Boolean)
    .join(", ");

  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-4" aria-labelledby={`cat-${category.id}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`cat-${category.id}`} className="font-display text-xl">
          {category.label}
        </h2>
        <span className={`text-sm font-semibold tabular-nums ${full ? "text-good" : "text-muted"}`}>
          {selected.length} of {category.slots}
        </span>
      </div>
      <p className="text-sm text-muted">
        {category.eligibility === "rookie"
          ? "First-season players only."
          : category.eligibility === "veteran"
            ? "Returning players only."
            : "Anyone in the league."}{" "}
        Pick up to {category.slots}.
        {selectedNames && (
          <>
            {" "}
            <span className="text-ink">Your picks: {selectedNames}.</span>
          </>
        )}
      </p>

      {byTeam.length === 0 && <p className="text-sm text-muted">No players match your search.</p>}

      <div className="space-y-3">
        {byTeam.map(([team, list]) => (
          <div key={team} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{team}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((c) => {
                const on = selected.includes(c.member_id);
                return (
                  <button
                    key={c.member_id}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() => onToggle(c.member_id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      on
                        ? "border-pmc-red bg-pmc-red text-white"
                        : "border-line bg-white hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                    }`}
                  >
                    {c.display_name}
                    {c.is_rookie && category.eligibility !== "rookie" && (
                      <span className={`ml-1 text-xs ${on ? "text-white/80" : "text-muted"}`}>R</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
