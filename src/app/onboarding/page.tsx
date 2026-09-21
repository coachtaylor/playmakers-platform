import { Card, Shell } from "@/components/Shell";
import { NoPlayerRecord } from "@/components/NoPlayerRecord";
import { requireSession } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const { profile, isAdmin, user } = await requireSession();

  if (!profile) {
    return (
      <Shell isAdmin={isAdmin}>
        <NoPlayerRecord email={user.email ?? ""} />
      </Shell>
    );
  }

  return (
    <Shell isAdmin={isAdmin}>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl">Welcome, {profile.preferred_name ?? profile.first_name}</h1>
          <p className="text-muted">Two quick things before you get in. You can change both later.</p>
        </div>
        <Card>
          <OnboardingForm
            firstName={profile.first_name}
            preferredName={profile.preferred_name}
            pronouns={profile.pronouns}
            consent={profile.media_consent}
          />
        </Card>
      </div>
    </Shell>
  );
}
