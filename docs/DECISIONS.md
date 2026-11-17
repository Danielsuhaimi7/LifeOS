# Decisions and open questions

## Provisional decisions
- Repository: GitHub repository Danielsuhaimi7/LifeOS, replacing the earlier Bitbucket proposal.
- Frontend: React + TypeScript + Vite, responsive and web-first, with a PWA path.
- Authentication: Firebase Authentication with Google sign-in, implemented in LOS-004. Firebase project values stay local.
- Proposed data and hosting services: Cloud Firestore and Firebase Hosting, pending cost and requirements validation.
- Target cost: RM0/month; paid services require explicit approval.
- Currency/time: MYR in integer sen; DD/MM/YYYY; Asia/Kuala_Lumpur; Sunday week start.

## Resolve before feature implementation
- Confirm the persistent data backend (Firestore versus the older Express + PostgreSQL + Prisma proposal) before adding data features.
- Validate current Firebase free-tier limits and background reminder feasibility.
- Decide data model and backup/export approach before storing personal records.
- Confirm whether the app remains single-user.

