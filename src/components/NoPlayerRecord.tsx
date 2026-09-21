import { Card } from "./Shell";

export function NoPlayerRecord({ email }: { email: string }) {
  return (
    <Card className="space-y-2">
      <h1 className="font-display text-2xl">We can&apos;t find your registration</h1>
      <p className="text-muted">
        You&apos;re signed in as <strong className="text-ink">{email}</strong>, but that email isn&apos;t on a PlayMakers
        roster yet. If you registered with a different email, sign out and use that one. Otherwise, message Cheyenne and
        she&apos;ll add you.
      </p>
    </Card>
  );
}
