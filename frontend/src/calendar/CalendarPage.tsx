import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { Timestamp } from "firebase/firestore";
import { Button, Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";
import { ensureUserProfile, subscribeToTasks, type LifeTask } from "../tasks/taskRepository";
import { deleteAppointment, saveAppointment, subscribeToAppointments, type Appointment, type AppointmentInput } from "./calendarRepository";

const zone = "Asia/Kuala_Lumpur";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function parseKey(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day)); }
function addDays(value: string, amount: number) { const date = parseKey(value); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function dayStart(value: string) { return Timestamp.fromDate(new Date(`${value}T00:00:00+08:00`)); }
function dateTimeValue(timestamp: Timestamp) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(timestamp.toDate());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}
function fromDateTimeValue(value: string) { return Timestamp.fromDate(new Date(`${value}:00+08:00`)); }
function formatDate(value: string, options: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat("en-MY", { timeZone: zone, ...options }).format(parseKey(value)); }
function formatMonth(value: string) { return formatDate(value, { month: "long", year: "numeric" }); }
function formatTime(value: Timestamp) { return new Intl.DateTimeFormat("en-MY", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(value.toDate()); }
function startOfWeek(value: string) { return addDays(value, -parseKey(value).getUTCDay()); }
function todayKey() { return dateKey(new Date()); }
function eventOnDay(item: Appointment, day: string) { return item.startAt.toMillis() < dayStart(addDays(day, 1)).toMillis() && item.endAt.toMillis() > dayStart(day).toMillis(); }
function errorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") return "Firestore denied this request. Deploy the reviewed LOS-005/LOS-008 rules and check that your profile is available.";
  if (error instanceof FirebaseError && error.code === "unavailable") return "LifeOS could not reach Firestore. Check your connection and try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Your calendar could not be loaded or saved. Please try again.";
}

type FormState = { title: string; details: string; location: string; start: string; end: string; allDay: boolean; taskId: string };
function blankForm(day: string): FormState { return { title: "", details: "", location: "", start: `${day}T09:00`, end: `${day}T10:00`, allDay: false, taskId: "" }; }

