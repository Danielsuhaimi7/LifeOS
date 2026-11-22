# LifeOS navigation

- Home: /
- Tasks: /tasks
- Calendar: /calendar
- Notes: /notes
- Finance: /finance
- Settings: /settings

Desktop shows all sections in the sidebar. Mobile keeps Home, Tasks, Calendar, and Finance in the bottom bar; Notes and Settings are available from More. React Router handles client-side navigation and active states. Firebase Hosting rewrites app paths to index.html for direct links and refreshes.

The Tasks route now provides task management from LOS-006. Calendar, Notes, Finance, and Settings still render placeholders for their later feature tickets.




Unauthenticated visitors see the Google sign-in screen. App routes render only after Firebase confirms a signed-in user. See docs/FIREBASE_SETUP.md to configure the local Firebase web app.

