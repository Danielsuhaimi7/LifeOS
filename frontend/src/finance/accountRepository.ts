import { Timestamp, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "../auth/FirebaseAuthProvider";

export type AccountType = "cash" | "bank" | "investment" | "creditCard" | "other";
export type LifeAccount = {
  id: string;
  name: string;
  type: AccountType;
  currency: "MYR";
  openingBalanceSen: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
export type AccountInput = Pick<LifeAccount, "name" | "type" | "openingBalanceSen">;

function database() {
  if (!firestoreDb) throw new Error("Firebase is not configured for this app.");
  return firestoreDb;
}

export function subscribeToAccounts(userId: string, onAccounts: (accounts: LifeAccount[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(database(), "users", userId, "accounts"), (snapshot) => {
    onAccounts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LifeAccount));
  }, onError);
}

export async function saveAccount(userId: string, input: AccountInput, id?: string): Promise<void> {
  const db = database();
  const ref = id ? doc(db, "users", userId, "accounts", id) : doc(collection(db, "users", userId, "accounts"));
  const values = { name: input.name.trim(), type: input.type, currency: "MYR" as const, openingBalanceSen: input.openingBalanceSen, updatedAt: serverTimestamp() };
  if (id) await updateDoc(ref, values);
  else await setDoc(ref, { ...values, archived: false, createdAt: serverTimestamp() });
}

export async function setAccountArchived(userId: string, accountId: string, archived: boolean): Promise<void> {
  await updateDoc(doc(database(), "users", userId, "accounts", accountId), { archived, updatedAt: serverTimestamp() });
}
