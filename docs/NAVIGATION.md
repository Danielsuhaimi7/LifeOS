# LifeOS navigation

- Home: /
- Tasks: /tasks
- Calendar: /calendar
- Notes: /notes
- Search: /search
- Finance: /finance
- Settings: /settings

Desktop shows all sections in the sidebar. Mobile keeps Home, Tasks, Calendar, and Finance in the bottom bar; Notes and Settings are available from More. React Router handles client-side navigation and active states. Firebase Hosting rewrites app paths to index.html for direct links and refreshes.

Home is the LOS-010 dashboard with today's tasks, overdue counts, upcoming appointments, and quick links. Search in the top bar opens LOS-011 Global Search across tasks, appointments, notes, accounts, and finance transactions, including transfers by source and destination. The Tasks route provides task management from LOS-006/LOS-007. Calendar provides month and week navigation plus appointment management from LOS-008. Notes provides plain-text and checklist notes, folders, autosave, and optional links from LOS-009. Finance provides account management, income/expense activity, transfers, credit card balance tracking, and transaction corrections from LOS-012/LOS-013/LOS-014/LOS-015. Category management and budgets are planned for LOS-018. Settings remains a placeholder.




Unauthenticated visitors see the Google sign-in screen. App routes render only after Firebase confirms a signed-in user. See docs/FIREBASE_SETUP.md to configure the local Firebase web app.

