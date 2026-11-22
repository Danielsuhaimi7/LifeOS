import { useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import { NavLink, useSearchParams } from "react-router";
import { Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";
import { ensureUserProfile, subscribeToTasks, type LifeTask } from "../tasks/taskRepository";
import { subscribeToAppointments, type Appointment } from "../calendar/calendarRepository";
import { subscribeToNotes, type LifeNote } from "../notes/notesRepository";
import { subscribeToAccounts, type LifeAccount } from "../finance/accountRepository";
import { subscribeToCategories, subscribeToTransactions, type LifeCategory, type LifeTransaction } from "../finance/transactionRepository";

type SearchKind = "all" | "tasks" | "appointments" | "notes" | "accounts" | "transactions";
type SearchResult = { id: string; kind: Exclude<SearchKind, "all">; title: string; snippet: string; updatedAt: number; href: string; label: string };
const filters: { id: SearchKind; label: string }[] = [
  { id: "all", label: "All" }, { id: "tasks", label: "Tasks" },
  { id: "appointments", label: "Appointments" }, { id: "notes", label: "Notes" }, { id: "accounts", label: "Accounts" }, { id: "transactions", label: "Transactions" },
];

function errorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") return "Firestore denied this request. Check that the reviewed feature rules are deployed.";
  if (error instanceof FirebaseError && error.code === "unavailable") return "LifeOS could not reach Firestore. Check your connection and try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Search data could not be loaded. Please try again.";
}

function snippet(value: string, query: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  const index = compact.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (compact.length <= 170) return compact;
  const start = Math.max(0, index - 55);
  const end = Math.min(compact.length, start + 150);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

function matching(values: Array<string | null | undefined>, query: string) {
  const value = values.filter(Boolean).join(" ");
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? value : null;
}

function taskResult(task: LifeTask, query: string): SearchResult | null {
  const match = matching([task.title, task.description, task.category], query);
  if (!match) return null;
  return { id: task.id, kind: "tasks", title: task.title, snippet: snippet(match, query), updatedAt: task.updatedAt?.toMillis?.() ?? 0, href: "/tasks", label: task.status === "done" ? "Completed task" : "Task" };
}

function appointmentResult(item: Appointment, query: string): SearchResult | null {
  const match = matching([item.title, item.details, item.location], query);
  if (!match) return null;
  return { id: item.id, kind: "appointments", title: item.title, snippet: snippet(match, query), updatedAt: item.updatedAt?.toMillis?.() ?? 0, href: "/calendar", label: "Appointment" };
}

function noteResult(note: LifeNote, query: string): SearchResult | null {
  const match = matching([note.title, note.body], query);
  if (!match) return null;
  return { id: note.id, kind: "notes", title: note.title, snippet: snippet(match, query), updatedAt: note.updatedAt?.toMillis?.() ?? 0, href: "/notes", label: note.kind === "checklist" ? "Checklist" : "Note" };
}

function accountResult(account: LifeAccount, query: string): SearchResult | null {
  const match = matching([account.name, accountTypeLabel(account.type)], query);
  if (!match) return null;
  return { id: account.id, kind: "accounts", title: account.name, snippet: accountTypeLabel(account.type), updatedAt: account.updatedAt?.toMillis?.() ?? 0, href: "/finance", label: account.archived ? "Archived account" : "Account" };
}

function accountTypeLabel(type: LifeAccount["type"]) {
  return ({ cash: "Cash account", bank: "Bank account", investment: "Investment account", creditCard: "Credit card account", other: "Other asset account" })[type];
}

function transactionResult(item: LifeTransaction, query: string, categories: LifeCategory[], accounts: LifeAccount[]): SearchResult | null {
  const category = categories.find((value) => value.id === item.categoryId)?.name ?? "";
  const account = accounts.find((value) => value.id === item.accountId)?.name ?? "";
  const kind = item.kind === "income" ? "Income" : item.kind === "expense" ? "Expense" : "Transfer";
  const match = matching([kind, category, item.memo, account], query);
  if (!match) return null;
  const date = new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "2-digit", year: "numeric" }).format(item.occurredAt.toDate());
  const title = category || `${kind} transaction`;
  return { id: item.id, kind: "transactions", title, snippet: snippet([kind, account, item.memo ?? "", date].filter(Boolean).join(" · "), query), updatedAt: item.updatedAt?.toMillis?.() ?? 0, href: "/finance", label: `${kind} · ${amountLabel(item.amountSen)}` };
}

function amountLabel(amountSen: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(amountSen / 100);
}

