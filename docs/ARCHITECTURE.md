# Architecture

## Foundation
- React + TypeScript + Vite application in frontend/
- Firebase Hosting and Firestore configuration at the repository root and in backend/
- Firestore access scoped to /users/{uid}/...
- shared/ is reserved until shared code is justified
- Firebase Authentication uses the modular web SDK and Google sign-in; each developer needs local web configuration in the ignored env file
- A Standard Firestore database exists in asia-southeast1 (Singapore); the rules prototype is not deployed
- Prototype rules are maintained in backend/firestore.rules and have not been deployed

## Proposed direction
The newer requirements plan uses Firebase Authentication and Cloud Firestore Standard on the Spark plan, with Firebase Hosting planned for later. LOS-004 implements Google sign-in. LOS-005 defines the initial owner-scoped model and prototype rules. Feature repositories read and write owner-scoped task, calendar, notes, and finance records. The Home dashboard derives its finance overview from accounts and transactions without storing aggregate totals. Backup and export design remains open before personal records are stored.

## Constraints
No paid services without explicit approval. Never commit local environment files, Firebase project selection, secrets, or personal records. Use integer minor units for money. Separate date-only values from timestamps and use Asia/Kuala_Lumpur for local behavior. Do not deploy unless asked.

## Local development
Install with npm --prefix frontend install, start with npm run dev, and create a bundle with npm run build.

