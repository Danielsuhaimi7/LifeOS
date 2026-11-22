import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { firestoreDb } from "../auth/FirebaseAuthProvider";

export type TaskStatus = "todo" | "inProgress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";
export type RepeatFrequency = "daily" | "weekly" | "monthly";

export type RecurrenceInput = {
  frequency: RepeatFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
};

export type LifeTask = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Timestamp | null;
  completedAt: Timestamp | null;
  recurrenceId: string | null;
  occurrenceDate: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TaskSeries = RecurrenceInput & {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: TaskPriority;
  anchorDay: number;
  anchorWeekday: number;
  currentOccurrenceId: string | null;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TaskInput = {
  title: string;
  description: string | null;
  category: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Timestamp | null;
  recurrence: RecurrenceInput | null;
};

function requireDatabase() {
  if (!firestoreDb) {
    throw new Error("Firebase is not configured for this app.");
  }
  return firestoreDb;
}

export async function ensureUserProfile(user: User): Promise<void> {
  const db = requireDatabase();
  const profileRef = doc(db, "users", user.uid);

  await runTransaction(db, async (transaction) => {
    const profile = await transaction.get(profileRef);
    if (profile.exists()) return;

    transaction.set(profileRef, {
      ownerUid: user.uid,
      displayName: user.displayName?.trim().slice(0, 80) || null,
      timeZone: "Asia/Kuala_Lumpur",
      currency: "MYR",
      dateFormat: "DD/MM/YYYY",
      weekStartsOn: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export function subscribeToTasks(
  userId: string,
  onTasks: (tasks: LifeTask[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const tasksRef = collection(requireDatabase(), "users", userId, "tasks");
  return onSnapshot(
    tasksRef,
    (snapshot) => {
      const tasks = snapshot.docs.map((taskDoc) => ({
        id: taskDoc.id,
        ...taskDoc.data(),
      }) as LifeTask);
      onTasks(tasks);
    },
    onError,
  );
}

export function subscribeToTaskSeries(
  userId: string,
  onSeries: (series: TaskSeries[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const seriesRef = collection(requireDatabase(), "users", userId, "taskSeries");
  return onSnapshot(
    seriesRef,
    (snapshot) => {
      const series = snapshot.docs.map((seriesDoc) => ({
        id: seriesDoc.id,
        ...seriesDoc.data(),
      }) as TaskSeries);
      onSeries(series);
    },
    onError,
  );
}

function taskValues(input: TaskInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category?.trim() || null,
    status: input.status,
    priority: input.priority,
    dueAt: input.dueAt,
  };
}

function seriesValues(input: TaskInput, recurrence: RecurrenceInput, currentOccurrenceId: string | null, active: boolean) {
  const startDate = recurrence.startDate;
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category?.trim() || null,
    priority: input.priority,
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    startDate,
    endDate: recurrence.endDate,
    anchorDay: Number(startDate.slice(8, 10)),
    anchorWeekday: parseDateKey(startDate).getUTCDay(),
    currentOccurrenceId,
    active,
  };
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDateKey(value: Date): string {
  const year = String(value.getUTCFullYear()).padStart(4, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function todayKey(): string {
  return dateInputValue(Timestamp.now());
}

function addDays(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateKey(date);
}

function addMonths(value: string, months: number, anchorDay: number): string {
  const current = parseDateKey(value);
  const monthIndex = current.getUTCMonth() + months;
  const year = current.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return utcDateKey(new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay))));
}

function occurrenceId(seriesId: string, date: string): string {
  return seriesId + "_" + date.replaceAll("-", "");
}

function nextWeeklyOccurrence(series: TaskSeries, fromDate: string, today: string): string | null {
  const base = fromDate > today ? fromDate : today;
  let candidate = addDays(base, 1);
  let attempts = 0;
  while (attempts < 100000) {
    if (candidate >= series.startDate) {
      const candidateDate = parseDateKey(candidate);
      const anchorDate = parseDateKey(series.startDate);
      const daysFromAnchor = Math.floor((candidateDate.getTime() - anchorDate.getTime()) / 86400000);
      const weeksFromAnchor = Math.floor(daysFromAnchor / 7);
      if (candidateDate.getUTCDay() === series.anchorWeekday && weeksFromAnchor % series.interval === 0) {
        return candidate;
      }
    }
    candidate = addDays(candidate, 1);
    attempts += 1;
  }
  return null;
}

function nextOccurrenceDate(series: TaskSeries, fromDate: string): string | null {
  const today = todayKey();
  if (series.frequency === "weekly") {
    const weeklyDate = nextWeeklyOccurrence(series, fromDate, today);
    return weeklyDate && (!series.endDate || weeklyDate <= series.endDate) ? weeklyDate : null;
  }

  let candidate = series.frequency === "daily"
    ? addDays(fromDate, series.interval)
    : addMonths(fromDate, series.interval, series.anchorDay);
  let skipped = 0;
  while ((candidate <= today || candidate < series.startDate) && skipped < 100000) {
    candidate = series.frequency === "daily"
      ? addDays(candidate, series.interval)
      : addMonths(candidate, series.interval, series.anchorDay);
    skipped += 1;
  }

  if (skipped === 100000 || (series.endDate && candidate > series.endDate)) return null;
  return candidate;
}
function taskOccurrenceValues(
  series: TaskSeries,
  occurrenceDate: string,
) {
  return {
    title: series.title,
    description: series.description,
    category: series.category,
    status: "todo" as const,
    priority: series.priority,
    dueAt: timestampFromDateInput(occurrenceDate),
    completedAt: null,
    recurrenceId: series.id,
    occurrenceDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function writeNextOccurrence(
  transaction: Transaction,
  userId: string,
  series: TaskSeries,
  fromDate: string,
): { active: boolean; currentOccurrenceId: string | null } {
  const db = requireDatabase();
  const nextDate = nextOccurrenceDate(series, fromDate);
  if (!nextDate) {
    return { active: false, currentOccurrenceId: null };
  }

  const nextId = occurrenceId(series.id, nextDate);
  const nextTaskRef = doc(db, "users", userId, "tasks", nextId);
  transaction.set(nextTaskRef, taskOccurrenceValues(series, nextDate));
  return { active: true, currentOccurrenceId: nextId };
}

export async function createTask(userId: string, input: TaskInput): Promise<void> {
  const db = requireDatabase();
  const tasksRef = collection(db, "users", userId, "tasks");

  if (!input.recurrence) {
    const taskRef = doc(tasksRef);
    await setDoc(taskRef, {
      ...taskValues(input),
      completedAt: input.status === "done" ? serverTimestamp() : null,
      recurrenceId: null,
      occurrenceDate: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const recurrence = input.recurrence;
  const seriesRef = doc(collection(db, "users", userId, "taskSeries"));
  const firstTaskId = occurrenceId(seriesRef.id, recurrence.startDate);
  const firstTaskRef = doc(db, "users", userId, "tasks", firstTaskId);
  const series = {
    id: seriesRef.id,
    ...seriesValues(input, recurrence, firstTaskId, true),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as TaskSeries;

  await runTransaction(db, async (transaction) => {
    transaction.set(seriesRef, {
      ...seriesValues(input, recurrence, firstTaskId, true),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(firstTaskRef, {
      ...taskValues({ ...input, dueAt: timestampFromDateInput(recurrence.startDate) }),
      status: "todo",
      completedAt: null,
      recurrenceId: series.id,
      occurrenceDate: recurrence.startDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateTask(
  userId: string,
  current: LifeTask,
  input: TaskInput,
): Promise<void> {
  const db = requireDatabase();
  const taskRef = doc(db, "users", userId, "tasks", current.id);
  const newSeriesRef = !current.recurrenceId && input.recurrence
    ? doc(collection(db, "users", userId, "taskSeries"))
    : null;

  await runTransaction(db, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) throw new Error("This task no longer exists.");

    const stored = taskSnapshot.data();
    const storedRecurrenceId = (stored.recurrenceId as string | null) ?? null;
    const seriesRef = storedRecurrenceId
      ? doc(db, "users", userId, "taskSeries", storedRecurrenceId)
      : newSeriesRef;
    const seriesSnapshot = storedRecurrenceId && seriesRef
      ? await transaction.get(seriesRef)
      : null;
    const priorSeries = seriesSnapshot?.exists()
      ? ({ id: storedRecurrenceId, ...seriesSnapshot.data() } as TaskSeries)
      : null;
    const recurrence = input.recurrence;
    const wasClosed = stored.status === "done" || stored.status === "cancelled";
    const willClose = input.status === "done" || input.status === "cancelled";
    const nextOccurrenceDateValue = (stored.occurrenceDate as string | null) ?? recurrence?.startDate ?? null;
    const recurrenceId = storedRecurrenceId ?? (recurrence ? newSeriesRef?.id ?? null : null);
    const dueAt = !storedRecurrenceId && recurrence
      ? input.dueAt ?? timestampFromDateInput(recurrence.startDate)
      : input.dueAt;
    const completedAt = input.status !== "done"
      ? null
      : stored.status === "done"
        ? stored.completedAt ?? null
        : serverTimestamp();

    let seriesForNext: TaskSeries | null = priorSeries;
    let shouldWriteSeries = false;
    let shouldQueueNext = false;
    let startingSeries = false;

    if (recurrence && newSeriesRef && recurrenceId && nextOccurrenceDateValue) {
      startingSeries = true;
      shouldWriteSeries = true;
      shouldQueueNext = willClose;
      seriesForNext = {
        id: recurrenceId,
        ...seriesValues(input, recurrence, current.id, true),
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      };
    } else if (priorSeries && recurrence) {
      const wasActive = priorSeries.active;
      const reactivating = !wasActive || priorSeries.currentOccurrenceId == null;
      const currentId = reactivating ? current.id : priorSeries.currentOccurrenceId;
      seriesForNext = {
        ...priorSeries,
        ...seriesValues(input, recurrence, currentId, true),
        updatedAt: priorSeries.updatedAt,
      };
      shouldWriteSeries = true;
      shouldQueueNext = (reactivating && willClose) ||
        (!reactivating && currentId === current.id && !wasClosed && willClose);
    } else if (priorSeries && !recurrence) {
      seriesForNext = { ...priorSeries, active: false, currentOccurrenceId: null };
      shouldWriteSeries = priorSeries.active || priorSeries.currentOccurrenceId != null;
    }

    transaction.update(taskRef, {
      ...taskValues({ ...input, dueAt }),
      completedAt,
      recurrenceId,
      occurrenceDate: nextOccurrenceDateValue,
      updatedAt: serverTimestamp(),
    });

    if (seriesRef && shouldWriteSeries && seriesForNext) {
      let pointer = {
        active: seriesForNext.active,
        currentOccurrenceId: seriesForNext.currentOccurrenceId,
      };
      if (shouldQueueNext && (startingSeries || seriesForNext.active)) {
        pointer = writeNextOccurrence(
          transaction,
          userId,
          seriesForNext,
          nextOccurrenceDateValue ?? seriesForNext.startDate,
        );
      }
      if (startingSeries) {
        transaction.set(seriesRef, {
          ...seriesValues(input, recurrence!, pointer.currentOccurrenceId, pointer.active),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.update(seriesRef, {
          ...seriesValues(
            input,
            recurrence ?? {
              frequency: seriesForNext.frequency,
              interval: seriesForNext.interval,
              startDate: seriesForNext.startDate,
              endDate: seriesForNext.endDate,
            },
            pointer.currentOccurrenceId,
            pointer.active,
          ),
          updatedAt: serverTimestamp(),
        });
      }
    }
  });
}

export async function setTaskCompleted(
  userId: string,
  task: LifeTask,
  completed: boolean,
): Promise<void> {
  const db = requireDatabase();
  const taskRef = doc(db, "users", userId, "tasks", task.id);

  await runTransaction(db, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) return;
    const stored = taskSnapshot.data();
    const recurrenceId = (stored.recurrenceId as string | null) ?? null;
    const seriesRef = recurrenceId
      ? doc(db, "users", userId, "taskSeries", recurrenceId)
      : null;
    const seriesSnapshot = completed && seriesRef
      ? await transaction.get(seriesRef)
      : null;
    const series = seriesSnapshot?.exists()
      ? ({ id: recurrenceId, ...seriesSnapshot.data() } as TaskSeries)
      : null;
    const wasClosed = stored.status === "done" || stored.status === "cancelled";
    const nextStatus: TaskStatus = completed
      ? "done"
      : wasClosed
        ? "todo"
        : stored.status as TaskStatus;
    const completedAt = completed
      ? stored.status === "done"
        ? stored.completedAt
        : serverTimestamp()
      : null;

    transaction.update(taskRef, {
      status: nextStatus,
      completedAt,
      updatedAt: serverTimestamp(),
    });

    const isCurrent = series?.active && series.currentOccurrenceId === task.id;
    if (completed && !wasClosed && isCurrent && series && seriesRef) {
      const pointer = writeNextOccurrence(
        transaction,
        userId,
        series,
        (stored.occurrenceDate as string | null) ?? dateInputValue(stored.dueAt as Timestamp),
      );
      transaction.update(seriesRef, { ...pointer, updatedAt: serverTimestamp() });
    }
  });
}

export async function undoTaskCompletion(
  userId: string,
  task: LifeTask,
): Promise<void> {
  const db = requireDatabase();
  const taskRef = doc(db, "users", userId, "tasks", task.id);

  await runTransaction(db, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) return;
    const stored = taskSnapshot.data();
    const recurrenceId = (stored.recurrenceId as string | null) ?? null;
    const seriesRef = recurrenceId
      ? doc(db, "users", userId, "taskSeries", recurrenceId)
      : null;
    const seriesSnapshot = seriesRef ? await transaction.get(seriesRef) : null;
    const series = seriesSnapshot?.exists()
      ? ({ id: recurrenceId, ...seriesSnapshot.data() } as TaskSeries)
      : null;
    const nextTaskRef = series?.currentOccurrenceId && series.currentOccurrenceId !== task.id
      ? doc(db, "users", userId, "tasks", series.currentOccurrenceId)
      : null;
    const nextTaskSnapshot = nextTaskRef ? await transaction.get(nextTaskRef) : null;

    if (series && seriesRef && stored.status === "done") {
      if (nextTaskRef && nextTaskSnapshot?.exists()) {
        const nextTask = nextTaskSnapshot.data();
        const untouched = nextTask.status === "todo" &&
          nextTask.createdAt instanceof Timestamp &&
          nextTask.updatedAt instanceof Timestamp &&
          nextTask.createdAt.isEqual(nextTask.updatedAt);
        if (!untouched) {
          throw new Error("The next repeat has already changed, so this completion can no longer be undone.");
        }
        transaction.delete(nextTaskRef);
      }
      transaction.update(seriesRef, {
        active: true,
        currentOccurrenceId: task.id,
        updatedAt: serverTimestamp(),
      });
    }

    transaction.update(taskRef, {
      status: task.status,
      completedAt: null,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function removeTask(userId: string, taskId: string): Promise<void> {
  const db = requireDatabase();
  const taskRef = doc(db, "users", userId, "tasks", taskId);

  await runTransaction(db, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) return;
    const stored = taskSnapshot.data();
    const recurrenceId = (stored.recurrenceId as string | null) ?? null;
    const seriesRef = recurrenceId
      ? doc(db, "users", userId, "taskSeries", recurrenceId)
      : null;
    const seriesSnapshot = seriesRef ? await transaction.get(seriesRef) : null;
    const series = seriesSnapshot?.exists()
      ? ({ id: recurrenceId, ...seriesSnapshot.data() } as TaskSeries)
      : null;

    transaction.delete(taskRef);
    if (seriesRef && series?.active && series.currentOccurrenceId === taskId) {
      const pointer = writeNextOccurrence(
        transaction,
        userId,
        series,
        (stored.occurrenceDate as string | null) ?? dateInputValue(stored.dueAt as Timestamp),
      );
      transaction.update(seriesRef, { ...pointer, updatedAt: serverTimestamp() });
    }
  });
}

export function dateInputValue(timestamp: Timestamp | null): string {
  if (!timestamp) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp.toDate());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return value("year") + "-" + value("month") + "-" + value("day");
}

export function timestampFromDateInput(value: string): Timestamp | null {
  if (!value) return null;
  return Timestamp.fromDate(new Date(value + "T00:00:00+08:00"));
}