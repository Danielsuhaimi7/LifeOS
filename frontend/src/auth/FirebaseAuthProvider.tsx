import { FirebaseError, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.trim().length > 0,
);

const app = firebaseConfigured
  ? getApps().find((existingApp) => existingApp.name === "[DEFAULT]") ?? initializeApp(firebaseConfig)
  : null;
const auth = app ? getAuth(app) : null;

export function getGoogleSignInError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return "Google sign-in could not be completed. Please try again.";
  }

  switch (error.code) {
    case "auth/popup-closed-by-user":
      return "The sign-in window was closed before sign-in finished.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
    case "auth/unauthorized-domain":
      return "This site is not authorized for sign-in yet. Add its domain in Firebase Authentication settings.";
    case "auth/network-request-failed":
      return "A network error interrupted sign-in. Check your connection and try again.";
    default:
      return "Google sign-in could not be completed. Please try again.";
  }
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    void getRedirectResult(auth).catch((redirectError: unknown) => {
      setError(getGoogleSignInError(redirectError));
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      () => {
        setError("Your sign-in session could not be checked. Refresh and try again.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return;

    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      if (window.matchMedia("(max-width: 720px)").matches) {
        await signInWithRedirect(auth, provider);
        return;
      }

      await signInWithPopup(auth, provider);
    } catch (signInError) {
      setError(getGoogleSignInError(signInError));
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!auth) return;

    setError(null);
    try {
      await signOut(auth);
    } catch {
      setError("You could not be signed out. Please try again.");
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      error,
      clearError: () => setError(null),
      signInWithGoogle,
      signOutUser,
    }),
    [user, loading, error, signInWithGoogle, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside FirebaseAuthProvider.");
  }
  return context;
}



