import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, Shell } from "@/components/Shell";
import { requireSession } from "@/lib/session";
import { ImportForm } from "./ImportForm";

export default async function ImportPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { supabase, isAdmin } = await requireSession();
  if (!isAdmin) redirect("/home");

  const { data: program } = await supabase.from("programs").select("id, name").eq("id", programId).maybeSingle();
  if (!program) notFound();

  return (
    <Shell isAdmin>
      <div className="space-y-6">
        <div className="space-y-1">
          <Link href={`/admin/programs/${programId}`} className="text-sm text-muted underline">
            Back to league
          </Link>
          <h1 className="font-display text-3xl">Import roster</h1>
          <p className="text-muted">{program.name}</p>
        </div>
        <Card>
          <ImportForm programId={programId} />
        </Card>
        <p className="text-sm text-muted">
          Importing doesn&apos;t email anyone. Players get in when they sign in with the email on this roster.
        </p>
      </div>
    </Shell>
  );
}
