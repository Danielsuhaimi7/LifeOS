# Architecture

## Foundation
- React + TypeScript + Vite application in frontend/
- Firebase Hosting and Firestore configuration at the repository root and in backend/
- Firestore access scoped to /users/{uid}/...
- shared/ is reserved until shared code is justified
- Firebase Authentication uses the modular web SDK and Google sign-in; a Firebase project and local web configuration are still required
- Firestore persistence and deployment are not configured

## Proposed direction
The newer requirements plan proposes Google sign-in through Firebase Authentication, Cloud Firestore, and Firebase Hosting, subject to cost and reminder feasibility. An earlier plan proposed Express, PostgreSQL, and Prisma. LOS-004 implements the newer Firebase proposal for Google Authentication. Firestore persistence remains a separate decision and must not be added until its data model and backup/export approach are settled.

## Constraints
No paid services without explicit approval. Never commit local environment files, Firebase project selection, secrets, or personal records. Use integer minor units for money. Separate date-only values from timestamps and use Asia/Kuala_Lumpur for local behavior. Do not deploy unless asked.

## Local development
Install with npm --prefix frontend install, start with npm run dev, and create a bundle with npm run build.

