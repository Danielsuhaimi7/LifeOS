import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { Button, Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";
import { ensureUserProfile, timestampFromDateInput } from "../tasks/taskRepository";
import { saveAccount, setAccountArchived, subscribeToAccounts, type AccountInput, type AccountType, type LifeAccount } from "./accountRepository";
import { accountBalanceSen, createTransaction, subscribeToCategories, subscribeToTransactions, type LifeCategory, type LifeTransaction, type TransactionInput, type TransactionKind } from "./transactionRepository";

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
  return "Your finance data could not be loaded or saved. Please try again.";
}

function amountInput(sen: number) { return (sen / 100).toFixed(2); }

function dateToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function TransactionEditor({ accounts, categories, saving, onSave, onCancel }: {
  accounts: LifeAccount[]; categories: LifeCategory[]; saving: boolean;
  onSave: (input: TransactionInput) => Promise<void>; onCancel: () => void;
}) {
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? "");
  const [categoryName, setCategoryName] = useState("");
  const [occurredDate, setOccurredDate] = useState(dateToday());
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState("");
  const availableCategories = categories.filter((category) => kind !== "transfer" && category.kind === kind && !category.archived);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(amount.trim())) return setFormError("Enter a valid amount with up to two decimal places.");
    const amountSen = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(amountSen) || amountSen <= 0 || amountSen > 9999999999) return setFormError("Enter an amount greater than zero within the supported range.");
    if (!accounts.some((account) => account.id === accountId && !account.archived)) return setFormError("Choose an active account.");
    if (kind === "transfer" && (!accounts.some((account) => account.id === toAccountId && !account.archived) || toAccountId === accountId)) return setFormError("Choose a different destination account.");
    if (categoryName.trim().length > 60 || memo.trim().length > 1000) return setFormError("Category names are limited to 60 characters and notes to 1,000.");
    const occurredAt = timestampFromDateInput(occurredDate);
    if (!occurredAt) return setFormError("Choose the transaction date.");
    setFormError("");
    await onSave({ kind, amountSen, occurredAt, accountId, toAccountId: kind === "transfer" ? toAccountId : null, categoryName: kind === "transfer" ? null : categoryName.trim() || null, memo: memo.trim() || null });
  }

  return <Card className="transaction-editor"><form onSubmit={(event) => void submit(event)}>
    <div className="account-editor-heading"><div><p className="text-eyebrow">ACCOUNT ACTIVITY</p><h2>Record a transaction</h2></div><Button onClick={onCancel} variant="ghost">Close</Button></div>
    <div className="transaction-kind-toggle" role="group" aria-label="Transaction type"><button aria-pressed={kind === "expense"} className={kind === "expense" ? "is-selected is-expense" : ""} onClick={() => setKind("expense")} type="button">Expense</button><button aria-pressed={kind === "income"} className={kind === "income" ? "is-selected is-income" : ""} onClick={() => setKind("income")} type="button">Income</button><button aria-pressed={kind === "transfer"} className={kind === "transfer" ? "is-selected" : ""} onClick={() => setKind("transfer")} type="button">Transfer</button></div>
    <div className="transaction-form-grid">
      <label className="task-field"><span>Amount <small>(MYR)</small></span><div className="account-amount-input"><span>RM</span><input autoFocus inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required value={amount} /></div></label>
      <label className="task-field"><span>Account</span><select onChange={(event) => setAccountId(event.target.value)} required value={accountId}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {accountTypeLabels[account.type]}</option>)}</select></label>
      {kind === "transfer" && <label className="task-field"><span>To account</span><select onChange={(event) => setToAccountId(event.target.value)} required value={toAccountId}>{accounts.filter((account) => account.id !== accountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {accountTypeLabels[account.type]}</option>)}</select></label>}
      <label className="task-field"><span>Date</span><input onChange={(event) => setOccurredDate(event.target.value)} required type="date" value={occurredDate} /></label>
      {kind !== "transfer" && <label className="task-field"><span>Category <small>(optional)</small></span><input list="transaction-category-options" maxLength={60} onChange={(event) => setCategoryName(event.target.value)} placeholder={kind === "income" ? "e.g. Salary" : "e.g. Groceries"} value={categoryName} /><datalist id="transaction-category-options">{availableCategories.map((category) => <option key={category.id} value={category.name} />)}</datalist></label>}
    </div>
    <label className="task-field"><span>Note <small>(optional)</small></span><input maxLength={1000} onChange={(event) => setMemo(event.target.value)} value={memo} /></label>
    <p className="account-privacy-note">{kind === "transfer" ? "Transfers move money between accounts without changing your overall balance." : "A new category is saved to your account when you use it."} Transactions can’t be edited or deleted yet; correction tools are planned for LOS-015.</p>
    {formError && <p className="task-form-error" role="alert">{formError}</p>}
    <div className="task-form-actions"><Button onClick={onCancel} variant="ghost">Cancel</Button><Button disabled={saving || accounts.length === 0} type="submit" variant="primary">{saving ? "Saving…" : "Save transaction"}</Button></div>
  </form></Card>;
}

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
  const [transactions, setTransactions] = useState<LifeTransaction[]>([]);
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [transactionEditorOpen, setTransactionEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LifeAccount | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    const stops: Array<() => void> = [];
    setLoading(true);
    void ensureUserProfile(user).then(() => {
      if (cancelled) return;
      stops.push(subscribeToAccounts(user.uid, setAccounts, (value) => { setError(errorMessage(value)); setLoading(false); }));
      stops.push(subscribeToTransactions(user.uid, setTransactions, (value) => { setError(errorMessage(value)); setLoading(false); }));
      stops.push(subscribeToCategories(user.uid, setCategories, (value) => setError(errorMessage(value))));
      setLoading(false);
    }).catch((value: unknown) => { if (!cancelled) { setError(errorMessage(value)); setLoading(false); } });
    return () => { cancelled = true; stops.forEach((stop) => stop()); };
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

  async function saveTransaction(input: TransactionInput) {
    if (!user) return;
    setSaving(true); setError("");
    try { await createTransaction(user.uid, input); setTransactionEditorOpen(false); }
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
  const recentTransactions = useMemo(() => [...transactions].sort((a, b) => b.occurredAt.toMillis() - a.occurredAt.toMillis()).slice(0, 12), [transactions]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  function renderAccount(account: LifeAccount) {
    return <Card className="account-card" key={account.id} padding="compact">
      <span className="account-type-mark" aria-hidden="true">{account.type === "cash" ? "$" : account.type === "bank" ? "⌂" : account.type === "investment" ? "↗" : account.type === "creditCard" ? "▤" : "◇"}</span>
      <div className="account-card-main"><span className="account-type-label">{accountTypeLabels[account.type]}{account.archived && <span className="account-archived-tag">Archived</span>}</span><h3>{account.name}</h3><span className="account-balance-label">{account.type === "creditCard" ? "Current amount owed" : "Current balance"}</span><strong className="account-balance">{currency(accountBalanceSen(account.id, account.type, account.openingBalanceSen, transactions))}</strong></div>
      {pendingArchiveId === account.id ? <div className="account-card-actions"><span>{account.archived ? "Restore this account?" : "Archive this account?"}</span><Button disabled={saving} onClick={() => void archive(account, !account.archived)} variant="ghost">Confirm</Button><Button onClick={() => setPendingArchiveId(null)} variant="ghost">Cancel</Button></div> : <div className="account-card-actions"><Button aria-label={`Edit ${account.name}`} onClick={() => openEdit(account)} variant="ghost">Edit</Button><Button onClick={() => setPendingArchiveId(account.id)} variant="ghost">{account.archived ? "Restore" : "Archive"}</Button></div>}
    </Card>;
  }

  return <div className="finance-page">
    <header className="finance-heading"><div><p className="text-eyebrow">A CLEAR VIEW OF YOUR MONEY</p><h1 className="heading-display">Finance</h1><p className="text-body">Track your accounts, income, and spending.</p></div><div className="finance-header-actions"><Button disabled={activeAccounts.length === 0} onClick={() => setTransactionEditorOpen(true)} variant="secondary">＋ Transaction</Button><Button onClick={openCreate} variant="primary">＋ Add account</Button></div></header>
    {error && <p className="tasks-error" role="alert">{error}</p>}
    {editorOpen && <AccountEditor key={editing?.id ?? "new-account"} account={editing} saving={saving} onSave={save} onCancel={() => { setEditorOpen(false); setEditing(null); }} />}
    {transactionEditorOpen && <TransactionEditor accounts={activeAccounts} categories={categories} saving={saving} onSave={saveTransaction} onCancel={() => setTransactionEditorOpen(false)} />}
    <section className="finance-overview-strip" aria-label="Account summary"><Card><span>Active accounts</span><strong>{loading ? "—" : activeAccounts.length}</strong></Card><Card><span>Transactions recorded</span><strong>{loading ? "—" : transactions.length}</strong></Card><p>Balances include opening amounts, income, expenses, and transfers. Credit card charges increase the amount owed; payments reduce it.</p></section>
    <section className="finance-account-section"><div className="finance-section-heading"><div><p className="text-eyebrow">YOUR MONEY, ORGANIZED</p><h2>Active accounts</h2></div><span>{activeAccounts.length} {activeAccounts.length === 1 ? "account" : "accounts"}</span></div>
      {loading ? <Card className="finance-empty"><p>Loading your accounts…</p></Card> : activeAccounts.length === 0 ? <Card className="finance-empty"><span aria-hidden="true">◇</span><h3>No accounts yet</h3><p>Add a cash, bank, investment, credit card, or other asset account to get started.</p><Button onClick={openCreate} variant="secondary">Add your first account</Button></Card> : <div className="finance-account-list">{activeAccounts.map(renderAccount)}</div>}
    </section>
    <section className="finance-account-section"><div className="finance-section-heading"><div><p className="text-eyebrow">INCOME AND SPENDING</p><h2>Recent activity</h2></div><Button disabled={activeAccounts.length === 0} onClick={() => setTransactionEditorOpen(true)} variant="ghost">＋ Record transaction</Button></div>
      {loading ? <Card className="finance-empty"><p>Loading activity…</p></Card> : recentTransactions.length === 0 ? <Card className="finance-empty finance-empty--compact"><p>Your income and expenses will appear here.</p>{activeAccounts.length > 0 && <Button onClick={() => setTransactionEditorOpen(true)} variant="secondary">Record your first transaction</Button>}</Card> : <div className="finance-transaction-list">{recentTransactions.map((transaction) => {
        const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : null;
        const account = accounts.find((item) => item.id === transaction.accountId);
        const date = new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "2-digit", year: "numeric" }).format(transaction.occurredAt.toDate());
        const destination = transaction.toAccountId ? accounts.find((item) => item.id === transaction.toAccountId) : null;
        const title = transaction.kind === "transfer" ? "Transfer" : category?.name ?? (transaction.kind === "income" ? "Income" : "Expense");
        return <Card className="finance-transaction-row" key={transaction.id} padding="compact"><span className={`transaction-kind-mark is-${transaction.kind}`} aria-hidden="true">{transaction.kind === "income" ? "↙" : transaction.kind === "expense" ? "↗" : "⇄"}</span><div className="finance-transaction-main"><strong>{title}</strong><span>{account?.name ?? "Archived account"}{transaction.kind === "transfer" ? ` → ${destination?.name ?? "Archived account"}` : ""} · {date}</span>{transaction.memo && <small>{transaction.memo}</small>}</div><strong className={`finance-transaction-amount is-${transaction.kind}`}>{transaction.kind === "income" ? "+" : transaction.kind === "transfer" ? "↔ " : "−"}{currency(transaction.amountSen)}</strong></Card>;
      })}</div>}
    </section>
    {archivedAccounts.length > 0 && <section className="finance-account-section finance-archived-section"><button aria-expanded={showArchived} className="finance-archived-toggle" onClick={() => setShowArchived((value) => !value)} type="button">{showArchived ? "Hide" : "Show"} archived accounts <span>{archivedAccounts.length}</span></button>{showArchived && <div className="finance-account-list">{archivedAccounts.map(renderAccount)}</div>}</section>}
  </div>;
}
