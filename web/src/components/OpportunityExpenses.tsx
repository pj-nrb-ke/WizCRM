import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

type ExpenseRow = {
  id: string;
  description: string;
  category: string;
  amount: number | string;
  date: string;
  loggedBy: { id: string; name: string };
};

const CATEGORY_LABELS: Record<string, string> = {
  TRAVEL: 'Travel',
  SAMPLES: 'Samples',
  LABOR: 'Labor',
  OTHER: 'Other',
};

type Props = {
  opportunityId: string;
  /** Only the opportunity owner can log expenses — hide the form for everyone else. */
  canLog: boolean;
  onChanged?: () => void;
};

export function OpportunityExpenses({ opportunityId, canLog, onChanged }: Props) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api<{ expenses: ExpenseRow[] }>(`/opportunities/${opportunityId}/expenses`);
      setExpenses(res.expenses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load expenses');
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = description.trim();
    const value = Number(amount);
    if (!trimmed || !value || value <= 0) return;
    setSaving(true);
    setError('');
    try {
      await api(`/opportunities/${opportunityId}/expenses`, {
        method: 'POST',
        body: {
          description: trimmed,
          category,
          amount: value,
          date: new Date(date).toISOString(),
        },
      });
      setDescription('');
      setAmount('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add expense');
    } finally {
      setSaving(false);
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <section className="opportunity-expenses">
      <h4>Expenses</h4>
      {error ? <p className="error">{error}</p> : null}
      {expenses.length === 0 ? (
        <p className="muted">No expenses logged on this opportunity yet.</p>
      ) : (
        <>
          <ul className="mini-list">
            {expenses.map((ex) => (
              <li key={ex.id}>
                {ex.description}
                <span className="muted">
                  {' '}
                  · {CATEGORY_LABELS[ex.category] ?? ex.category} · {Number(ex.amount).toLocaleString()} ·{' '}
                  {new Date(ex.date).toLocaleDateString()} · {ex.loggedBy.name}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted">Total spent: {total.toLocaleString()}</p>
        </>
      )}
      {canLog ? (
        <form onSubmit={(e) => void addExpense(e)} className="expense-form-row">
          <input
            type="text"
            placeholder="e.g. Fuel to site visit"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ flex: 1 }}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 110 }}
          />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            type="submit"
            className="btn-secondary btn-sm"
            disabled={saving || !description.trim() || !amount}
          >
            {saving ? 'Adding…' : 'Log expense'}
          </button>
        </form>
      ) : (
        <p className="muted">Only the opportunity owner can log expenses.</p>
      )}
    </section>
  );
}