function AppointmentEditor({ appointment, day, tasks, appointments, saving, onSave, onDelete, onCancel }: {
  appointment: Appointment | null; day: string; tasks: LifeTask[]; appointments: Appointment[]; saving: boolean;
  onSave: (input: AppointmentInput, id?: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => appointment ? {
    title: appointment.title, details: appointment.details ?? "", location: appointment.location ?? "",
    start: appointment.allDay ? `${dateTimeValue(appointment.startAt).slice(0, 10)}T00:00` : dateTimeValue(appointment.startAt),
    end: appointment.allDay ? `${addDays(dateTimeValue(appointment.endAt).slice(0, 10), -1)}T00:00` : dateTimeValue(appointment.endAt),
    allDay: appointment.allDay, taskId: appointment.taskId ?? "",
  } : blankForm(day));
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const startAt = form.allDay ? dayStart(form.start.slice(0, 10)) : form.start ? fromDateTimeValue(form.start) : null;
  const endAt = form.allDay ? dayStart(addDays(form.end.slice(0, 10), 1)) : form.end ? fromDateTimeValue(form.end) : null;
  const overlaps = startAt && endAt && endAt.toMillis() > startAt.toMillis()
    ? appointments.filter((item) => item.id !== appointment?.id && item.startAt.toMillis() < endAt.toMillis() && item.endAt.toMillis() > startAt.toMillis())
    : [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return setFormError("Add an appointment name before saving.");
    if (form.title.trim().length > 160 || form.details.trim().length > 2000 || form.location.trim().length > 200) return setFormError("One or more fields are longer than the allowed limit.");
    if (!startAt || !endAt || endAt.toMillis() <= startAt.toMillis()) return setFormError("The end time must be after the start time.");
    setFormError("");
    await onSave({ title: form.title.trim(), details: form.details.trim() || null, location: form.location.trim() || null, startAt, endAt, allDay: form.allDay, timeZone: zone, taskId: form.taskId || null }, appointment?.id);
  }

  function toggleAllDay(allDay: boolean) {
    setForm((current) => ({
      ...current,
      allDay,
      start: allDay ? current.start.slice(0, 10) : `${current.start.slice(0, 10)}T09:00`,
      end: allDay ? current.end.slice(0, 10) : `${current.end.slice(0, 10)}T10:00`,
    }));
  }

  return <Card className="calendar-editor"><form onSubmit={(event) => void submit(event)}>
    <div className="calendar-editor-heading"><div><p className="text-eyebrow">APPOINTMENT</p><h2>{appointment ? "Edit appointment" : "New appointment"}</h2></div><Button onClick={onCancel} variant="ghost">Close</Button></div>
    <label className="task-field task-field--wide"><span>Name</span><input autoFocus maxLength={160} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label>
    <div className="task-form-grid">
      <label className="task-field"><span>Starts</span><input onChange={(event) => setForm({ ...form, start: form.allDay ? `${event.target.value}T00:00` : event.target.value })} required type={form.allDay ? "date" : "datetime-local"} value={form.allDay ? form.start.slice(0, 10) : form.start} /></label>
      <label className="task-field"><span>Ends {form.allDay && <small>(inclusive date)</small>}</span><input onChange={(event) => setForm({ ...form, end: form.allDay ? `${event.target.value}T00:00` : event.target.value })} required type={form.allDay ? "date" : "datetime-local"} value={form.allDay ? form.end.slice(0, 10) : form.end} /></label>
      <label className="task-field"><span>Location <small>(optional)</small></span><input maxLength={200} onChange={(event) => setForm({ ...form, location: event.target.value })} value={form.location} /></label>
      <label className="task-field"><span>Link a task <small>(optional)</small></span><select onChange={(event) => setForm({ ...form, taskId: event.target.value })} value={form.taskId}><option value="">No linked task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
    </div>
    <label className="calendar-all-day"><input checked={form.allDay} onChange={(event) => toggleAllDay(event.target.checked)} type="checkbox" /> All-day appointment</label>
    <label className="task-field task-field--wide"><span>Notes <small>(optional)</small></span><textarea maxLength={2000} onChange={(event) => setForm({ ...form, details: event.target.value })} rows={3} value={form.details} /></label>
    {overlaps.length > 0 && <p className="calendar-overlap" role="status">Overlaps with {overlaps.map((item) => item.title).join(", ")}. You can still save it.</p>}
    {formError && <p className="task-form-error" role="alert">{formError}</p>}
    <div className="task-form-actions">{appointment && (confirmDelete ? <><Button disabled={saving} onClick={() => void onDelete(appointment.id)} variant="ghost">Confirm delete</Button><Button onClick={() => setConfirmDelete(false)} variant="ghost">Keep appointment</Button></> : <Button onClick={() => setConfirmDelete(true)} variant="ghost">Delete</Button>)}<Button onClick={onCancel} variant="ghost">Cancel</Button><Button disabled={saving} type="submit" variant="primary">{saving ? "Saving…" : "Save appointment"}</Button></div>
  </form></Card>;
}

export function CalendarPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<LifeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [shownMonth, setShownMonth] = useState(todayKey().slice(0, 7));
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    let stopAppointments: (() => void) | undefined;
    let stopTasks: (() => void) | undefined;
    setLoading(true);
    void ensureUserProfile(user).then(() => {
      if (cancelled) return;
      stopAppointments = subscribeToAppointments(user.uid, setAppointments, (value) => { setError(errorMessage(value)); setLoading(false); });
      stopTasks = subscribeToTasks(user.uid, setTasks, (value) => { setError(errorMessage(value)); setLoading(false); });
      setLoading(false);
    }).catch((value: unknown) => { if (!cancelled) { setError(errorMessage(value)); setLoading(false); } });
    return () => { cancelled = true; stopAppointments?.(); stopTasks?.(); };
  }, [user]);

  const cells = useMemo(() => {
    const [year, month] = shownMonth.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    let cursor = addDays(first.toISOString().slice(0, 10), -first.getUTCDay());
    return Array.from({ length: 42 }, () => { const value = cursor; cursor = addDays(cursor, 1); return value; });
  }, [shownMonth]);
  const selectedAppointments = useMemo(() => appointments.filter((item) => eventOnDay(item, selectedDay)).sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis()), [appointments, selectedDay]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDay), index)), [selectedDay]);

  async function save(input: AppointmentInput, id?: string) {
    if (!user) return;
    setSaving(true); setError("");
    try { await saveAppointment(user.uid, input, id); setEditorOpen(false); setEditing(null); }
    catch (value) { setError(errorMessage(value)); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!user) return;
    setSaving(true); setError("");
    try { await deleteAppointment(user.uid, id); setEditorOpen(false); setEditing(null); }
    catch (value) { setError(errorMessage(value)); }
    finally { setSaving(false); }
  }
  function moveMonth(amount: number) {
    const [year, month] = shownMonth.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 7);
    const [nextYear, nextNumber] = nextMonth.split("-").map(Number);
    const requestedDay = Number(selectedDay.slice(8, 10));
    const lastDay = new Date(Date.UTC(nextYear, nextNumber, 0)).getUTCDate();
    setShownMonth(nextMonth);
    setSelectedDay(`${nextMonth}-${String(Math.min(requestedDay, lastDay)).padStart(2, "0")}`);
  }

  return <div className="calendar-page">
    <header className="calendar-heading"><div><p className="text-eyebrow">YOUR TIME, WITH ROOM TO BREATHE</p><h1 className="heading-display">Calendar</h1></div><Button onClick={() => { setEditing(null); setEditorOpen(true); }} variant="primary">＋ New appointment</Button></header>
    {error && <p className="tasks-error" role="alert">{error}</p>}
    {editorOpen && <AppointmentEditor key={editing?.id ?? `new-${selectedDay}`} appointment={editing} day={selectedDay} tasks={tasks} appointments={appointments} saving={saving} onSave={save} onDelete={remove} onCancel={() => { setEditorOpen(false); setEditing(null); }} />}
    <Card className="calendar-shell">
      <div className="calendar-toolbar"><div><h2>{formatMonth(`${shownMonth}-01`)}</h2><p className="text-muted">All times in Kuala Lumpur</p></div><div className="calendar-nav"><Button aria-label="Previous month" onClick={() => moveMonth(-1)} variant="ghost">‹</Button><Button onClick={() => { setSelectedDay(todayKey()); setShownMonth(todayKey().slice(0, 7)); }} variant="ghost">Today</Button><Button aria-label="Next month" onClick={() => moveMonth(1)} variant="ghost">›</Button></div></div>
      <div className="calendar-week-strip" aria-label="Choose a day">{weekDays.map((day) => <button aria-pressed={selectedDay === day} className={selectedDay === day ? "calendar-week-day is-selected" : "calendar-week-day"} key={day} onClick={() => { setSelectedDay(day); setShownMonth(day.slice(0, 7)); }} type="button"><span>{weekdays[parseKey(day).getUTCDay()]}</span><strong>{parseKey(day).getUTCDate()}</strong><small>{appointments.filter((item) => eventOnDay(item, day)).length || " "}</small></button>)}</div>
      <div className="calendar-grid" role="grid" aria-label={formatMonth(`${shownMonth}-01`)}>{weekdays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}{cells.map((day) => {
        const items = appointments.filter((item) => eventOnDay(item, day));
        return <button aria-label={`${formatDate(day, { weekday: "long", day: "numeric", month: "long" })}${items.length ? `, ${items.length} appointments` : ""}`} aria-pressed={selectedDay === day} className={`calendar-day${day.slice(0, 7) !== shownMonth ? " is-outside" : ""}${selectedDay === day ? " is-selected" : ""}${day === todayKey() ? " is-today" : ""}`} key={day} onClick={() => { setSelectedDay(day); setShownMonth(day.slice(0, 7)); }} role="gridcell" type="button"><span>{parseKey(day).getUTCDate()}</span>{items.slice(0, 2).map((item) => <span className="calendar-day-event" key={item.id}>{item.title}</span>)}{items.length > 2 && <small>+{items.length - 2} more</small>}</button>;
      })}</div>
    </Card>
    <section className="calendar-agenda" aria-label="Appointments for selected day"><div className="calendar-agenda-heading"><div><p className="text-eyebrow">DAY PLAN</p><h2>{formatDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</h2></div><Button onClick={() => { setEditing(null); setEditorOpen(true); }} variant="secondary">Add to day</Button></div>
      {loading ? <Card className="task-empty"><p>Loading your calendar…</p></Card> : selectedAppointments.length === 0 ? <Card className="task-empty"><h3>No appointments scheduled</h3><p>Keep this time open, or add something you want to remember.</p><Button onClick={() => { setEditing(null); setEditorOpen(true); }} variant="secondary">Add an appointment</Button></Card> : <div className="calendar-appointment-list">{selectedAppointments.map((item) => <Card className="calendar-appointment" key={item.id} padding="compact"><div className="calendar-appointment-time">{item.allDay ? "All day" : `${formatTime(item.startAt)} – ${formatTime(item.endAt)}`}</div><div className="calendar-appointment-main"><h3>{item.title}</h3>{item.location && <p className="text-muted">{item.location}</p>}{item.details && <p className="calendar-appointment-details">{item.details}</p>}{item.taskId && <p className="calendar-task-link">Linked task: {tasks.find((task) => task.id === item.taskId)?.title ?? "Task no longer available"}</p>}</div><Button aria-label={`Edit ${item.title}`} onClick={() => { setEditing(item); setEditorOpen(true); }} variant="ghost">Edit</Button></Card>)}</div>}
    </section>
  </div>;
}
