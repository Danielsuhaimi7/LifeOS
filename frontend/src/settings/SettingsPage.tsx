import { Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";

const preferences = [
  { label: "Time zone", value: "Asia/Kuala_Lumpur" },
  { label: "Currency", value: "MYR · Malaysian ringgit" },
  { label: "Date format", value: "DD/MM/YYYY" },
  { label: "Calendar week starts", value: "Sunday" },
];

function providerLabel(providerId: string) {
  if (providerId === "google.com") return "Google";
  if (providerId === "password") return "Email and password";
  return providerId;
}

export function SettingsPage() {
  const { user } = useAuth();
  const providers = user?.providerData.map((provider) => providerLabel(provider.providerId)).filter(Boolean) ?? [];

  return <div className="settings-page">
    <header className="settings-heading">
      <div>
        <p className="text-eyebrow">YOUR LIFEOS</p>
        <h1 className="heading-display">Settings</h1>
        <p className="text-body">Your account and the preferences used across LifeOS.</p>
      </div>
    </header>

    <section className="settings-section" aria-labelledby="settings-account-heading">
      <div className="settings-section-heading">
        <div><p className="text-eyebrow">SIGNED-IN PROFILE</p><h2 id="settings-account-heading">Account</h2></div>
      </div>
      <Card className="settings-details">
        <div><span>Name</span><strong>{user?.displayName?.trim() || "Not provided"}</strong></div>
        <div><span>Email</span><strong>{user?.email || "Not available"}</strong></div>
        <div><span>Sign-in method</span><strong>{providers.length ? [...new Set(providers)].join(", ") : "Google"}</strong></div>
      </Card>
    </section>

    <section className="settings-section" aria-labelledby="settings-preferences-heading">
      <div className="settings-section-heading">
        <div><p className="text-eyebrow">REGIONAL DEFAULTS</p><h2 id="settings-preferences-heading">Preferences</h2></div>
      </div>
      <Card className="settings-details">
        {preferences.map((preference) => <div key={preference.label}><span>{preference.label}</span><strong>{preference.value}</strong></div>)}
      </Card>
      <p className="settings-note">These defaults keep dates, currency, and calendar behavior consistent throughout LifeOS.</p>
    </section>
  </div>;
}
