import { useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import { Timestamp } from "firebase/firestore";
import { NavLink } from "react-router";
import { Button, Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";
import { dateInputValue, ensureUserProfile, setTaskCompleted, subscribeToTasks, undoTaskCompletion, type LifeTask } from "../tasks/taskRepository";
import { subscribeToAppointments, type Appointment } from "../calendar/calendarRepository";

const zone = "Asia/Kuala_Lumpur";

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function dayLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-MY", { timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, day)));
}
function timeLabel(value: Appointment["startAt"]) { return new Intl.DateTimeFormat("en-MY", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(value.toDate()); }
function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
function errorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") return "Firestore denied this request. Check that the reviewed LOS-005/LOS-006/LOS-007/LOS-008 rules are deployed.";
  if (error instanceof FirebaseError && error.code === "unavailable") return "LifeOS could not reach Firestore. Check your connection and try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Your dashboard could not be loaded. Please try again.";
}
function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}
function dayStart(value: string) { return Timestamp.fromDate(new Date(`${value}T00:00:00+08:00`)); }
function appointmentOnDay(item: Appointment, day: string) {
  return item.startAt.toMillis() < dayStart(addDays(day, 1)).toMillis() && item.endAt.toMillis() > dayStart(day).toMillis();
}

export function DashboardPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<LifeTask[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [undoTask, setUndoTask] = useState<LifeTask | null>(null);
  const today = dateKey(new Date());

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    let stopTasks: (() => void) | undefined;
    let stopAppointments: (() => void) | undefined;
    setLoading(true);
    void ensureUserProfile(user).then(() => {
      if (cancelled) return;
      stopTasks = subscribeToTasks(user.uid, setTasks, (value) => { setError(errorMessage(value)); setLoading(false); });
      stopAppointments = subscribeToAppointments(user.uid, setAppointments, (value) => { setError(errorMessage(value)); setLoading(false); });
      setLoading(false);
    }).catch((value: unknown) => { if (!cancelled) { setError(errorMessage(value)); setLoading(false); } });
    return () => { cancelled = true; stopTasks?.(); stopAppointments?.(); };
  }, [user]);

  useEffect(() => {
    if (!undoTask) return;
    const timeout = window.setTimeout(() => setUndoTask(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [undoTask]);

  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const todayTasks = useMemo(() => openTasks.filter((task) => task.dueAt && dateInputValue(task.dueAt) === today).sort((a, b) => (a.priority === "high" ? -1 : 0) - (b.priority === "high" ? -1 : 0) || a.title.localeCompare(b.title)), [openTasks, today]);
  const overdueTasks = openTasks.filter((task) => task.dueAt && dateInputValue(task.dueAt) < today);
  const upcomingAppointments = useMemo(() => appointments.filter((item) => item.endAt.toMillis() > dayStart(today).toMillis() && item.startAt.toMillis() < dayStart(addDays(today, 7)).toMillis()).sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis()), [appointments, today]);
  const todayAppointments = appointments.filter((item) => appointmentOnDay(item, today)).length;

  async function completeTask(task: LifeTask) {
    if (!user) return;
    setSavingTaskId(task.id); setError("");
    try { await setTaskCompleted(user.uid, task, true); setUndoTask(task); }
    catch (value) { setError(errorMessage(value)); }
    finally { setSavingTaskId(null); }
  }

  async function undoCompletion() {
    if (!user || !undoTask) return;
    try { await undoTaskCompletion(user.uid, undoTask); setUndoTask(null); setError(""); }
    catch (value) { setError(errorMessage(value)); }
  }

  const displayName = user?.displayName?.trim().split(/\s+/)[0];
  return <div className="dashboard-page">
    <header className="dashboard-heading"><div><p className="text-eyebrow">{dayLabel(today).toUpperCase()}</p><h1 className="heading-display">{greeting()}{displayName ? `, ${displayName}` : ""}.</h1><p className="text-body">Your day, at a glance.</p></div><NavLink className="button button--primary" to="/tasks">＋ New task</NavLink></header>
    {error && <p className="tasks-error" role="alert">{error}</p>}
    {undoTask && <div className="task-undo" role="status"><span>Task completed</span><Button onClick={() => void undoCompletion()} variant="ghost">Undo</Button></div>}
    <section className="dashboard-summary" aria-label="Today's summary">
      <Card className="dashboard-summary-card"><span className="dashboard-summary-icon" aria-hidden="true">✓</span><div><span>Tasks today</span><strong>{loading ? "—" : todayTasks.length}</strong><small>{todayTasks.length === 1 ? "step to focus on" : "steps to focus on"}</small></div></Card>
      <Card className="dashboard-summary-card"><span className="dashboard-summary-icon" aria-hidden="true">◷</span><div><span>Appointments today</span><strong>{loading ? "—" : todayAppointments}</strong><small>{todayAppointments === 1 ? "time set aside" : "times set aside"}</small></div></Card>
      <Card className="dashboard-summary-card"><span className="dashboard-summary-icon" aria-hidden="true">↗</span><div><span>Overdue tasks</span><strong>{loading ? "—" : overdueTasks.length}</strong><small>{overdueTasks.length ? "ready for a fresh look" : "nothing waiting"}</small></div></Card>
    </section>

    <div className="dashboard-content-grid">
      <section className="dashboard-section" aria-label="Today's tasks"><div className="dashboard-section-heading"><div><p className="text-eyebrow">A GOOD PLACE TO START</p><h2>Today’s tasks</h2></div><NavLink to="/tasks">View all</NavLink></div>
        {loading ? <Card className="dashboard-empty"><p>Loading your day…</p></Card> : todayTasks.length === 0 ? <Card className="dashboard-empty"><span aria-hidden="true">✦</span><h3>A little room to breathe</h3><p>No tasks are due today. Add one whenever something needs a place.</p><NavLink className="button button--secondary" to="/tasks">Open tasks</NavLink></Card> : <Card className="dashboard-task-list" padding="compact">{todayTasks.slice(0, 6).map((task) => <div className="dashboard-task-row" key={task.id}><button aria-label={`Complete ${task.title}`} className="dashboard-task-check" disabled={savingTaskId === task.id} onClick={() => void completeTask(task)} type="button">{savingTaskId === task.id ? "…" : ""}</button><div><strong>{task.title}</strong>{task.category && <span>{task.category}</span>}</div>{task.priority === "high" && <small>High</small>}</div>)}{todayTasks.length > 6 && <NavLink className="dashboard-more-link" to="/tasks">See {todayTasks.length - 6} more tasks</NavLink>}</Card>}
      </section>

      <section className="dashboard-section" aria-label="Upcoming appointments"><div className="dashboard-section-heading"><div><p className="text-eyebrow">MAKE SPACE FOR WHAT MATTERS</p><h2>Coming up</h2></div><NavLink to="/calendar">Calendar</NavLink></div>
        {loading ? <Card className="dashboard-empty"><p>Loading your appointments…</p></Card> : upcomingAppointments.length === 0 ? <Card className="dashboard-empty"><span aria-hidden="true">◷</span><h3>Your week is open</h3><p>Appointments you add will appear here.</p><NavLink className="button button--secondary" to="/calendar">Open calendar</NavLink></Card> : <div className="dashboard-appointment-list">{upcomingAppointments.slice(0, 5).map((item) => { const day = dateInputValue(item.startAt); return <Card className="dashboard-appointment" key={item.id} padding="compact"><div className="dashboard-appointment-date"><strong>{day.slice(8, 10)}</strong><span>{new Intl.DateTimeFormat("en-MY", { timeZone: zone, month: "short" }).format(item.startAt.toDate())}</span></div><div><strong>{item.title}</strong><span>{day === today ? "Today" : dayLabel(day).split(",")[0]} · {item.allDay ? "All day" : timeLabel(item.startAt)}</span>{item.location && <small>{item.location}</small>}</div></Card>; })}<NavLink className="dashboard-more-link" to="/calendar">View calendar</NavLink></div>}
      </section>
    </div>

    <section className="dashboard-quick-actions" aria-label="Quick actions"><div><p className="text-eyebrow">A FEW SHORTCUTS</p><h2>What would you like to do?</h2></div><div className="dashboard-action-links"><NavLink to="/tasks"><span aria-hidden="true">＋</span><strong>Add a task</strong></NavLink><NavLink to="/calendar"><span aria-hidden="true">◷</span><strong>Plan an appointment</strong></NavLink><NavLink to="/notes"><span aria-hidden="true">✎</span><strong>Write a note</strong></NavLink></div></section>
    <p className="dashboard-finance-note">Finance summaries will appear here when the Finance overview is added.</p>
  </div>;
}
