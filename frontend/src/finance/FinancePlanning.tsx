import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";
import { dateInputValue } from "../tasks/taskRepository";
import { createCategory, renameCategory, setCategoryArchived } from "./categoryRepository";
import { deleteBudget, saveBudget, subscribeToBudgets, type LifeBudget } from "./budgetRepository";
import type { LifeCategory, LifeTransaction, CategoryKind } from "./transactionRepository";

function currency(amountSen: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(amountSen / 100);
}

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}`;
}

function nextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

function amountToSen(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 9999999999 ? amount : null;
}

export function FinancePlanning({ categories, transactions, onError }: {
  categories: LifeCategory[];
  transactions: LifeTransaction[];
  onError: (error: unknown) => void;
}) {
  const { user } = useAuth();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [budgets, setBudgets] = useState<LifeBudget[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryKind, setCategoryKind] = useState<CategoryKind>("expense");
  const [categoryFormError, setCategoryFormError] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [pendingArchiveCategoryId, setPendingArchiveCategoryId] = useState<string | null>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [editingBudget, setEditingBudget] = useState<LifeBudget | null>(null);
  const [pendingDeleteBudgetId, setPendingDeleteBudgetId] = useState<string | null>(null);
  const [budgetFormError, setBudgetFormError] = useState("");

  useEffect(() => {
    if (!user) { setBudgets([]); setBudgetLoading(false); return; }
    setBudgetLoading(true);
    setBudgets([]);
    setEditingBudget(null);
    setBudgetAmount("");
    return subscribeToBudgets(user.uid, monthKey, (items) => { setBudgets(items); setBudgetLoading(false); }, (error) => { onError(error); setBudgetLoading(false); });
  }, [monthKey, onError, user]);

  const expenseCategories = useMemo(() => categories.filter((category) => category.kind === "expense" && !category.archived).sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)), [categories]);
  const selectedBudgetExists = budgets.some((budget) => budget.categoryId === budgetCategoryId);
  useEffect(() => {
    if (!expenseCategories.some((category) => category.id === budgetCategoryId)) setBudgetCategoryId(expenseCategories[0]?.id ?? "");
  }, [budgetCategoryId, expenseCategories]);
  const expenseByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    const start = `${monthKey}-01`;
    const end = `${nextMonthKey(monthKey)}-01`;
    transactions.forEach((transaction) => {
      if (transaction.kind !== "expense" || !transaction.categoryId) return;
      const day = dateInputValue(transaction.occurredAt);
      if (day >= start && day < end) totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountSen);
    });
    return totals;
  }, [monthKey, transactions]);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return setCategoryFormError("Enter a category name.");
    if (name.length > 60) return setCategoryFormError("Category names can be up to 60 characters.");
    if (categories.some((item) => item.kind === categoryKind && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) return setCategoryFormError("A category with that name already exists for this type.");
    if (!user) return;
    setSaving(true); setCategoryFormError("");
    try { await createCategory(user.uid, name, categoryKind); setCategoryName(""); }
    catch (error) { onError(error); }
    finally { setSaving(false); }
  }

  async function saveCategoryName(category: LifeCategory) {
    const name = editingCategoryName.trim();
    if (!name) return setCategoryFormError("Enter a category name.");
    if (name.length > 60) return setCategoryFormError("Category names can be up to 60 characters.");
    if (categories.some((item) => item.id !== category.id && item.kind === category.kind && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) return setCategoryFormError("A category with that name already exists for this type.");
    if (!user) return;
    setSaving(true); setCategoryFormError("");
    try { await renameCategory(user.uid, category.id, name); setEditingCategoryId(null); setEditingCategoryName(""); }
    catch (error) { onError(error); }
    finally { setSaving(false); }
  }

  async function archiveCategory(category: LifeCategory, archived: boolean) {
    if (!user) return;
    setSaving(true); setCategoryFormError("");
    try { await setCategoryArchived(user.uid, category.id, archived); setPendingArchiveCategoryId(null); }
    catch (error) { onError(error); }
    finally { setSaving(false); }
  }

  async function submitBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountSen = amountToSen(budgetAmount);
    if (!expenseCategories.some((category) => category.id === budgetCategoryId)) return setBudgetFormError("Choose an active expense category.");
    if (amountSen === null) return setBudgetFormError("Enter a budget greater than zero with up to two decimal places.");
    if (!user) return;
    setSaving(true); setBudgetFormError("");
    try {
      await saveBudget(user.uid, monthKey, budgetCategoryId, amountSen);
      setEditingBudget(null); setBudgetAmount("");
    } catch (error) { onError(error); }
    finally { setSaving(false); }
  }

  async function removeBudget(budget: LifeBudget) {
    if (!user) return;
    setSaving(true);
    try {
      await deleteBudget(user.uid, budget.monthKey, budget.categoryId);
      setPendingDeleteBudgetId(null);
      if (editingBudget?.id === budget.id) { setEditingBudget(null); setBudgetAmount(""); }
    }
    catch (error) { onError(error); }
    finally { setSaving(false); }
  }

  function editBudget(budget: LifeBudget) {
    setEditingBudget(budget);
    setBudgetCategoryId(budget.categoryId);
    setBudgetAmount((budget.amountSen / 100).toFixed(2));
    setBudgetFormError("");
  }

  return <section className="finance-planning" aria-label="Categories and budgets">
    <div className="finance-section-heading"><div><p className="text-eyebrow">PLAN YOUR SPENDING</p><h2>Categories &amp; budgets</h2></div></div>
    <div className="finance-planning-grid">
      <Card className="finance-planning-card">
        <div className="finance-planning-card-heading"><div><h3>Categories</h3><p>Organize income and expenses. Archived categories stay on past activity.</p></div></div>
        <form className="finance-category-form" onSubmit={(event) => void addCategory(event)}>
          <label className="task-field"><span>Name</span><input maxLength={60} onChange={(event) => setCategoryName(event.target.value)} value={categoryName} /></label>
          <label className="task-field"><span>Type</span><select onChange={(event) => setCategoryKind(event.target.value as CategoryKind)} value={categoryKind}><option value="expense">Expense</option><option value="income">Income</option></select></label>
          <Button disabled={saving} type="submit" variant="secondary">Add category</Button>
        </form>
        {categoryFormError && <p className="task-form-error" role="alert">{categoryFormError}</p>}
        {sortedCategories.length === 0 ? <p className="finance-planning-empty">No categories yet. Add one above or create one while recording a transaction.</p> : <div className="finance-category-list">{sortedCategories.map((category) => <div className="finance-category-row" key={category.id}>
          <div className="finance-category-info"><span>{category.kind === "income" ? "Income" : "Expense"}{category.archived ? " · Archived" : ""}</span>
            {editingCategoryId === category.id ? <input aria-label={`Rename ${category.name}`} autoFocus maxLength={60} onChange={(event) => setEditingCategoryName(event.target.value)} value={editingCategoryName} /> : <strong>{category.name}</strong>}
          </div>
          {pendingArchiveCategoryId === category.id ? <div className="finance-category-actions"><span>Archive this category?</span><Button disabled={saving} onClick={() => void archiveCategory(category, true)} variant="ghost">Confirm</Button><Button onClick={() => setPendingArchiveCategoryId(null)} variant="ghost">Cancel</Button></div> : editingCategoryId === category.id ? <div className="finance-category-actions"><Button disabled={saving} onClick={() => void saveCategoryName(category)} variant="ghost">Save</Button><Button onClick={() => { setEditingCategoryId(null); setEditingCategoryName(""); setCategoryFormError(""); }} variant="ghost">Cancel</Button></div> : <div className="finance-category-actions"><Button onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); setCategoryFormError(""); }} variant="ghost">Rename</Button>{category.archived ? <Button disabled={saving} onClick={() => void archiveCategory(category, false)} variant="ghost">Restore</Button> : <Button onClick={() => setPendingArchiveCategoryId(category.id)} variant="ghost">Archive</Button>}</div>}
        </div>)}</div>}
      </Card>

      <Card className="finance-planning-card">
        <div className="finance-planning-card-heading"><div><h3>Monthly expense budgets</h3><p>Compare categorized spending with your monthly limits.</p></div><label className="finance-budget-month"><span>Month</span><input aria-label="Budget month" onChange={(event) => { setMonthKey(event.target.value); setEditingBudget(null); setBudgetAmount(""); setPendingDeleteBudgetId(null); setBudgetFormError(""); }} type="month" value={monthKey} /></label></div>
        <form className="finance-budget-form" onSubmit={(event) => void submitBudget(event)}>
          <label className="task-field"><span>Expense category</span><select disabled={!!editingBudget} onChange={(event) => setBudgetCategoryId(event.target.value)} required value={budgetCategoryId}>{expenseCategories.length === 0 && <option value="">No active expense categories</option>}{expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="task-field"><span>Monthly limit <small>(MYR)</small></span><div className="account-amount-input"><span>RM</span><input inputMode="decimal" onChange={(event) => setBudgetAmount(event.target.value)} placeholder="0.00" value={budgetAmount} /></div></label>
          <div className="finance-budget-form-actions"><Button disabled={saving || budgetLoading || expenseCategories.length === 0} type="submit" variant="secondary">{editingBudget ? "Save budget" : selectedBudgetExists ? "Update budget" : "Set budget"}</Button>{editingBudget && <Button onClick={() => { setEditingBudget(null); setBudgetAmount(""); setBudgetFormError(""); }} variant="ghost">Cancel</Button>}</div>
        </form>
        {budgetFormError && <p className="task-form-error" role="alert">{budgetFormError}</p>}
        {budgetLoading ? <p className="finance-planning-empty">Loading budgets…</p> : budgets.length === 0 ? <p className="finance-planning-empty">No budgets for this month yet.</p> : <div className="finance-budget-list">{budgets.map((budget) => {
          const category = categories.find((item) => item.id === budget.categoryId);
          const spent = expenseByCategory.get(budget.categoryId) ?? 0;
          const archived = !category || category.archived;
          return <div className="finance-budget-row" key={budget.id}>
            <div className="finance-budget-row-heading"><div><strong>{category?.name ?? "Unavailable category"}{archived ? " · Archived" : ""}</strong><span>{currency(spent)} spent of {currency(budget.amountSen)}{spent > budget.amountSen ? ` · ${currency(spent - budget.amountSen)} over` : ` · ${currency(budget.amountSen - spent)} left`}</span></div><div className="finance-category-actions">{!archived && <Button onClick={() => editBudget(budget)} variant="ghost">Edit</Button>}{pendingDeleteBudgetId === budget.id ? <><Button disabled={saving} onClick={() => void removeBudget(budget)} variant="ghost">Confirm delete</Button><Button onClick={() => setPendingDeleteBudgetId(null)} variant="ghost">Cancel</Button></> : <Button onClick={() => setPendingDeleteBudgetId(budget.id)} variant="ghost">Delete</Button>}</div></div>
            <progress aria-label={`${category?.name ?? "Category"}: ${currency(spent)} of ${currency(budget.amountSen)} spent`} max={budget.amountSen} value={Math.min(spent, budget.amountSen)} />
          </div>;
        })}</div>}
      </Card>
    </div>
  </section>;
}
