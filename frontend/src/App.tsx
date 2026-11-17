const sections = ["Home", "Tasks", "Calendar", "Finance", "More"];

function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="LifeOS home">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>LifeOS</span>
        </a>
        <nav>
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
          <span className="eyebrow">YOUR PERSONAL SPACE</span>
          <button className="avatar" type="button" aria-label="Profile menu">D</button>
        </header>
        <div className="welcome">
          <p className="eyebrow">LIFEOS FOUNDATION</p>
          <h1>Your life, in one calm place.</h1>
          <p className="intro">
            The project workspace is ready. Tasks, calendar, notes, and finance
            will take shape here one small step at a time.
          </p>
          <div className="status-card">
            <span className="status-icon" aria-hidden="true">✦</span>
            <div>
              <strong>Starting with a clean foundation</strong>
              <p>This screen is a scaffold. No personal data is stored yet.</p>
            </div>
          </div>
        </div>
        <footer>Private by design <span aria-hidden="true">·</span> Built for your everyday</footer>
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

