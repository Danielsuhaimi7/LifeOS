import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { Button, Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";
import { ensureUserProfile } from "../tasks/taskRepository";
import { saveAccount, setAccountArchived, subscribeToAccounts, type AccountInput, type AccountType, type LifeAccount } from "./accountRepository";

const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash", bank: "Bank", investment: "Investment", creditCard: "Credit card", other: "Other asset",
};

function currency(valueInSen: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(valueInSen / 100);
}

function errorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") return "Firestore denied this request. Check that the reviewed LOS-005 rules are deployed.";
  if (error instanceof FirebaseError && error.code === "unavailable") return "LifeOS could not reach Firestore. Check your connection and try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Your accounts could not be loaded or saved. Please try again.";
}

function amountInput(sen: number) { return (sen / 100).toFixed(2); }

function AccountEditor({ account, saving, onSave, onCancel }: {
  account: LifeAccount | null; saving: boolean; onSave: (input: AccountInput, id?: string) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "bank");
  const [balance, setBalance] = useState(account ? amountInput(account.openingBalanceSen) : "0.00");
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return setFormError("Add an account name before saving.");
    if (trimmedName.length > 80) return setFormError("Account names can be up to 80 characters.");
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(balance.trim())) return setFormError("Enter a valid amount with up to two decimal places.");
    const openingBalanceSen = Math.round(Number(balance) * 100);
    if (!Number.isSafeInteger(openingBalanceSen) || Math.abs(openingBalanceSen) > 9999999999) return setFormError("The amount is outside the supported range.");
    setFormError("");
    await onSave({ name: trimmedName, type, openingBalanceSen }, account?.id);
  }

  return <Card className="account-editor"><form onSubmit={(event) => void submit(event)}>
    <div className="account-editor-heading"><div><p className="text-eyebrow">ACCOUNT DETAILS</p><h2>{account ? "Edit account" : "Add an account"}</h2></div><Button onClick={onCancel} variant="ghost">Close</Button></div>
    <div className="account-form-grid">
      <label className="task-field"><span>Account name</span><input autoFocus maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. Everyday savings" required value={name} /></label>
      <label className="task-field"><span>Type</span><select onChange={(event) => setType(event.target.value as AccountType)} value={type}>{Object.entries(accountTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="task-field"><span>Opening balance <small>(MYR)</small></span><div className="account-amount-input"><span>RM</span><input inputMode="decimal" onChange={(event) => setBalance(event.target.value)} required value={balance} /></div></label>
    </div>
    <p className="account-privacy-note">Only the account name, type, and opening balance are stored. Don’t enter account or card numbers.</p>
    {formError && <p className="task-form-error" role="alert">{formError}</p>}
    <div className="task-form-actions"><Button onClick={onCancel} variant="ghost">Cancel</Button><Button disabled={saving} type="submit" variant="primary">{saving ? "Saving…" : account ? "Save changes" : "Add account"}</Button></div>
  </form></Card>;
}

export function FinancePage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<LifeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LifeAccount | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    let stop: (() => void) | undefined;
    setLoading(true);
    void ensureUserProfile(user).then(() => {
      if (cancelled) return;
      stop = subscribeToAccounts(user.uid, setAccounts, (value) => { setError(errorMessage(value)); setLoading(false); });
      setLoading(false);
    }).catch((value: unknown) => { if (!cancelled) { setError(errorMessage(value)); setLoading(false); } });
    return () => { cancelled = true; stop?.(); };
  }, [user]);

  const activeAccounts = useMemo(() => accounts.filter((account) => !account.archived).sort((a, b) => a.name.localeCompare(b.name)), [accounts]);
  const archivedAccounts = useMemo(() => accounts.filter((account) => account.archived).sort((a, b) => a.name.localeCompare(b.name)), [accounts]);

  async function save(input: AccountInput, id?: string) {
    if (!user) return;
    setSaving(true); setError("");
    try { await saveAccount(user.uid, input, id); setEditorOpen(false); setEditing(null); }
    catch (value) { setError(errorMessage(value)); }
    finally { setSaving(false); }
  }

  async function archive(account: LifeAccount, archived: boolean) {
    if (!user) return;
    setSaving(true); setError("");
    try { await setAccountArchived(user.uid, account.id, archived); setPendingArchiveId(null); }
    catch (value) { setError(errorMessage(value)); }
    finally { setSaving(false); }
  }

  function openCreate() { setEditing(null); setEditorOpen(true); }
  function openEdit(account: LifeAccount) { setEditing(account); setEditorOpen(true); }

  function renderAccount(account: LifeAccount) {
    return <Card className="account-card" key={account.id} padding="compact">
      <span className="account-type-mark" aria-hidden="true">{account.type === "cash" ? "$" : account.type === "bank" ? "⌂" : account.type === "investment" ? "↗" : account.type === "creditCard" ? "▤" : "◇"}</span>
      <div className="account-card-main"><span className="account-type-label">{accountTypeLabels[account.type]}{account.archived && <span className="account-archived-tag">Archived</span>}</span><h3>{account.name}</h3><span className="account-balance-label">Opening balance</span><strong className="account-balance">{currency(account.openingBalanceSen)}</strong></div>
      {pendingArchiveId === account.id ? <div className="account-card-actions"><span>{account.archived ? "Restore this account?" : "Archive this account?"}</span><Button disabled={saving} onClick={() => void archive(account, !account.archived)} variant="ghost">Confirm</Button><Button onClick={() => setPendingArchiveId(null)} variant="ghost">Cancel</Button></div> : <div className="account-card-actions"><Button aria-label={`Edit ${account.name}`} onClick={() => openEdit(account)} variant="ghost">Edit</Button><Button onClick={() => setPendingArchiveId(account.id)} variant="ghost">{account.archived ? "Restore" : "Archive"}</Button></div>}
    </Card>;
  }

  return <div className="finance-page">
    <header className="finance-heading"><div><p className="text-eyebrow">A CLEAR VIEW OF YOUR MONEY</p><h1 className="heading-display">Finance</h1><p className="text-body">Start with the accounts you want to keep track of.</p></div><Button onClick={openCreate} variant="primary">＋ Add account</Button></header>
    {error && <p className="tasks-error" role="alert">{error}</p>}
    {editorOpen && <AccountEditor key={editing?.id ?? "new-account"} account={editing} saving={saving} onSave={save} onCancel={() => { setEditorOpen(false); setEditing(null); }} />}
    <section className="finance-overview-strip" aria-label="Account summary"><Card><span>Active accounts</span><strong>{loading ? "—" : activeAccounts.length}</strong></Card><Card><span>Archived accounts</span><strong>{loading ? "—" : archivedAccounts.length}</strong></Card><p>Balances show opening amounts. Income, expenses, and transfers will update your accounts in the next finance features.</p></section>
    <section className="finance-account-section"><div className="finance-section-heading"><div><p className="text-eyebrow">YOUR MONEY, ORGANIZED</p><h2>Active accounts</h2></div><span>{activeAccounts.length} {activeAccounts.length === 1 ? "account" : "accounts"}</span></div>
      {loading ? <Card className="finance-empty"><p>Loading your accounts…</p></Card> : activeAccounts.length === 0 ? <Card className="finance-empty"><span aria-hidden="true">◇</span><h3>No accounts yet</h3><p>Add a cash, bank, investment, credit card, or other asset account to get started.</p><Button onClick={openCreate} variant="secondary">Add your first account</Button></Card> : <div className="finance-account-list">{activeAccounts.map(renderAccount)}</div>}
    </section>
    {archivedAccounts.length > 0 && <section className="finance-account-section finance-archived-section"><button aria-expanded={showArchived} className="finance-archived-toggle" onClick={() => setShowArchived((value) => !value)} type="button">{showArchived ? "Hide" : "Show"} archived accounts <span>{archivedAccounts.length}</span></button>{showArchived && <div className="finance-account-list">{archivedAccounts.map(renderAccount)}</div>}</section>}
  </div>;
}
