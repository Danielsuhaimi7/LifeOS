# LifeOS

A private personal life-management app for tasks, appointments, notes, and finance.

## Foundation status
The repository starts with a React + TypeScript frontend and Firebase configuration scaffolding. It is not connected to a Firebase project and is not deployed. Do not add credentials or personal data to Git.

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

Firebase Authentication now supports Google sign-in once a local Firebase web app is configured. See docs/FIREBASE_SETUP.md and docs/ARCHITECTURE.md. Firestore and Hosting remain unconfigured. No paid service should be enabled without explicit approval.

