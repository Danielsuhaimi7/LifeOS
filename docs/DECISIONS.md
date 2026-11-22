# Decisions and open questions

## Provisional decisions
- Repository: GitHub repository Danielsuhaimi7/LifeOS, replacing the earlier Bitbucket proposal.
- Frontend: React + TypeScript + Vite, responsive and web-first, with a PWA path.
- Authentication: Firebase Authentication with Google sign-in, implemented in LOS-004. Firebase project values stay local.
- Data: Cloud Firestore Standard, default database in asia-southeast1 (Singapore), on the Spark plan. User data is scoped under /users/{uid}; the database is empty until feature tickets add data access.
- Hosting: Firebase Hosting is planned but not deployed.
- Target cost: RM0/month; paid services require explicit approval.
- Currency/time: MYR in integer sen; DD/MM/YYYY; Asia/Kuala_Lumpur; Sunday week start.
- Finance budgets: one monthly spending limit per expense category, stored as integer sen and keyed by the Kuala Lumpur calendar month.

## Resolve before feature implementation
- Complete data access through the LOS-005 model and rules; add client CRUD in feature tickets.
- Validate current Firebase free-tier limits and background reminder feasibility.
- Decide backup/export and account deletion flows before storing personal records.
- Confirm whether the app remains single-user.

