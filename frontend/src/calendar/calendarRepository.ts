import { Timestamp, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "../auth/FirebaseAuthProvider";

export type Appointment = {
  id: string; title: string; details: string | null; location: string | null;
  startAt: Timestamp; endAt: Timestamp; allDay: boolean;
  timeZone: "Asia/Kuala_Lumpur"; taskId: string | null;
  createdAt: Timestamp; updatedAt: Timestamp;
};

export type AppointmentInput = Omit<Appointment, "id" | "createdAt" | "updatedAt">;

function database() {
  if (!firestoreDb) throw new Error("Firebase is not configured for this app.");
  return firestoreDb;
}

export function subscribeToAppointments(userId: string, onAppointments: (items: Appointment[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(database(), "users", userId, "appointments"), (snapshot) => {
    onAppointments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Appointment));
  }, onError);
}

export async function saveAppointment(userId: string, input: AppointmentInput, id?: string) {
  const db = database();
  const ref = id ? doc(db, "users", userId, "appointments", id) : doc(collection(db, "users", userId, "appointments"));
  const values = { ...input, updatedAt: serverTimestamp() };
  if (id) await updateDoc(ref, values);
  else await setDoc(ref, { ...values, createdAt: serverTimestamp() });
}

export async function deleteAppointment(userId: string, id: string) {
  await deleteDoc(doc(database(), "users", userId, "appointments", id));
}
