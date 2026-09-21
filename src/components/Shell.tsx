import Link from "next/link";

export function Shell({
  children,
  isAdmin = false,
  signedIn = true,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
  signedIn?: boolean;
}) {
  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/home" className="font-display text-lg">
            PlayMakers <span className="text-pmc-red">Club</span>
          </Link>
          {signedIn && (
            <nav className="flex items-center gap-4 text-sm">
              {isAdmin && (
                <Link href="/admin" className="text-white/80 hover:text-white">
                  Commissioner
                </Link>
              )}
              <form action="/auth/signout" method="post">
                <button className="text-white/80 hover:text-white">Sign out</button>
              </form>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function StatusPill({ tone, children }: { tone: "red" | "green" | "gray"; children: React.ReactNode }) {
  const tones = {
    red: "bg-pmc-red text-white",
    green: "bg-good text-white",
    gray: "bg-line text-ink",
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
