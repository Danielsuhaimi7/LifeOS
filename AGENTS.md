# LifeOS repository guidance

## Product direction
LifeOS is a private, initially single-user app for desktop and iPhone. Build a responsive web app first, with an installable PWA path. Planned areas: tasks, calendar, notes, personal finance, dashboard, search, settings, and backup.

The current proposed stack is React + TypeScript + Vite with Firebase Authentication, Firestore, and Hosting, subject to free-tier and reminder feasibility checks. A previous plan proposed Express + PostgreSQL + Prisma; revisit before authentication or persistent-data implementation. Target RM0/month. Do not enable paid services without explicit approval.

Use MYR stored as integer sen, display dates as DD/MM/YYYY, use Asia/Kuala_Lumpur for local time, and start calendar weeks on Sunday.

## Working rules
- Read this file, README, relevant docs, and git status before editing.
- Keep work scoped to the active ticket. Foundation work must not silently become feature implementation.
- Preserve user changes. Never reset, overwrite unrelated work, stage, commit, push, or deploy unless explicitly asked.
- Keep secrets, real personal records, .env files, and local Firebase project files out of Git.
- Enforce authenticated owner access at every data boundary; validate inputs.
- Record unresolved decisions in docs/DECISIONS.md or ask if code depends on them.
- Follow existing patterns and update docs/project map when structure changes.
- Run only relevant existing checks when requested and report exact commands/results.

## Layout
frontend/ is the browser application. backend/ holds Firebase rules, indexes, and future server code if needed. shared/ is reserved until shared code is justified. docs/ contains product and architecture decisions.

The separate reference folder contains materials for other projects. Flutter, Stripe, and payment-flow instructions there are not LifeOS requirements.

