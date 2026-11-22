import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { Button, Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";
import {
  createTask,
  dateInputValue,
  ensureUserProfile,
  removeTask,
  setTaskCompleted,
  subscribeToTasks,
  timestampFromDateInput,
  updateTask,
  type LifeTask,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from "./taskRepository";

type TaskFilter = "all" | "today" | "upcoming" | "overdue" | "completed";
type TaskFormState = {
title: string;
description: string;
category: string;
status: TaskStatus;
priority: TaskPriority;
dueDate: string;
};

const emptyForm: TaskFormState = {
  title: "",
  description: "",
  category: "",
  status: "todo",
  priority: "normal",
  dueDate: "",
};

const filters: { id: TaskFilter; label: string }[] = [
  { id: "all", label: "All tasks" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
];

function errorMessage(error: unknown): string {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return "Firestore denied this request. Check that the reviewed LOS-005 rules are deployed and that your profile is available.";
  }
  if (error instanceof FirebaseError && error.code === "unavailable") {
    return "LifeOS could not reach Firestore. Check your connection and try again.";
  }
  return "Your tasks could not be loaded or saved. Please try again.";
}

function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return value("year") + "-" + value("month") + "-" + value("day");
}

function dueDateLabel(task: LifeTask): string {
  if (!task.dueAt) return "No due date";
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(task.dueAt.toDate());
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "inProgress": return "In progress";
    case "done": return "Done";
    case "cancelled": return "Cancelled";
    default: return "To do";
  }
}

