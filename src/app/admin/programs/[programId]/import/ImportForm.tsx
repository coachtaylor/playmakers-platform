"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { importRoster, type ImportRow } from "../actions";

// Header names vary between exports; map the common spellings to our fields.
const ALIASES: Record<keyof ImportRow, string[]> = {
  jersey_number: ["jersey number", "jersey #", "jersey", "number", "#", "jersey_number"],
  positions: [
    "positions",
    "position",
    "positions played",
    "positions i have played",
    "preferred position",
    "preferred position (offense)",
  ],
  email: ["email", "email address", "player email", "e-mail"],
  first_name: ["first name", "firstname", "first_name", "player first name"],
  last_name: ["last name", "lastname", "last_name", "player last name"],
  team: ["team", "team name", "team_name"],
  role: ["role", "registration type", "type"],
  is_rookie: ["rookie", "is_rookie", "is rookie", "first season"],
};

function normalize(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function truthy(v: string | undefined) {
  return ["y", "yes", "true", "1", "x"].includes((v ?? "").trim().toLowerCase());
}

// "WR, CB" / "WR/CB" / "QB;S" -> ["WR","CB"]
function splitPositions(v: string | undefined) {
  return (v ?? "")
    .split(/[,/;|]/)
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== "n/a");
}

function mapRole(v: string | undefined) {
  const s = (v ?? "").toLowerCase();
  if (s.includes("captain")) return "captain";
  if (s.includes("free")) return "free_agent";
  return "player";
}

export function ImportForm({ programId }: { programId: string }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File) {
    setResult(null);
    setError(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const headers = (parsed.meta.fields ?? []).map((h) => [h, normalize(h)] as const);
        const find = (field: keyof ImportRow) => headers.find(([, n]) => ALIASES[field].includes(n))?.[0];
        const cols = {
          email: find("email"),
          first_name: find("first_name"),
          last_name: find("last_name"),
          team: find("team"),
          role: find("role"),
          is_rookie: find("is_rookie"),
          jersey_number: find("jersey_number"),
          positions: find("positions"),
        };
        setMissing(
          (["email", "first_name"] as const).filter((k) => !cols[k]).map((k) => (k === "email" ? "Email" : "First name")),
        );
        setRows(
          parsed.data.map((r) => ({
            email: (cols.email ? r[cols.email] : "")?.trim() ?? "",
            first_name: (cols.first_name ? r[cols.first_name] : "")?.trim() ?? "",
            last_name: (cols.last_name ? r[cols.last_name] : "")?.trim() ?? "",
            team: (cols.team ? r[cols.team] : "")?.trim() ?? "",
            role: mapRole(cols.role ? r[cols.role] : ""),
            is_rookie: truthy(cols.is_rookie ? r[cols.is_rookie] : ""),
            jersey_number: (cols.jersey_number ? r[cols.jersey_number] : "")?.trim() ?? "",
            positions: splitPositions(cols.positions ? r[cols.positions] : ""),
          })),
        );
      },
      error: () => setError("That file couldn't be read. Save it as CSV and try again."),
    });
  }

  function runImport() {
    startTransition(async () => {
      const res = await importRoster(programId, rows);
      if (res.error) {
        setError(res.error);
        return;
      }
      const r = res.result!;
      setResult(
        `Imported: ${r.added} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped (missing email or first name)` : ""}.`,
      );
      setRows([]);
    });
  }

  const teams = new Set(rows.map((r) => r.team).filter(Boolean));
  const rookies = rows.filter((r) => r.is_rookie).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="csv" className="block text-sm font-semibold">
          Roster file (CSV)
        </label>
        <input
          id="csv"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:font-semibold file:text-white"
        />
        <p className="text-xs text-muted">
          Needs columns for email and first name. Last name, team, role (captain / player / free agent), rookie (yes /
          no), jersey number and positions (e.g. &quot;WR, CB&quot;) are used when present. Re-importing updates existing players instead of duplicating them.
        </p>
      </div>

      {missing.length > 0 && (
        <p className="text-sm text-pmc-red" role="alert">
          {fileName} is missing a column for: {missing.join(", ")}.
        </p>
      )}
      {error && (
        <p className="text-sm text-pmc-red" role="alert">
          {error}
        </p>
      )}
      {result && (
        <p className="rounded-md bg-good/10 p-3 text-sm text-good" role="status">
          {result}
        </p>
      )}

      {rows.length > 0 && missing.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm">
            <strong>{rows.length}</strong> players, <strong>{teams.size}</strong> teams, <strong>{rookies}</strong>{" "}
            marked rookie. First rows:
          </p>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead className="bg-ground text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Team</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Rookie</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="p-2 tabular-nums">{r.jersey_number}</td>
                    <td className="p-2">
                      {r.first_name} {r.last_name}
                      {r.positions.length > 0 && (
                        <span className="block text-xs text-muted">{r.positions.join(" / ")}</span>
                      )}
                    </td>
                    <td className="p-2 text-muted">{r.email}</td>
                    <td className="p-2">{r.team}</td>
                    <td className="p-2">{r.role.replace("_", " ")}</td>
                    <td className="p-2">{r.is_rookie ? "Yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={runImport}
            disabled={pending}
            className="rounded-md bg-pmc-red px-4 py-2.5 font-semibold text-white hover:bg-pmc-red-dark disabled:opacity-60"
          >
            {pending ? "Importing…" : `Import ${rows.length} players`}
          </button>
        </div>
      )}
    </div>
  );
}
