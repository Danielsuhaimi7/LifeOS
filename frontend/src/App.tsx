import { Button, Card } from "./components/ui";

const sections = ["Home", "Tasks", "Calendar", "Finance", "More"];

function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="LifeOS home">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>LifeOS</span>
        </a>
        <nav className="sidebar-nav">
          {sections.map((section, index) => (
            <a
              className={"nav-link" + (index === 0 ? " active" : "")}
              href="#"
              aria-current={index === 0 ? "page" : undefined}
              key={section}
            >
              <span className="nav-dot" aria-hidden="true" />
              {section}
            </a>
          ))}
        </nav>
        <p className="sidebar-note">A little more clarity, every day.</p>
      </aside>

      <section className="content">
        <header className="topbar">
          <span className="text-eyebrow">YOUR PERSONAL SPACE</span>
          <Button variant="icon" aria-label="Profile menu">D</Button>
        </header>

        <div className="welcome">
          <p className="text-eyebrow">LIFEOS FOUNDATION</p>
          <h1 className="heading-display">Your life, in one calm place.</h1>
          <p className="text-body">
            The project workspace is ready. Tasks, calendar, notes, and finance
            will take shape here one small step at a time.
          </p>
          <Card className="welcome-card">
            <span className="welcome-icon" aria-hidden="true">✦</span>
            <div>
              <strong>Starting with a clean foundation</strong>
              <p className="text-muted">This screen is a scaffold. No personal data is stored yet.</p>
            </div>
          </Card>
        </div>

        <footer className="app-footer">Private by design <span aria-hidden="true">·</span> Built for your everyday</footer>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {sections.map((section, index) => (
          <a className={index === 0 ? "active" : ""} href="#" key={section}>
            <span className="nav-dot" aria-hidden="true" />
            {section}
          </a>
        ))}
      </nav>
    </main>
  );
}

export default App;

