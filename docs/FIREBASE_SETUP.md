# Firebase local setup

LOS-004 adds Firebase Authentication with Google sign-in. The LifeOS Firebase project already has its web app and Google provider enabled, and LOS-005 provisions an empty Standard Firestore database in Singapore. The repository intentionally contains no Firebase project selection or credentials. Keep project values in local ignored files. Use the setup steps below only when configuring another local environment or Firebase project.

## 1. Create the Firebase web app

1. In the Firebase Console, create or select a project.
2. Add a **Web app** and copy its Firebase configuration values.
3. In **Authentication → Sign-in method**, enable **Google** and choose the support email requested by Firebase.
4. In **Authentication → Settings → Authorized domains**, make sure `localhost` is present for local development. Add your production domain later when you deploy.
5. Do not enable billing or deploy anything as part of this setup.

## 2. Configure local development

From the repository root, copy `frontend/.env.example` to `frontend/.env.local` and fill in the web app values:

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=...
```

Restart the Vite development server after changing environment variables. `frontend/.env.local` is ignored by Git. The Firebase web config is public client configuration, not a place for service-account keys or other private credentials. Never put a Firebase Admin SDK key in a `VITE_` variable.

## Sign-in behavior

- Desktop uses a Google sign-in popup.
- Narrow/mobile screens use a full-page redirect; Firebase returns to the app after Google sign-in.
- All LifeOS routes stay behind the Firebase auth state gate. When the project config is missing, the app shows setup guidance instead of exposing the workspace.
- Tasks, Calendar, and Notes create or reuse a minimal owner profile and use Firestore after the reviewed LOS-005/LOS-007/LOS-008/LOS-009 rules are deployed. The Home dashboard reads tasks and appointments. Finance and Settings remain placeholders.
- Firestore access must continue to be protected by Firestore Security Rules. A client-side sign-in gate alone is not a data authorization boundary.

## Local commands

```powershell
npm --prefix frontend install
npm run dev
```

See the official Firebase guides for [Google sign-in on the web](https://firebase.google.com/docs/auth/web/google-signin) and [web auth state](https://firebase.google.com/docs/auth/web/start#auth_state_observer).

## Firestore deployment status

The database was created in production mode with default-deny rules. The prototype in backend/firestore.rules has not been deployed; deploy it only after review. No user records exist yet. Scheduled backups are not enabled because Firebase requires a paid Blaze plan for that feature.
