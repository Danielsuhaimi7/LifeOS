import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "../auth/FirebaseAuthProvider";
import type { Timestamp } from "firebase/firestore";

export type LifeBudget = {
  id: string;
  categoryId: string;
  monthKey: string;
  amountSen: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

function database() {
  if (!firestoreDb) throw new Error("Firebase is not configured for this app.");
  return firestoreDb;
}

function budgetId(monthKey: string, categoryId: string) {
  return `${monthKey}_${categoryId}`;
}

export function subscribeToBudgets(userId: string, monthKey: string, onBudgets: (items: LifeBudget[]) => void, onError: (error: Error) => void): Unsubscribe {
  const budgets = collection(database(), "users", userId, "budgets");
  return onSnapshot(query(budgets, where("monthKey", "==", monthKey)), (snapshot) => {
    onBudgets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LifeBudget));
  }, onError);
}

export async function saveBudget(userId: string, monthKey: string, categoryId: string, amountSen: number): Promise<void> {
  const ref = doc(database(), "users", userId, "budgets", budgetId(monthKey, categoryId));
  const existing = await getDoc(ref);
  if (existing.exists()) await updateDoc(ref, { amountSen, updatedAt: serverTimestamp() });
  else await setDoc(ref, { categoryId, monthKey, amountSen, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function deleteBudget(userId: string, monthKey: string, categoryId: string): Promise<void> {
  await deleteDoc(doc(database(), "users", userId, "budgets", budgetId(monthKey, categoryId)));
}
