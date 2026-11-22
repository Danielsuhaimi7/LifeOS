import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { firestoreDb } from "../auth/FirebaseAuthProvider";
import type { CategoryKind } from "./transactionRepository";

function database() {
  if (!firestoreDb) throw new Error("Firebase is not configured for this app.");
  return firestoreDb;
}

export async function createCategory(userId: string, name: string, kind: CategoryKind): Promise<void> {
  const ref = doc(collection(database(), "users", userId, "categories"));
  await setDoc(ref, { name: name.trim(), kind, colorKey: null, archived: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function renameCategory(userId: string, categoryId: string, name: string): Promise<void> {
  await updateDoc(doc(database(), "users", userId, "categories", categoryId), { name: name.trim(), updatedAt: serverTimestamp() });
}

export async function setCategoryArchived(userId: string, categoryId: string, archived: boolean): Promise<void> {
  await updateDoc(doc(database(), "users", userId, "categories", categoryId), { archived, updatedAt: serverTimestamp() });
}
