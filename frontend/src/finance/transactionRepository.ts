import { Timestamp, collection, doc, getDocs, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "../auth/FirebaseAuthProvider";
import type { AccountType } from "./accountRepository";

export type TransactionKind = "income" | "expense" | "transfer";
export type CategoryKind = Exclude<TransactionKind, "transfer">;
export type LifeCategory = {
  id: string;
  name: string;
  kind: CategoryKind;
  colorKey: string | null;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
export type LifeTransaction = {
  id: string;
  kind: "income" | "expense" | "transfer";
  amountSen: number;
  occurredAt: Timestamp;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  memo: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
export type TransactionInput = {
  kind: TransactionKind;
  amountSen: number;
  occurredAt: Timestamp;
  accountId: string;
  toAccountId: string | null;
  categoryName: string | null;
  memo: string | null;
};

function database() {
  if (!firestoreDb) throw new Error("Firebase is not configured for this app.");
  return firestoreDb;
}

export function subscribeToTransactions(userId: string, onTransactions: (items: LifeTransaction[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(database(), "users", userId, "transactions"), (snapshot) => {
    onTransactions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LifeTransaction));
  }, onError);
}

export function subscribeToCategories(userId: string, onCategories: (items: LifeCategory[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(database(), "users", userId, "categories"), (snapshot) => {
    onCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LifeCategory));
  }, onError);
}

async function resolveCategory(userId: string, name: string, kind: CategoryKind): Promise<string> {
  const db = database();
  const snapshot = await getDocs(collection(db, "users", userId, "categories"));
  const existing = snapshot.docs.find((item) => {
    const data = item.data();
    return data.kind === kind && data.archived === false && typeof data.name === "string" && data.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase();
  });
  if (existing) return existing.id;

  const categoryRef = doc(collection(db, "users", userId, "categories"));
  await setDoc(categoryRef, { name, kind, colorKey: null, archived: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return categoryRef.id;
}

export async function createTransaction(userId: string, input: TransactionInput): Promise<void> {
  const db = database();
  const categoryName = input.categoryName?.trim() ?? "";
  const categoryId = categoryName && input.kind !== "transfer"
    ? await resolveCategory(userId, categoryName, input.kind)
    : null;
  const ref = doc(collection(db, "users", userId, "transactions"));
  await setDoc(ref, {
    kind: input.kind,
    amountSen: input.amountSen,
    occurredAt: input.occurredAt,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    categoryId,
    memo: input.memo?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function accountBalanceSen(accountId: string, accountType: AccountType, openingBalanceSen: number, transactions: LifeTransaction[]): number {
  return transactions.reduce((balance, item) => {
    if (item.kind === "transfer") {
      if (item.accountId === accountId) return balance + (accountType === "creditCard" ? item.amountSen : -item.amountSen);
      if (item.toAccountId === accountId) return balance + (accountType === "creditCard" ? -item.amountSen : item.amountSen);
      return balance;
    }
    if (item.accountId !== accountId) return balance;
    if (accountType === "creditCard") return balance + (item.kind === "expense" ? item.amountSen : -item.amountSen);
    return balance + (item.kind === "income" ? item.amountSen : -item.amountSen);
  }, openingBalanceSen);
}

