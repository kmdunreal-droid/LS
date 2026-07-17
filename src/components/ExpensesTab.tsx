import React, { useState } from "react";
import { Expense } from "../types";
import { EXPENSE_CATEGORIES } from "../constants";
import { Plus, Trash2, Calendar, Coins, Tag, RefreshCw, TrendingDown } from "lucide-react";

interface ExpensesTabProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, "id">) => Promise<string>;
  onUpdateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

export default function ExpensesTab({ expenses, onAddExpense, onUpdateExpense, onDeleteExpense }: ExpensesTabProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState(EXPENSE_CATEGORIES[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);

    if (isNaN(amtNum) || amtNum <= 0) {
      alert("Please enter a valid expense amount.");
      return;
    }

    setSaving(true);
    try {
      await onAddExpense({
        date,
        category,
        amount: amtNum,
        notes: notes.trim() || category,
      });

      setAmount("");
      setNotes("");
    } catch (e) {
      console.error(e);
      alert("An error occurred while saving the expense.");
    } finally {
      setSaving(false);
    }
  };

  const startEditingExpense = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setEditAmount(exp.amount.toString());
    setEditDate(exp.date);
    setEditNotes(exp.notes || "");
    setEditCategory(exp.category);
  };

  const cancelEditingExpense = () => {
    setEditingExpenseId(null);
  };

  const handleUpdateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpenseId) return;

    const amtNum = parseFloat(editAmount);
    if (isNaN(amtNum)) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      await onUpdateExpense(editingExpenseId, {
        amount: amtNum,
        date: editDate,
        notes: editNotes,
        category: editCategory,
      });
      setEditingExpenseId(null);
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating.");
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayExpenses = expenses.filter(e => e.date === todayStr).reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const uniqueDatesCount = new Set(expenses.map(e => e.date)).size || 1;
  const avgDailyExpense = Math.round(totalExpenses / uniqueDatesCount);

  return (
    <div id="expenses-tab" className="space-y-4 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-ink-faint/40 pb-3">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-accent/5 text-accent rounded">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <span className="block font-mono text-[7px] font-bold opacity-30 uppercase tracking-widest leading-tight">Financials</span>
            <h2 className="font-display text-base uppercase tracking-tight">Expenses</h2>
          </div>
        </div>
      </div>

      {/* Header with 3 Stats - Responsive */}
      <div className="grid grid-cols-3 gap-2 md:gap-6">
        {/* Total Outflow - Red / Rose */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-ink/70">Total Outflow</span>
            <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-ink/50" />
          </div>
          <div className="flex items-baseline gap-0.5 sm:gap-2">
            <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/50 uppercase">Rs.</span>
            <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-ink tracking-tight truncate">
              {totalExpenses.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Today's Cost - Orange / Flame */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-ink/70">Today's Cost</span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-ink-faint animate-ping" />
          </div>
          <div className="flex items-baseline gap-0.5 sm:gap-2">
            <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/50 uppercase">Rs.</span>
            <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-ink/70 tracking-tight truncate">
              {todayExpenses.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Daily Average - Magic Purple */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-ink/70">Daily Average</span>
            <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-ink/50" />
          </div>
          <div className="flex items-baseline gap-0.5 sm:gap-2">
            <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/50 uppercase">Rs.</span>
            <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-ink tracking-tight truncate">
              {avgDailyExpense.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left pane: Add Expense Form */}
        <div className="lg:col-span-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[8px] font-black uppercase tracking-[0.2em] opacity-20 shrink-0">Add Expense</span>
              <div className="h-px bg-ink-faint flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 bg-surface border border-ink-faint p-4 rounded">
              <div className="space-y-4">
                {/* Date */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Transaction Date</span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Expense Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none cursor-pointer"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Amount Disbursed (Rs.)</span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-3 font-mono text-4xl font-bold text-accent focus:ring-1 focus:ring-accent outline-none appearance-none"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Description / Purpose</span>
                  <input
                    type="text"
                    placeholder="ENTER_DETAILS"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-[10px] opacity-40 focus:opacity-100 outline-none appearance-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-accent text-bg py-4 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30"
              >
                {saving ? "Processing..." : "Log Expense Entry"}
              </button>
            </form>
          </div>
        </div>

        {/* Right pane: Expense History */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-4 border-b border-ink-faint pb-3">
            <span className="font-mono text-[8px] font-black uppercase tracking-[0.2em] opacity-20 shrink-0">History</span>
            <div className="h-px bg-ink-faint flex-1" />
          </div>

          {expenses.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-orange-500/20 rounded">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No expenditure history found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {expenses.map((e) => (
                <div key={e.id}>
                  {editingExpenseId === e.id ? (
                    <form onSubmit={handleUpdateExpenseSubmit} className="bg-orange-500/10 border border-orange-400/40 p-3 rounded-lg space-y-3 animate-fade-in">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="font-mono text-[7px] opacity-40 uppercase">Date</span>
                          <input 
                            type="date" 
                            value={editDate} 
                            onChange={ev => setEditDate(ev.target.value)}
                            className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none appearance-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="font-mono text-[7px] opacity-40 uppercase">Category</span>
                          <select 
                            value={editCategory} 
                            onChange={ev => setEditCategory(ev.target.value as any)}
                            className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none appearance-none"
                          >
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="font-mono text-[7px] opacity-40 uppercase">Description</span>
                        <input 
                          type="text" 
                          value={editNotes} 
                          onChange={ev => setEditNotes(ev.target.value)}
                          className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none appearance-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="font-mono text-[7px] opacity-40 uppercase">Amount</span>
                        <input 
                          type="number" 
                          value={editAmount} 
                          onChange={ev => setEditAmount(ev.target.value)}
                          className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] text-right focus:ring-1 focus:ring-accent outline-none appearance-none"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <button type="button" onClick={cancelEditingExpense} className="font-mono text-[8px] opacity-40 hover:opacity-100">Cancel</button>
                        <button type="submit" className="font-mono text-[8px] font-bold text-orange-300 border-b border-orange-300">Save</button>
                      </div>
                    </form>
                  ) : (
                    <div className="bg-orange-500/5 border border-orange-500/20 p-2.5 rounded-lg flex items-center justify-between group">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[9px] font-bold text-orange-300 uppercase">{e.category}</span>
                        <p className="font-mono text-[8px] text-orange-300/60 uppercase italic">{e.notes}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono text-[7px] font-bold text-orange-300/60 uppercase">Rs.</span>
                          <span className="font-display text-base font-black text-orange-100">{e.amount.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingExpense(e)}
                          className="opacity-60 hover:opacity-100 transition-colors p-0.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-orange-300" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this expense entry?")) {
                              onDeleteExpense(e.id);
                            }
                          }}
                          className="text-red-400 opacity-60 hover:opacity-100 transition-colors p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
