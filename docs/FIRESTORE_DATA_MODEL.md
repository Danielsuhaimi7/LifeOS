# Firestore data model

LOS-005 establishes the first owner-private data contract for the Firebase project's Standard edition default database in `asia-southeast1` (Singapore). The database is currently empty. The first authenticated visit to Tasks creates a minimal owner profile and begins reading tasks and task series, but only after the reviewed rules are deployed. Rules in the repository have not been deployed.

## Ownership and paths

```text
/users/{uid}
/users/{uid}/tasks/{taskId}
/users/{uid}/taskSeries/{seriesId}
/users/{uid}/appointments/{appointmentId}
/users/{uid}/notes/{noteId}
/users/{uid}/accounts/{accountId}
/users/{uid}/categories/{categoryId}
/users/{uid}/transactions/{transactionId}
```

The authenticated Firebase UID is the owner key in the path. The private profile also stores `ownerUid` and rules require it to match the path. Child records omit duplicate UID fields: their parent path is the canonical owner boundary. Every child operation requires the parent profile to exist. The profile cannot be deleted from the client because Firestore does not cascade-delete its subcollections.

All profiles and records are private. There is no sharing, public profile, role, or administrator field. Unknown collection paths and nested subcollections are denied by default. Collection-group queries across users are not part of this model.

## Collection contracts

| Path | Required fields and constraints |
|---|---|
| `users/{uid}` | `ownerUid` must equal `uid`; `displayName` nullable string up to 80 chars; `timeZone` is `Asia/Kuala_Lumpur`; `currency` is `MYR`; `dateFormat` is `DD/MM/YYYY`; `weekStartsOn` is `0`; `createdAt`, `updatedAt` are timestamps. |
| `tasks/{taskId}` | `title` 1–160 chars; `description` nullable string up to 4,000; `category` nullable string up to 60; `status`: `todo`, `inProgress`, `done`, or `cancelled`; `priority`: `low`, `normal`, or `high`; `dueAt` and `completedAt` nullable timestamps; `recurrenceId` and `occurrenceDate` nullable; timestamps. `done` requires `completedAt`; other statuses require it to be null. |
| `taskSeries/{seriesId}` | `title`, `description`, `category`, `priority`; `frequency`: daily, weekly, or monthly; `interval`: 1–30; `startDate` and optional inclusive `endDate` as Kuala Lumpur `YYYY-MM-DD` date keys; `anchorDay` 1–31 for monthly dates; `anchorWeekday` 0–6 for weekly dates; `currentOccurrenceId`; `active`; timestamps. |
| `appointments/{id}` | `title` 1–160 chars; `details` nullable up to 2,000; `location` nullable up to 200; `startAt` and `endAt` timestamps with end after start; `allDay` boolean; `timeZone` is `Asia/Kuala_Lumpur`; timestamps. All-day end time is exclusive. |
| `notes/{noteId}` | `title` 1–160 chars; `body` string up to 20,000; `folderId` nullable safe document ID up to 128; timestamps. |
| `accounts/{accountId}` | `name` 1–80; `type`: `cash`, `bank`, `investment`, `creditCard`, or `other`; `currency` is `MYR`; `openingBalanceSen` integer within ±9,999,999,999; `archived` boolean; timestamps. No account or card numbers are stored. |
| `categories/{categoryId}` | `name` 1–60; `kind`: `income` or `expense`; `colorKey` nullable up to 32; `archived` boolean; timestamps. |
| `transactions/{transactionId}` | `kind`: `income`, `expense`, or `transfer`; `amountSen` positive integer up to 9,999,999,999; `occurredAt` timestamp; `accountId` safe document ID; `toAccountId` and `categoryId` nullable safe IDs; `memo` nullable up to 1,000; timestamps. Transfers require two different active accounts and no category. Non-transfer categories, when present, must match the transaction kind. Referenced account/category documents must exist under the same user's path and be active. |

LOS-007 adds recurring task series. Each series keeps one current occurrence; completed occurrences remain as ordinary task records. A missed current occurrence stays visible as overdue until completed, cancelled, or deleted. Any additional missed dates are skipped when the next occurrence is generated, so returning after time away does not create a large backlog. Monthly schedules keep their original day number and use the last day of shorter months. Changing a series updates its future schedule and template while leaving existing occurrences unchanged. Bills, loans, savings goals, assets, and reports remain deferred to their feature tickets. No personal records are included in this model or repository.

## Validation and write conventions

- Firestore Rules allow only the fields listed for each document and enforce required fields, types, string lengths, enum values, integer ranges, and business constraints on both create and update.
- `createdAt` and `updatedAt` must be written with `serverTimestamp()`. Rules require both to equal Firestore's `request.time` on create; `createdAt` is immutable and `updatedAt` must equal `request.time` on update.
- Dates and instants use Firestore timestamps. The app interprets user date/time input in `Asia/Kuala_Lumpur` and formats dates as `DD/MM/YYYY`.
- Money is stored as integer sen; never use floating point for amounts.
- Document IDs should be generated by Firestore or match the safe ID pattern in the rules. References use IDs rather than client-supplied document paths.
- Account and category references are checked against active documents in the same user's tree. Later data-access code should still validate form input and handle deleted/archived references.
- User profile creation must happen before creating child records. LOS-006 initializes the minimal profile for the Tasks feature; later data-access features should reuse that owner profile.
- Standard single-field indexes are automatic. Add composite indexes only alongside actual queries that require them.
- This model is a starting contract. New collections or fields require a schema and rules update before client code writes them.

## Current project setup

The empty default database was created in Standard edition in `asia-southeast1` (Singapore), on the Firebase Spark plan. Scheduled backups were not enabled because Firebase requires Blaze billing for that feature. The database was created with production-mode default-deny rules. This repository's `backend/firestore.rules` is a prototype for review; it has not been deployed.