export function SearchPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const requestedFilter = searchParams.get("type");
  const activeFilter: SearchKind = filters.some((item) => item.id === requestedFilter) ? requestedFilter as SearchKind : "all";
  const [tasks, setTasks] = useState<LifeTask[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<LifeNote[]>([]);
  const [accounts, setAccounts] = useState<LifeAccount[]>([]);
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [transactions, setTransactions] = useState<LifeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    const stops: Array<() => void> = [];
    const ready = new Set<string>();
    const markReady = (key: string) => { ready.add(key); if (ready.size === 6) setLoading(false); };
    setLoading(true);
    void ensureUserProfile(user).then(() => {
      if (cancelled) return;
      stops.push(subscribeToTasks(user.uid, (value) => { setTasks(value); markReady("tasks"); }, (value) => { setError(errorMessage(value)); markReady("tasks"); }));
      stops.push(subscribeToAppointments(user.uid, (value) => { setAppointments(value); markReady("appointments"); }, (value) => { setError(errorMessage(value)); markReady("appointments"); }));
      stops.push(subscribeToNotes(user.uid, (value) => { setNotes(value); markReady("notes"); }, (value) => { setError(errorMessage(value)); markReady("notes"); }));
      stops.push(subscribeToAccounts(user.uid, (value) => { setAccounts(value); markReady("accounts"); }, (value) => { setError(errorMessage(value)); markReady("accounts"); }));
      stops.push(subscribeToCategories(user.uid, (value) => { setCategories(value); markReady("categories"); }, (value) => { setError(errorMessage(value)); markReady("categories"); }));
      stops.push(subscribeToTransactions(user.uid, (value) => { setTransactions(value); markReady("transactions"); }, (value) => { setError(errorMessage(value)); markReady("transactions"); }));
    }).catch((value: unknown) => { if (!cancelled) { setError(errorMessage(value)); setLoading(false); } });
    return () => { cancelled = true; stops.forEach((stop) => stop()); };
  }, [user]);

  const allResults = useMemo(() => {
    const normalized = query.trim();
    if (!normalized) return [];
    return [
      ...tasks.map((item) => taskResult(item, normalized)).filter((item): item is SearchResult => item !== null),
      ...appointments.map((item) => appointmentResult(item, normalized)).filter((item): item is SearchResult => item !== null),
      ...notes.map((item) => noteResult(item, normalized)).filter((item): item is SearchResult => item !== null),
      ...accounts.map((item) => accountResult(item, normalized)).filter((item): item is SearchResult => item !== null),
      ...transactions.map((item) => transactionResult(item, normalized, categories, accounts)).filter((item): item is SearchResult => item !== null),
    ].sort((a, b) => {
      const aTitle = a.title.toLocaleLowerCase().includes(normalized.toLocaleLowerCase()) ? 1 : 0;
      const bTitle = b.title.toLocaleLowerCase().includes(normalized.toLocaleLowerCase()) ? 1 : 0;
      return bTitle - aTitle || b.updatedAt - a.updatedAt || a.title.localeCompare(b.title);
    });
  }, [accounts, appointments, categories, notes, query, tasks, transactions]);
  const counts = useMemo(() => ({
    all: allResults.length,
    tasks: allResults.filter((item) => item.kind === "tasks").length,
    appointments: allResults.filter((item) => item.kind === "appointments").length,
    notes: allResults.filter((item) => item.kind === "notes").length,
    accounts: allResults.filter((item) => item.kind === "accounts").length,
    transactions: allResults.filter((item) => item.kind === "transactions").length,
  }), [allResults]);
  const results = activeFilter === "all" ? allResults : allResults.filter((item) => item.kind === activeFilter);

  function changeQuery(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("q", value); else params.delete("q");
    setSearchParams(params, { replace: true });
  }
  function changeFilter(value: SearchKind) {
    const params = new URLSearchParams(searchParams);
    if (value === "all") params.delete("type"); else params.set("type", value);
    setSearchParams(params, { replace: true });
  }

  return <div className="search-page">
    <header className="search-heading"><div><p className="text-eyebrow">FIND WHAT YOU NEED</p><h1 className="heading-display">Search</h1><p className="text-body">Look across your tasks, appointments, notes, and finance records.</p></div></header>
    {error && <p className="tasks-error" role="alert">{error}</p>}
    <Card className="search-panel">
      <label className="search-input-wrap"><span aria-hidden="true">⌕</span><input autoFocus aria-label="Search LifeOS" onChange={(event) => changeQuery(event.target.value)} placeholder="Search your records…" value={query} /></label>
      <div className="search-filters" role="group" aria-label="Filter results">{filters.map((filter) => <button aria-pressed={activeFilter === filter.id} className={activeFilter === filter.id ? "search-filter is-selected" : "search-filter"} key={filter.id} onClick={() => changeFilter(filter.id)} type="button">{filter.label}{query.trim() && <span>{counts[filter.id]}</span>}</button>)}</div>
      {loading ? <div className="search-empty"><p>Searching your private records…</p></div> : !query.trim() ? <div className="search-empty"><span aria-hidden="true">⌕</span><h2>What are you looking for?</h2><p>Search your tasks, appointments, and notes by title or details.</p></div> : results.length === 0 ? <div className="search-empty"><span aria-hidden="true">⌕</span><h2>No results for “{query.trim()}”</h2><p>Try another word or search across a different section.</p></div> : <div className="search-results" aria-live="polite"><p className="search-result-count">{results.length} {results.length === 1 ? "result" : "results"}</p>{results.map((item) => <article className="search-result" key={`${item.kind}-${item.id}`}><div className={`search-result-mark search-result-mark--${item.kind}`} aria-hidden="true">{item.kind === "tasks" ? "✓" : item.kind === "appointments" ? "◷" : "✎"}</div><div className="search-result-main"><div className="search-result-title"><span>{item.label}</span><h2>{item.title || "Untitled"}</h2></div><p>{item.snippet}</p></div><NavLink aria-label={`Open ${item.label.toLocaleLowerCase()} section`} to={item.href}>Open <span aria-hidden="true">↗</span></NavLink></article>)}</div>}
    </Card>
    <p className="search-scope-note">Results are private to your account. Transfers will be searchable when transfer tracking is added.</p>
  </div>;
}
