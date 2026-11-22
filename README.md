# LifeOS

A private personal life-management app for tasks, appointments, notes, and finance.

## Foundation status
The repository contains the React + TypeScript frontend, Google Authentication, and Firestore configuration scaffolding. The LifeOS Firebase project has Google sign-in enabled and an empty Standard Firestore database in Singapore. Project values stay in the ignored local frontend/.env.local file; no personal records have been added. The app is not deployed. Do not add credentials or personal data to Git.

## Requirements
- Node.js 26 LTS
- npm
- Git

## Run the frontend
From the repository root:
- Install: npm --prefix frontend install
- Develop: npm run dev
- Build: npm run build
- Typecheck: npm run typecheck

## Layout
- frontend/ — React, TypeScript, and Vite web app
- backend/ — Firestore rules and indexes
- shared/ — reserved for shared models when a real need appears
- docs/ — product and architecture notes
- .agents/ and .codex/agents/ — LifeOS-specific agent guidance

Firebase Authentication and an empty Standard Firestore database are configured in the LifeOS Firebase project. Tasks and Calendar read and write owner-scoped Firestore records once the reviewed LOS-005/LOS-007/LOS-008 rules are deployed. Other sections remain placeholders, and Hosting is not deployed. See docs/FIREBASE_SETUP.md, docs/FIRESTORE_DATA_MODEL.md, and docs/ARCHITECTURE.md. No paid service should be enabled without explicit approval.

