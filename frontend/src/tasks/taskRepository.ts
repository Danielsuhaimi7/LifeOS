import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { firestoreDb } from "../auth/FirebaseAuthProvider";

export type TaskStatus = "todo" | "inProgress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";

export type LifeTask = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Timestamp | null;
  completedAt: Timestamp | null;
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
    (error) => onError(error),
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

export async function createTask(userId: string, input: TaskInput): Promise<void> {
  const db = requireDatabase();
  const taskRef = doc(collection(db, "users", userId, "tasks"));
  const completedAt = input.status === "done" ? serverTimestamp() : null;

  await setDoc(taskRef, {
    ...taskValues(input),
    completedAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(
  userId: string,
  current: LifeTask,
  input: TaskInput,
): Promise<void> {
  const db = requireDatabase();
  const taskRef = doc(db, "users", userId, "tasks", current.id);
  const completedAt = input.status !== "done"
    ? null
    : current.status === "done"
      ? current.completedAt
      : serverTimestamp();

  await updateDoc(taskRef, {
    ...taskValues(input),
    completedAt,
    updatedAt: serverTimestamp(),
  });
}

export async function setTaskCompleted(
  userId: string,
  task: LifeTask,
  completed: boolean,
): Promise<void> {
  const db = requireDatabase();
  const taskRef = doc(db, "users", userId, "tasks", task.id);

  await updateDoc(taskRef, {
    status: completed ? "done" : task.status === "done" || task.status === "cancelled" ? "todo" : task.status,
    completedAt: completed ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export async function removeTask(userId: string, taskId: string): Promise<void> {
  await deleteDoc(doc(requireDatabase(), "users", userId, "tasks", taskId));
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