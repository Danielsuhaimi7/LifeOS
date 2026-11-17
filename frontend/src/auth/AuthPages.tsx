import { Button, Card } from "../components/ui";
import { useAuth } from "./FirebaseAuthProvider";

export function SignInPage() {
  const { error, signInWithGoogle } = useAuth();

  return (
    <main className="auth-screen">
      <section aria-labelledby="sign-in-title" className="auth-content">
        <a className="brand auth-brand" href="/" aria-label="LifeOS">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>LifeOS</span>
        </a>

        <p className="text-eyebrow">YOUR PERSONAL SPACE</p>
        <h1 className="heading-display" id="sign-in-title">A little more clarity, every day.</h1>
        <p className="text-body">
          Sign in with your Google account to open your private LifeOS workspace.
        </p>

        <Card className="auth-card">
          <Button
            className="google-sign-in"
            onClick={() => void signInWithGoogle()}
            variant="primary"
          >
            <GoogleMark />
            Continue with Google
          </Button>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <p className="text-muted">Your account keeps your workspace private.</p>
        </Card>
      </section>
      <p className="app-footer auth-footer">Private by design <span aria-hidden="true">·</span> Built for your everyday</p>
    </main>
  );
}

export function AuthLoadingPage() {
  return (
    <main className="auth-screen" aria-busy="true" aria-live="polite">
      <div className="auth-state">
        <span className="brand-mark" aria-hidden="true">L</span>
        <p className="text-body">Checking your sign-in…</p>
      </div>
    </main>
  );
}

export function FirebaseSetupPage() {
  return (
    <main className="auth-screen">
      <section className="auth-content" aria-labelledby="setup-title">
        <a className="brand auth-brand" href="/" aria-label="LifeOS">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>LifeOS</span>
        </a>
        <p className="text-eyebrow">ONE-TIME SETUP</p>
        <h1 className="heading-display" id="setup-title">Connect your Firebase project.</h1>
        <p className="text-body">
          Authentication is not configured yet. Follow the local setup guide to connect a Firebase project and enable Google sign-in.
        </p>
        <Card className="auth-card">
          <strong>Setup required</strong>
          <p className="text-muted">
            Copy frontend/.env.example to frontend/.env.local, add your Firebase web app values, then restart the development server.
          </p>
        </Card>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 38.07 46.98 31.89 46.98 24.55Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.89.93 7.59 2.56 10.78l7.97-6.19Z" transform="translate(0 4)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.88 2.3-8.18 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -4)" />
    </svg>
  );
}
