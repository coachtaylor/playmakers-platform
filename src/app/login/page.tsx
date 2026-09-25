import { Shell, Card } from "@/components/Shell";
import { LinkError } from "./LinkError";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <Shell signedIn={false}>
      <div className="space-y-6 pt-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl">Sign in</h1>
          <p className="text-muted">
            Use the email you registered with. We&apos;ll send you a link, no password needed.
          </p>
        </div>
        <LinkError />
        {error === "link" && (
          <p className="rounded-md bg-pmc-red/10 p-3 text-sm text-pmc-red" role="alert">
            That sign-in link didn&apos;t work. It may have expired or been opened in a different browser. Request a
            new one below.
          </p>
        )}
        <Card>
          <LoginForm next={next} />
        </Card>
      </div>
    </Shell>
  );
}
