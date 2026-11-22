import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { Button } from "./components/ui";
import {
  AuthLoadingPage,
  FirebaseSetupPage,
  SignInPage,
} from "./auth/AuthPages";
import { FirebaseAuthProvider, useAuth } from "./auth/FirebaseAuthProvider";
import { TasksPage } from "./tasks/TasksPage";
import { CalendarPage } from "./calendar/CalendarPage";
import { NotesPage } from "./notes/NotesPage";
import { DashboardPage } from "./dashboard/DashboardPage";
import { SearchPage } from "./search/SearchPage";
import { FinancePage } from "./finance/FinancePage";
import { SettingsPage } from "./settings/SettingsPage";

type NavigationItem = {
  label: string;
  to: string;
  end?: boolean;
};

const desktopNavigation: NavigationItem[] = [
  { label: "Home", to: "/", end: true },
  { label: "Tasks", to: "/tasks" },
  { label: "Calendar", to: "/calendar" },
  { label: "Notes", to: "/notes" },
  { label: "Finance", to: "/finance" },
  { label: "Settings", to: "/settings" },
];

const mobileNavigation = desktopNavigation.filter((item) =>
  ["/", "/tasks", "/calendar", "/finance"].includes(item.to),
);
const moreNavigation = desktopNavigation.filter((item) =>
  ["/notes", "/settings"].includes(item.to),
);

function App() {
  return (
    <FirebaseAuthProvider>
      <BrowserRouter>
        <AppGate />
      </BrowserRouter>
    </FirebaseAuthProvider>
  );
}

function AppGate() {
  const { configured, loading, user } = useAuth();

  if (!configured) return <FirebaseSetupPage />;
  if (loading) return <AuthLoadingPage />;
  if (!user) return <SignInPage />;
  return <AppLayout />;
}

function AppLayout() {
  const location = useLocation();
  const { user, error, signOutUser } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  const isMoreActive = moreNavigation.some((item) =>
    location.pathname.startsWith(item.to),
  );
  const initials = user?.displayName?.trim().charAt(0).toUpperCase() || "Y";

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <aside className="sidebar" aria-label="Main navigation">
        <NavLink className="brand" to="/" aria-label="LifeOS home">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>LifeOS</span>
        </NavLink>

        <nav className="sidebar-nav" aria-label="Main sections">
          {desktopNavigation.map((item) => (
            <NavigationLink item={item} key={item.to} />
          ))}
        </nav>

        <p className="sidebar-note">A little more clarity, every day.</p>
      </aside>

      <section className="content">
        <header className="topbar">
          <span className="text-eyebrow">YOUR PERSONAL SPACE</span>
          <div className="account-actions">
            <NavLink aria-label="Search LifeOS" className={({ isActive }) => isActive ? "topbar-search is-active" : "topbar-search"} to="/search"><span aria-hidden="true">⌕</span><span>Search</span></NavLink>
            {user?.displayName && <span className="account-name">{user.displayName}</span>}
            <Button
              aria-label="Sign out"
              onClick={() => void signOutUser()}
              title="Sign out"
              variant="icon"
            >
              {initials}
            </Button>
          </div>
        </header>
        {error && <p className="auth-inline-error" role="alert">{error}</p>}

        <div className="page-content" id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>

        <footer className="app-footer">
          Private by design <span aria-hidden="true">·</span> Built for your everyday
        </footer>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileNavigation.map((item) => (
          <NavigationLink item={item} key={item.to} compact />
        ))}

        <Button
          aria-expanded={isMoreOpen}
          aria-controls="mobile-more-menu"
          className={"mobile-more-button" + (isMoreActive ? " active" : "")}
          onClick={() => setIsMoreOpen((open) => !open)}
          variant="ghost"
        >
          <span className="nav-dot" aria-hidden="true" />
          More
        </Button>
      </nav>

      {isMoreOpen && (
        <nav
          aria-label="More sections"
          className="mobile-more-panel"
          id="mobile-more-menu"
        >
          {moreNavigation.map((item) => (
            <NavigationLink
              item={item}
              key={item.to}
              onNavigate={() => setIsMoreOpen(false)}
            />
          ))}
        </nav>
      )}
    </main>
  );
}

function NavigationLink({
  item,
  compact = false,
  onNavigate,
}: {
  item: NavigationItem;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          compact ? "mobile-nav-link" : "nav-link",
          isActive ? "active" : "",
        ].filter(Boolean).join(" ")
      }
      end={item.end}
      onClick={onNavigate}
      to={item.to}
    >
      <span className="nav-dot" aria-hidden="true" />
      {item.label}
    </NavLink>
  );
}

function NotFoundPage() {
  return (
    <div className="section-page">
      <p className="text-eyebrow">LIFEOS</p>
      <h1 className="heading-display">Page not found</h1>
      <p className="text-body">That section does not exist.</p>
      <NavLink className="not-found-link" to="/">Return home</NavLink>
    </div>
  );
}

export default App;
