import { Timestamp, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "../auth/FirebaseAuthProvider";

export type NoteKind = "plain" | "checklist";
export type LifeNote = {
  id: string;
  title: string;
  body: string;
  kind: NoteKind;
  folderId: string | null;
  taskId: string | null;
  appointmentId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
export type NoteFolder = { id: string; name: string; createdAt: Timestamp; updatedAt: Timestamp };
export type NoteInput = Pick<LifeNote, "title" | "body" | "kind" | "folderId" | "taskId" | "appointmentId">;

function database() {
  if (!firestoreDb) throw new Error("Firebase is not configured for this app.");
  return firestoreDb;
}

export function subscribeToNotes(userId: string, onNotes: (notes: LifeNote[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(database(), "users", userId, "notes"), (snapshot) => {
    onNotes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LifeNote));
  }, onError);
}

export function subscribeToNoteFolders(userId: string, onFolders: (folders: NoteFolder[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(database(), "users", userId, "noteFolders"), (snapshot) => {
    onFolders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as NoteFolder));
  }, onError);
}

export async function createNote(userId: string, input: NoteInput): Promise<string> {
  const ref = doc(collection(database(), "users", userId, "notes"));
  await setDoc(ref, { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateNote(userId: string, noteId: string, input: NoteInput): Promise<void> {
  await updateDoc(doc(database(), "users", userId, "notes", noteId), { ...input, title: input.title.trim(), updatedAt: serverTimestamp() });
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(database(), "users", userId, "notes", noteId));
}

export async function createNoteFolder(userId: string, name: string): Promise<void> {
  const ref = doc(collection(database(), "users", userId, "noteFolders"));
  await setDoc(ref, { name: name.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function renameNoteFolder(userId: string, folderId: string, name: string): Promise<void> {
  await updateDoc(doc(database(), "users", userId, "noteFolders", folderId), { name: name.trim(), updatedAt: serverTimestamp() });
}