function TaskEditor({
  initialTask,
  saving,
  onSave,
  onCancel,
}: {
  initialTask: LifeTask | null;
  saving: boolean;
  onSave: (input: TaskInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TaskFormState>(() => initialTask ? {
    title: initialTask.title,
    description: initialTask.description ?? "",
    category: initialTask.category ?? "",
    status: initialTask.status,
    priority: initialTask.priority,
    dueDate: dateInputValue(initialTask.dueAt),
  } : emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  function update<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setFormError("Add a task name before saving.");
      return;
    }
    if (title.length > 160 || form.description.trim().length > 4000 || form.category.trim().length > 60) {
      setFormError("One or more fields are longer than the allowed limit.");
      return;
    }

    setFormError(null);
    await onSave({
      title,
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      status: form.status,
      priority: form.priority,
      dueAt: timestampFromDateInput(form.dueDate),
    });
  }

  return (
    <Card className="task-editor">
      <form onSubmit={(event) => void submit(event)}>
        <div className="task-editor-heading">
          <div>
            <p className="text-eyebrow">TASK DETAILS</p>
            <h2>{initialTask ? "Edit task" : "Create a task"}</h2>
          </div>
          <Button aria-label="Close task form" onClick={onCancel} variant="ghost">Close</Button>
        </div>

        <label className="task-field task-field--wide">
          <span>Task name</span>
          <input autoFocus maxLength={160} onChange={(event) => update("title", event.target.value)} required value={form.title} />
        </label>

        <div className="task-form-grid">
          <label className="task-field">
            <span>Due date</span>
            <input onChange={(event) => update("dueDate", event.target.value)} type="date" value={form.dueDate} />
          </label>
          <label className="task-field">
            <span>Priority</span>
            <select onChange={(event) => update("priority", event.target.value as TaskPriority)} value={form.priority}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="task-field">
            <span>Category</span>
            <input maxLength={60} onChange={(event) => update("category", event.target.value)} placeholder="e.g. Personal, Work" value={form.category} />
          </label>
          {initialTask && (
            <label className="task-field">
              <span>Status</span>
              <select onChange={(event) => update("status", event.target.value as TaskStatus)} value={form.status}>
                <option value="todo">To do</option>
                <option value="inProgress">In progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          )}
        </div>

        <label className="task-field task-field--wide">
          <span>Description <small>(optional)</small></span>
          <textarea maxLength={4000} onChange={(event) => update("description", event.target.value)} rows={3} value={form.description} />
        </label>

        {formError && <p className="task-form-error" role="alert">{formError}</p>}
        <div className="task-form-actions">
          <Button disabled={saving} onClick={onCancel} variant="ghost">Cancel</Button>
          <Button disabled={saving} type="submit" variant="primary">{saving ? "Saving…" : initialTask ? "Save changes" : "Add task"}</Button>
        </div>
      </form>
    </Card>
  );
}

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<LifeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LifeTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [undoTask, setUndoTask] = useState<LifeTask | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError(null);

    void ensureUserProfile(user)
      .then(() => {
        if (cancelled) return;
        unsubscribe = subscribeToTasks(user.uid, setTasks, (loadError) => {
          setError(errorMessage(loadError));
          setLoading(false);
        });
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(errorMessage(loadError));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  const today = dateKey(new Date());
  const counts = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
    return {
      all: tasks.length,
      today: open.filter((task) => task.dueAt && dateInputValue(task.dueAt) === today).length,
      upcoming: open.filter((task) => task.dueAt && dateInputValue(task.dueAt) > today).length,
      overdue: open.filter((task) => task.dueAt && dateInputValue(task.dueAt) < today).length,
      completed: tasks.filter((task) => task.status === "done" || task.status === "cancelled").length,
    };
  }, [tasks, today]);

  useEffect(() => {
    if (!undoTask) return;
    const timer = window.setTimeout(() => setUndoTask(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undoTask]);

  const visibleTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return tasks
      .filter((task) => {
        const dueKey = task.dueAt ? dateInputValue(task.dueAt) : "";
        const isClosed = task.status === "done" || task.status === "cancelled";
        const matchesFilter = filter === "all" ||
          (filter === "today" && !isClosed && dueKey === today) ||
          (filter === "upcoming" && !isClosed && dueKey > today) ||
          (filter === "overdue" && !isClosed && dueKey !== "" && dueKey < today) ||
          (filter === "completed" && isClosed);
        const searchable = [task.title, task.description ?? "", task.category ?? ""].join(" ").toLocaleLowerCase();
        return matchesFilter && (!normalizedSearch || searchable.includes(normalizedSearch));
      })
      .sort((left, right) => {
        const leftDue = left.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
        const rightDue = right.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
        return leftDue - rightDue || left.title.localeCompare(right.title);
      });
  }, [filter, search, tasks, today]);

  async function saveTask(input: TaskInput) {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      if (editingTask) await updateTask(user.uid, editingTask, input);
      else await createTask(user.uid, input);
      setEditorOpen(false);
      setEditingTask(null);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function completeTask(task: LifeTask, completed: boolean) {
    if (!user) return;
    setError(null);
    try {
      await setTaskCompleted(user.uid, task, completed);
      setUndoTask(completed ? task : null);
      
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  }

  async function deleteTask(taskId: string) {
    if (!user) return;
    setError(null);
    try {
      await removeTask(user.uid, taskId);
      setPendingDelete(null);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  function openCreateForm() {
    setEditingTask(null);
    setEditorOpen(true);
  }

  function openEditForm(task: LifeTask) {
    setEditingTask(task);
    setEditorOpen(true);
  }

  return (
    <div className="tasks-page">
      <header className="tasks-page-heading">
        <div>
          <p className="text-eyebrow">A CLEARER WAY FORWARD</p>
          <h1 className="heading-display">Tasks</h1>
          <p className="text-body">Keep the next small step easy to see.</p>
        </div>
        <Button onClick={openCreateForm} variant="primary">＋ New task</Button>
      </header>

      {error && <p className="tasks-error" role="alert">{error}</p>}

      {editorOpen && (
        <TaskEditor
          key={editingTask?.id ?? "new-task"}
          initialTask={editingTask}
          onCancel={() => { setEditorOpen(false); setEditingTask(null); }}
          onSave={saveTask}
          saving={saving}
        />
      )}

      <Card className="tasks-toolbar" padding="compact">
        <label className="task-search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search tasks" onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks or categories" value={search} />
        </label>
        <div aria-label="Filter tasks" className="task-filters" role="group">
          {filters.map((item) => (
            <button
              aria-pressed={filter === item.id}
              className={filter === item.id ? "task-filter is-selected" : "task-filter"}
              key={item.id}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.label}<span>{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </Card>

      {undoTask && (
        <div className="task-undo" role="status">
          <span>Task completed</span>
          <Button onClick={() => void completeTask(undoTask, false)} variant="ghost">Undo</Button>
        </div>
      )}

      <section aria-label="Your tasks" className="task-list-section">
        <div className="task-list-heading">
          <h2>{filters.find((item) => item.id === filter)?.label}</h2>
          <span>{visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}</span>
        </div>

        {loading ? (
          <Card className="task-empty"><p>Loading your tasks…</p></Card>
        ) : visibleTasks.length === 0 ? (
          <Card className="task-empty">
            <span aria-hidden="true" className="task-empty-mark">✦</span>
            <h3>{search ? "No tasks match that search" : filter === "all" ? "A little room to breathe" : "Nothing here right now"}</h3>
            <p>{search ? "Try another word or clear your search." : filter === "all" ? "Add a task whenever something needs a place." : "Your tasks will appear here when they match this view."}</p>
            {!search && filter === "all" && <Button onClick={openCreateForm} variant="secondary">Add your first task</Button>}
          </Card>
        ) : (
          <div className="task-list">
            {visibleTasks.map((task) => {
              const closed = task.status === "done" || task.status === "cancelled";
              const overdue = !closed && task.dueAt && dateInputValue(task.dueAt) < today;
              return (
                <Card className={closed ? "task-row is-complete" : "task-row"} key={task.id} padding="compact">
                  <button
                    aria-label={closed ? "Reopen " + task.title : "Complete " + task.title}
                    aria-pressed={closed}
                    className="task-complete-toggle"
                    onClick={() => void completeTask(task, !closed)}
                    type="button"
                  >
                    {closed ? "✓" : ""}
                  </button>
                  <div className="task-row-main">
                    <div className="task-title-line">
                      <h3>{task.title}</h3>
                      {task.priority === "high" && <span className="task-priority task-priority--high">High priority</span>}
                    </div>
                    {task.description && <p className="task-description">{task.description}</p>}
                    <div className="task-metadata">
                      {task.dueAt && <span className={overdue ? "task-due is-overdue" : "task-due"}>{overdue ? "Overdue · " : "Due "}{dueDateLabel(task)}</span>}
                      {task.category && <span className="task-category">{task.category}</span>}
                      {task.status !== "todo" && <span className="task-status">{statusLabel(task.status)}</span>}
                      {task.priority === "low" && <span className="task-status">Low priority</span>}
                    </div>
                  </div>
                  <div className="task-row-actions">
                    {pendingDelete === task.id ? (
                      <>
                        <span className="task-delete-prompt">Delete?</span>
                        <Button onClick={() => void deleteTask(task.id)} variant="ghost">Confirm</Button>
                        <Button onClick={() => setPendingDelete(null)} variant="ghost">Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button aria-label={"Edit " + task.title} onClick={() => openEditForm(task)} variant="ghost">Edit</Button>
                        <Button aria-label={"Delete " + task.title} onClick={() => setPendingDelete(task.id)} variant="ghost">Delete</Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}