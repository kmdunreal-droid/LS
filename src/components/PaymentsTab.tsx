import React, { useState } from "react";
import { SupplierPayment, SupplyLog, Supplier } from "../types";
import { Trash2, DollarSign, RefreshCw, Users } from "lucide-react";

interface PaymentsTabProps {
  payments: SupplierPayment[];
  supplyLogs: SupplyLog[];
  suppliers: Supplier[];
  onAddPayment: (payment: Omit<SupplierPayment, "id">) => Promise<string>;
  onUpdatePayment: (id: string, payment: Partial<SupplierPayment>) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
}

export default function PaymentsTab({ payments, supplyLogs, suppliers, onAddPayment, onUpdatePayment, onDeletePayment }: PaymentsTabProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState<"daily" | "payments">("daily");

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSupplierId, setEditSupplierId] = useState("");

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId || s.name === selectedSupplierId);

  // Filter supplies and payments by selected supplier
  const filteredSupplies = supplyLogs.filter(log => 
    log.supplierId === selectedSupplierId || 
    (selectedSupplier && (log.supplierId === selectedSupplier.id || log.supplierId === selectedSupplier.name))
  );
  const filteredPayments = payments.filter(p => 
    p.supplierId === selectedSupplierId ||
    (selectedSupplier && (p.supplierId === selectedSupplier.id || p.supplierId === selectedSupplier.name))
  );

  // Group filtered data by Date
  const allDatesSet = new Set<string>();
  filteredSupplies.forEach((log) => allDatesSet.add(log.date));
  filteredPayments.forEach((p) => allDatesSet.add(p.date));

  const sortedDates = Array.from(allDatesSet).sort((a, b) => b.localeCompare(a));

  const dailyLedger = sortedDates.map((dStr) => {
    const daySupplies = filteredSupplies.filter((log) => log.date === dStr);
    const dayPayments = filteredPayments.filter((p) => p.date === dStr);

    const totalSuppliesCost = daySupplies.reduce((sum, log) => sum + log.totalCost, 0);
    const totalPaid = dayPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const netDiff = totalSuppliesCost - totalPaid;

    return {
      date: dStr,
      supplies: daySupplies,
      payments: dayPayments,
      totalSuppliesCost,
      totalPaid,
      netDiff,
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payNum = parseFloat(amountPaid);

    if (isNaN(payNum) || payNum <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    if (!selectedSupplierId) {
      alert("Please select a supplier first.");
      return;
    }

    setSaving(true);
    try {
      await onAddPayment({
        date,
        amountPaid: payNum,
        supplierId: selectedSupplierId,
        notes: notes.trim() || `Payment to ${selectedSupplier?.name || "Supplier"}`,
      });

      setAmountPaid("");
      setNotes("");
    } catch (e) {
      console.error(e);
      alert("An error occurred while saving the payment.");
    } finally {
      setSaving(false);
    }
  };

  const startEditingPayment = (p: SupplierPayment) => {
    setEditingPaymentId(p.id);
    setEditAmount(p.amountPaid.toString());
    setEditDate(p.date);
    setEditNotes(p.notes || "");
    setEditSupplierId(p.supplierId);
  };

  const cancelEditingPayment = () => {
    setEditingPaymentId(null);
  };

  const handleUpdatePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentId) return;

    const amtNum = parseFloat(editAmount);
    if (isNaN(amtNum)) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      await onUpdatePayment(editingPaymentId, {
        amountPaid: amtNum,
        date: editDate,
        notes: editNotes,
        supplierId: editSupplierId,
      });
      setEditingPaymentId(null);
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating.");
    }
  };

  const totalValueReceived = filteredSupplies.reduce((sum, log) => sum + log.totalCost, 0);
  const totalAmountPaid = filteredPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const outstandingSupplierBalance = totalValueReceived - totalAmountPaid;

  return (
    <div id="payments-tab" className="space-y-4 animate-fade-in max-w-6xl mx-auto">
      {/* Supplier Selection & Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-ink-faint/40 pb-3">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-accent/5 text-accent rounded">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <span className="block font-mono text-[7px] font-bold opacity-30 uppercase tracking-widest leading-tight">Supplier</span>
            <h2 className="font-display text-base uppercase tracking-tight">Sources</h2>
          </div>
        </div>


      </div>

      {/* Supplier Ledger Stats - Responsive */}
      <div className="grid grid-cols-3 gap-2 md:gap-6">
        {/* Inventory Total */}
          <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-40 rounded-2xl group relative overflow-hidden transition-all duration-300 hover:border-ink/40">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-ink/70">Inventory Total</span>
            <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/50 uppercase block">Rs.</span>
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-ink tracking-tight truncate">
              {totalValueReceived.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Total Paid - Green */}
          <div className="bg-surface border border-emerald-500/20 p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-40 rounded-2xl group relative overflow-hidden transition-all duration-300">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400">Total Paid</span>
            <span className="font-mono text-[7px] sm:text-[10px] font-bold text-emerald-400/60 uppercase block">Rs.</span>
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-emerald-400 tracking-tight truncate">
              {totalAmountPaid.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Balance */}
          <div className={`bg-surface border p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-40 rounded-2xl group relative overflow-hidden transition-all duration-300 ${outstandingSupplierBalance > 0 ? "border-red-500/20" : "border-emerald-500/20"}`}>
            <span className={`font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] ${outstandingSupplierBalance > 0 ? "text-red-400" : "text-emerald-400"}`}>Balance</span>
            <span className={`font-mono text-[7px] sm:text-[10px] font-bold uppercase block ${outstandingSupplierBalance > 0 ? "text-red-400/60" : "text-emerald-400/60"}`}>Rs.</span>
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className={`font-display text-xs sm:text-2xl md:text-4xl font-black tracking-tight truncate ${outstandingSupplierBalance > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {outstandingSupplierBalance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left pane: Add Payment Form */}
        <div className="lg:col-span-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[8px] font-black uppercase tracking-[0.2em] opacity-20 shrink-0">Payments</span>
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

                {/* Amount */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Remittance Amount (Rs.)</span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-3 font-mono text-4xl font-bold text-accent focus:ring-1 focus:ring-accent outline-none appearance-none"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Transaction Memo</span>
                  <input
                    type="text"
                    placeholder="NOTES_OR_DETAILS"
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
                {saving ? "Processing..." : "Confirm Remittance"}
              </button>
            </form>
          </div>
        </div>

        {/* Right pane: Payments & Grouped Ledger */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between gap-8 border-b border-ink-faint pb-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] opacity-20 shrink-0">Account Ledger</span>
              <div className="h-px bg-ink-faint flex-1 min-w-[50px]" />
            </div>

            <div className="flex gap-8">
              <button
                type="button"
                onClick={() => setSubTab("daily")}
                className={`font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                  subTab === "daily" ? "text-accent" : "opacity-20 hover:opacity-40"
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setSubTab("payments")}
                className={`font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                  subTab === "payments" ? "text-accent" : "opacity-20 hover:opacity-40"
                }`}
              >
                Log History
              </button>
            </div>
          </div>
          
          {subTab === "daily" ? (
            dailyLedger.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-ink-faint rounded">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No activity recorded for this source</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dailyLedger.map((day) => (
                  <div key={day.date} className="space-y-2">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[10px] font-bold opacity-20 uppercase whitespace-nowrap">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <div className="h-px bg-ink-faint flex-1" />
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[8px] font-bold opacity-10 uppercase tracking-widest">Net Diff:</span>
                        <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${day.netDiff > 0 ? "text-accent" : day.netDiff < 0 ? "text-emerald-custom" : "opacity-20"}`}>
                          Rs. {Math.abs(day.netDiff).toLocaleString()} {day.netDiff > 0 ? "(DUES)" : day.netDiff < 0 ? "(EXCESS)" : "(SETTLED)"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 pl-4 border-l border-ink-faint ml-2">
                      {/* Supplies Arrival */}
                      <div className="space-y-4">
                        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] opacity-10">Inventory Inflow</span>
                        {day.supplies.length === 0 ? (
                          <p className="font-mono text-[9px] opacity-10 uppercase italic">No inflow recorded</p>
                        ) : (
                          <div className="space-y-3">
                            {day.supplies.map((s) => (
                              <div key={s.id} className="flex justify-between items-baseline gap-4">
                                <div className="space-y-0.5 max-w-[60%]">
                                  <span className="font-mono text-xs md:text-sm font-bold text-emerald-400 block uppercase leading-none truncate">{s.category || "WHOLE CHICKEN"}</span>
                                  <span className="font-mono text-[9px] opacity-30 block uppercase tracking-tighter">
                                    {s.weightKg}Kg @ {s.supplyRatePerKg}
                                  </span>
                                </div>
                                <span className="font-mono text-xs md:text-sm font-light text-ink whitespace-nowrap">Rs. {s.totalCost.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Payments */}
                      <div className="space-y-4">
                        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] opacity-10">Financial Outflow</span>
                        {day.payments.length === 0 ? (
                          <p className="font-mono text-[9px] opacity-10 uppercase italic">No outflow recorded</p>
                        ) : (
                          <div className="space-y-3">
                            {day.payments.map((p) => (
                              <div key={p.id} className="flex justify-between items-baseline gap-4">
                                <span className="font-mono text-xs md:text-sm opacity-30 uppercase italic truncate max-w-[60%]">{p.notes || "CASH_REMITTANCE"}</span>
                                <span className="font-mono text-xs md:text-sm font-bold text-emerald-custom whitespace-nowrap">Rs. {p.amountPaid.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredPayments.length === 0 ? (
            <div className="py-40 text-center border border-dashed border-orange-500/20 rounded">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No payment logs found for this source</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredPayments.map((p) => (
                <div key={p.id}>
                  {editingPaymentId === p.id ? (
                    <form onSubmit={handleUpdatePaymentSubmit} className="bg-orange-500/10 border border-orange-400/40 p-3 rounded-lg space-y-3 animate-fade-in">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="font-mono text-[7px] opacity-40 uppercase">Amount</span>
                          <input 
                            type="number" 
                            value={editAmount} 
                            onChange={e => setEditAmount(e.target.value)}
                            className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none appearance-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="font-mono text-[7px] opacity-40 uppercase">Date</span>
                          <input 
                            type="date" 
                            value={editDate} 
                            onChange={e => setEditDate(e.target.value)}
                            className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none appearance-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="font-mono text-[7px] opacity-40 uppercase">Notes</span>
                        <input 
                          type="text" 
                          value={editNotes} 
                          onChange={e => setEditNotes(e.target.value)}
                          className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none appearance-none"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          type="button" 
                          onClick={cancelEditingPayment}
                          className="font-mono text-[8px] opacity-40 hover:opacity-100"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          className="font-mono text-[8px] font-bold text-orange-300 border-b border-orange-300"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="bg-orange-500/5 border border-orange-500/20 p-2.5 rounded-lg flex items-center justify-between group">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[9px] font-bold text-orange-300/60 uppercase">
                          {new Date(p.date).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}
                        </span>
                        <p className="font-mono text-xs md:text-sm text-orange-100 uppercase italic">{p.notes || "Supplier Payment"}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono text-[7px] font-bold text-orange-300/60 uppercase">Rs.</span>
                           <span className="font-display text-base font-black text-orange-100">{p.amountPaid.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingPayment(p)}
                          className="opacity-60 hover:opacity-100 transition-colors p-0.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-orange-300" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this payment record?")) {
                              onDeletePayment(p.id);
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
