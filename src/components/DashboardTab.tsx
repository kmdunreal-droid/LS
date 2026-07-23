import React, { useState, useEffect } from "react";
import { Order, SupplyLog, SupplierPayment, Expense, FormulaSettings, Supplier } from "../types";
import { 
  Flame,
  Activity,
  X,
  Trash2,
  RefreshCw,
  Weight,
  CreditCard,
  Package,
  CheckCircle
} from "lucide-react";
import { evaluate } from "mathjs";

function recalculateOrderItems(items: Order['items'], settings: FormulaSettings, newRate: number): { items: Order['items']; totalAmount: number } {
  const newItems = items.map(item => {
    const formula = settings.items?.[item.itemKey];
    if (formula?.expression) {
      try {
        const expr = formula.expression.toLowerCase().replace(/supply/g, newRate.toString());
        const newPrice = Math.round(Number(evaluate(expr)));
        return { ...item, price: newPrice, total: Math.round(newPrice * item.quantity) };
      } catch {}
    } else if (formula?.multiplier !== undefined && formula?.markup !== undefined) {
      const newPrice = Math.round((newRate * formula.multiplier) + formula.markup);
      return { ...item, price: newPrice, total: Math.round(newPrice * item.quantity) };
    }
    return item;
  });
  const totalAmount = newItems.reduce((sum, it) => sum + it.total, 0);
  return { items: newItems, totalAmount };
}

interface DashboardTabProps {
  settings: FormulaSettings;
  orders: Order[];
  supplyLogs: SupplyLog[];
  payments: SupplierPayment[];
  expenses: Expense[];
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSupplierSelect: (id: string) => void;
  onSaveSettings: (settings: FormulaSettings) => Promise<void>;
  onNavigateToSales?: () => void;
  onUpdateSupplyLog?: (id: string, log: Partial<SupplyLog>) => Promise<void>;
  onDeleteSupplyLog?: (id: string) => Promise<void>;
  onAddPayment?: (payment: Omit<SupplierPayment, "id">) => Promise<string>;
  onUpdatePayment?: (id: string, payment: Partial<SupplierPayment>) => Promise<void>;
  onDeletePayment?: (id: string) => Promise<void>;
  onUpdateOrder?: (id: string, order: Partial<Order>) => Promise<void>;
  dailyRates?: Record<string, number>;
  onSaveDailyRate?: (date: string, rate: number) => Promise<void>;
  getEffectiveRate?: (date: string) => number;
}

export default function DashboardTab({ 
  settings, 
  orders, 
  supplyLogs, 
  payments, 
  expenses,
  suppliers,
  selectedSupplierId,
  onSupplierSelect,
  onSaveSettings,
  onNavigateToSales,
  onUpdateSupplyLog,
  onDeleteSupplyLog,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onUpdateOrder,
  dailyRates,
  onSaveDailyRate,
  getEffectiveRate
}: DashboardTabProps) {
  const [quickRate, setQuickRate] = useState<string>(settings.baseRawRate.toString());
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SupplyLog | SupplierPayment | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateModalDate, setRateModalDate] = useState(selectedDate);
  const [updateExistingSupplies, setUpdateExistingSupplies] = useState(false);
  const [updateExistingOrders, setUpdateExistingOrders] = useState(false);

  useEffect(() => {
    setQuickRate(settings.baseRawRate.toString());
  }, [settings.baseRawRate]);

  // Extract custom formula categories
  const uniqueCategories = Object.values(settings.items || {})
    .filter(it => it.name && it.name.trim() !== "" && it.expression && it.expression.trim() !== "")
    .map(it => it.name);

  const getEstimatedRateForCategory = (cat: string, base?: number) => {
    const effectiveBase = base ?? (getEffectiveRate ? getEffectiveRate(selectedDate) : settings.baseRawRate);
    const formulaItem = Object.values(settings.items || {}).find(
      (it) => it.name.toLowerCase() === cat.toLowerCase()
    );

    if (formulaItem) {
      if (formulaItem.expression) {
        try {
          const cleanExpression = formulaItem.expression.toLowerCase().replace(/supply/g, effectiveBase.toString());
          const result = evaluate(cleanExpression);
          return Math.round(Number(result));
        } catch (err) {
          console.error("Evaluation error in DashboardTab:", err);
        }
      }
      if (formulaItem.multiplier !== undefined) {
        return Math.round(effectiveBase * formulaItem.multiplier + (formulaItem.markup || 0));
      }
    }
    return effectiveBase;
  };

  const currentTempRate = parseFloat(quickRate) || (getEffectiveRate ? getEffectiveRate(selectedDate) : settings.baseRawRate);

  const handleQuickRateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(quickRate);
    if (isNaN(rate) || rate <= 0) return;

    setIsUpdatingRate(true);
    try {
      await onSaveSettings({
        ...settings,
        baseRawRate: rate
      });
      if (onSaveDailyRate) {
        await onSaveDailyRate(rateModalDate, rate);
      }
      if (updateExistingSupplies && onUpdateSupplyLog) {
        const dateSupplies = supplyLogs.filter(s => s.date === rateModalDate);
        for (const log of dateSupplies) {
          await onUpdateSupplyLog(log.id, {
            supplyRatePerKg: rate,
            totalCost: log.weightKg * rate,
          });
        }
      }
      if (updateExistingOrders && onUpdateOrder) {
        const dateOrders = orders.filter(o => o.date === rateModalDate);
        for (const order of dateOrders) {
          const recalculated = recalculateOrderItems(order.items, settings, rate);
          await onUpdateOrder(order.id, {
            items: recalculated.items,
            totalAmount: recalculated.totalAmount,
          });
        }
      }
      setShowRateModal(false);
      setUpdateExistingSupplies(false);
      setUpdateExistingOrders(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierDetailTab, setSupplierDetailTab] = useState<"supplies" | "payments" | "ledger">("ledger");

  // Editing state for supplies
  const [editSupplyId, setEditSupplyId] = useState<string | null>(null);
  const [editSupplyWeight, setEditSupplyWeight] = useState("");
  const [editSupplyRate, setEditSupplyRate] = useState("");
  const [editSupplyCategory, setEditSupplyCategory] = useState("");
  const [editSupplyNotes, setEditSupplyNotes] = useState("");

  // Editing state for payments
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [editPayAmount, setEditPayAmount] = useState("");
  const [editPayDate, setEditPayDate] = useState("");
  const [editPayNotes, setEditPayNotes] = useState("");

  // Quick add payment modal
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [quickPayAmount, setQuickPayAmount] = useState("");

  const isSpecificSupplier = selectedSupplierId !== "" && selectedSupplierId !== "All" && selectedSupplierId !== "SELF_PURCHASE";
  const selectedSupplier = isSpecificSupplier ? suppliers.find(s => s.id === selectedSupplierId) : null;

  const currentSupplierName = selectedSupplierId === "" || selectedSupplierId === "All"
    ? "All Suppliers"
    : selectedSupplierId === "SELF_PURCHASE"
    ? "Self Purchase (Owner)"
    : suppliers.find(s => s.id === selectedSupplierId)?.name || "Unknown";

  // Filter everything by selected supplier if active
  const filteredSupplyLogs = selectedSupplierId === "" || selectedSupplierId === "All"
    ? supplyLogs
    : supplyLogs.filter(s => s.supplierId === selectedSupplierId);

  const filteredPayments = selectedSupplierId === "" || selectedSupplierId === "All"
    ? payments
    : payments.filter(p => p.supplierId === selectedSupplierId);

  // Core Global Ledger Calculations
  const totalSuppliesCost = filteredSupplyLogs.reduce((sum, log) => sum + log.totalCost, 0);
  const totalPaidToSupplier = filteredPayments.reduce((sum, pay) => sum + pay.amountPaid, 0);
  const outstandingSupplierDues = totalSuppliesCost - totalPaidToSupplier;

  // Selected Day Calculations
  const dayOrders = orders.filter((o) => o.date === selectedDate);
  const daySupplies = filteredSupplyLogs.filter((s) => s.date === selectedDate);
  const dayPayments = filteredPayments.filter((p) => p.date === selectedDate);
  const dayExpenses = expenses.filter((e) => e.date === selectedDate);

  const todaySales = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const todaySuppliesCost = daySupplies.reduce((sum, s) => sum + s.totalCost, 0);
  const todayExpensesCost = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const todayTotalCosts = todaySuppliesCost + todayExpensesCost;
  const todayNetProfit = todaySales - todayTotalCosts;

  // Combine recent logs for activity feed
  const recentLogs = [...filteredSupplyLogs, ...filteredPayments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Last 7 days metrics for micro-visual bars
  const getLast7DaysList = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };

  const last7Days = getLast7DaysList();
  const chartData = last7Days.map((date) => {
    const sales = orders.filter((o) => o.date === date).reduce((sum, o) => sum + o.totalAmount, 0);
    const cost = filteredSupplyLogs.filter((s) => s.date === date).reduce((sum, s) => sum + s.totalCost, 0) +
                 expenses.filter((e) => e.date === date).reduce((sum, e) => sum + e.amount, 0);
    return { date, sales, cost };
  });

  const maxVal = Math.max(...chartData.map((d) => Math.max(d.sales, d.cost, 1000)));

  // Weekly & Monthly summary (based on selectedDate)
  const selectedDateObj = new Date(selectedDate + "T00:00:00");
  const selectedMonth = selectedDateObj.getMonth();
  const selectedYear = selectedDateObj.getFullYear();

  // Last 7 days ending at selectedDate
  const getLast7FromDate = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(selectedDateObj);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };
  const last7FromSelected = getLast7FromDate();

  const weekSales = last7FromSelected.reduce((sum, d) => sum + orders.filter(o => o.date === d).reduce((s, o) => s + o.totalAmount, 0), 0);
  const weekSupplyCost = last7FromSelected.reduce((sum, d) => sum + filteredSupplyLogs.filter(s => s.date === d).reduce((s, l) => s + l.totalCost, 0), 0);
  const weekExpenses = last7FromSelected.reduce((sum, d) => sum + expenses.filter(e => e.date === d).reduce((s, e) => s + e.amount, 0), 0);
  const weekProfit = weekSales - weekSupplyCost - weekExpenses;

  const monthOrders = orders.filter(o => { const d = new Date(o.date + "T00:00:00"); return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear; });
  const monthSupplies = filteredSupplyLogs.filter(l => { const d = new Date(l.date + "T00:00:00"); return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear; });
  const monthExpensesList = expenses.filter(e => { const d = new Date(e.date + "T00:00:00"); return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear; });

  const monthSales = monthOrders.reduce((s, o) => s + o.totalAmount, 0);
  const monthSupplyCost = monthSupplies.reduce((s, l) => s + l.totalCost, 0);
  const monthExpensesTotal = monthExpensesList.reduce((s, e) => s + e.amount, 0);
  const monthProfit = monthSales - monthSupplyCost - monthExpensesTotal;

  // Edit supply handlers
  const startEditSupply = (log: SupplyLog) => {
    setEditSupplyId(log.id);
    setEditSupplyWeight(log.weightKg.toString());
    setEditSupplyRate(log.supplyRatePerKg.toString());
    setEditSupplyCategory(log.category || "");
    setEditSupplyNotes(log.notes || "");
  };

  const cancelEditSupply = () => setEditSupplyId(null);

  const handleUpdateSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplyId || !onUpdateSupplyLog) return;
    const w = parseFloat(editSupplyWeight);
    const r = parseFloat(editSupplyRate);
    if (isNaN(w) || isNaN(r)) return;
    try {
      await onUpdateSupplyLog(editSupplyId, {
        weightKg: w,
        supplyRatePerKg: r,
        totalCost: w * r,
        category: editSupplyCategory,
        notes: editSupplyNotes,
      });
      setEditSupplyId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit payment handlers
  const startEditPayment = (p: SupplierPayment) => {
    setEditPaymentId(p.id);
    setEditPayAmount(p.amountPaid.toString());
    setEditPayDate(p.date);
    setEditPayNotes(p.notes || "");
  };

  const cancelEditPayment = () => setEditPaymentId(null);

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPaymentId || !onUpdatePayment) return;
    const a = parseFloat(editPayAmount);
    if (isNaN(a) || a <= 0) return;
    try {
      await onUpdatePayment(editPaymentId, {
        amountPaid: a,
        date: editPayDate,
        notes: editPayNotes,
      });
      setEditPaymentId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickPay = async () => {
    const a = parseFloat(quickPayAmount);
    if (isNaN(a) || a <= 0 || !onAddPayment || !selectedSupplier) return;
    try {
      await onAddPayment({
        date: new Date().toISOString().split("T")[0],
        amountPaid: a,
        notes: `Payment to ${selectedSupplier.name}`,
        supplierId: selectedSupplier.id,
      });
      setQuickPayAmount("");
      setShowQuickPay(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Build running ledger for selected supplier
  const buildSupplierLedger = () => {
    const allDates = new Set<string>();
    filteredSupplyLogs.forEach(l => allDates.add(l.date));
    filteredPayments.forEach(p => allDates.add(p.date));
    return Array.from(allDates).sort((a, b) => b.localeCompare(a)).map(d => {
      const daySupplies = filteredSupplyLogs.filter(l => l.date === d);
      const dayPayments = filteredPayments.filter(p => p.date === d);
      const supplyTotal = daySupplies.reduce((s, l) => s + l.totalCost, 0);
      const payTotal = dayPayments.reduce((s, p) => s + p.amountPaid, 0);
      return { date: d, supplies: daySupplies, payments: dayPayments, supplyTotal, payTotal, net: supplyTotal - payTotal };
    });
  };

  return (
    <div id="dashboard-tab" className="space-y-4 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-faint/40 pb-3">
        <h2 className="font-display text-base uppercase tracking-tight shrink-0">Overview</h2>
        <div className="flex-1" />
        <button onClick={() => setShowSupplierModal(true)} className="px-3 py-1.5 bg-ink-faint/20 border border-ink-faint/40 rounded-full font-mono text-[9px] font-bold uppercase tracking-widest text-ink/70 hover:bg-ink-faint/40 transition-all cursor-pointer shrink-0">
          {currentSupplierName}
        </button>
        <button onClick={() => dateInputRef.current?.showPicker()} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 cursor-pointer hover:bg-accent/20 transition-colors shrink-0">
          <span className="font-mono text-[7px] font-bold uppercase tracking-widest text-accent/60">Date</span>
          <span className="font-mono text-[11px] font-black text-accent">{new Date(selectedDate).getDate().toString().padStart(2, "0")}</span>
        </button>
        <input ref={dateInputRef} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="hidden" />
        <button onClick={() => setShowReport(true)} className="px-3 py-1.5 bg-surface border border-ink-faint rounded-full font-mono text-[7px] font-bold uppercase tracking-widest text-ink/60 hover:bg-ink-faint/20 transition-all cursor-pointer shrink-0">
          Report
        </button>
      </div>

      {/* Daily Rate Button */}
      <button onClick={() => { setQuickRate((getEffectiveRate ? getEffectiveRate(selectedDate) : settings.baseRawRate).toString()); setRateModalDate(selectedDate); setShowRateModal(true); }} className="w-full bg-surface border border-ink-faint border-l-4 border-l-accent px-4 py-3 flex items-center justify-between rounded-lg hover:bg-ink-faint/10 transition-all cursor-pointer group">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-sm uppercase tracking-tight">Daily Rate</h3>
          <span className="font-mono text-[8px] text-ink/30 uppercase tracking-widest">{selectedDate}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] text-ink/40 font-bold">Rs.</span>
          <span className="font-display text-xl md:text-2xl font-black text-accent tracking-tight">{getEffectiveRate ? getEffectiveRate(selectedDate) : settings.baseRawRate}</span>
          <span className="font-mono text-[8px] text-ink/30">/KG</span>
        </div>
      </button>

      {/* Stats Strip - Responsive Columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6">
        {/* Sales Card */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl hover:border-ink/40 transition-all duration-300 group">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-ink/70 font-bold">Sales</span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-ink-faint" />
          </div>
          <div className="font-mono text-[15px] font-black leading-none text-ink/70 tracking-tight">{todaySales.toLocaleString()}</div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40 block font-bold truncate">Live Volume</span>
        </div>
        
        {/* Delivery Card */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-ink/70 font-bold">Delivery</span>
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <div className="font-mono text-[15px] font-black leading-none text-ink/70 tracking-tight">{todaySuppliesCost.toLocaleString()}</div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40 block font-bold truncate">Today Cost</span>
        </div>

        {/* Stock Card */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-ink/70 font-bold">Stock</span>
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <div className="font-mono text-[15px] font-black leading-none text-ink/70 tracking-tight">{daySupplies.reduce((s, log) => s + log.weightKg, 0).toFixed(1)}</div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40 block font-bold truncate">Today Weight</span>
        </div>
 
        {/* Profit Card */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-ink/70 font-bold">Profit</span>
            <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <div className="font-mono text-[15px] font-black leading-none text-ink/70 tracking-tight">{todayNetProfit.toLocaleString()}</div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40 block font-bold truncate">Net Operating</span>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: Supplier Detail or Summary */}
        <div className="lg:col-span-7 space-y-4">
          {isSpecificSupplier && selectedSupplier ? (
            <>
              {/* Supplier Header */}
              <div className="bg-surface border border-ink-faint p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <Package className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40 font-bold">Supplier</span>
                      <h3 className="font-display text-lg uppercase tracking-tight font-black">{selectedSupplier.name}</h3>
                    </div>
                  </div>
                  <button onClick={() => setShowQuickPay(true)} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-bg font-mono text-[8px] font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                    <CreditCard className="w-3.5 h-3.5" />
                    Quick Pay
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-ink-faint/40">
                  <div>
                    <span className="font-mono text-[7px] uppercase tracking-widest text-ink/40">Total Supplied</span>
                    <span className="block font-mono text-sm font-black text-ink">Rs. {totalSuppliesCost.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[7px] uppercase tracking-widest text-emerald-400/60">Total Paid</span>
                    <span className="block font-mono text-sm font-black text-emerald-400">Rs. {totalPaidToSupplier.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[7px] uppercase tracking-widest text-red-400/60">Pending</span>
                    <span className={`block font-mono text-sm font-black ${outstandingSupplierDues > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      Rs. {outstandingSupplierDues.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="flex gap-1 bg-surface/60 border border-ink-faint/40 p-1 rounded-xl">
                {(["ledger", "supplies", "payments"] as const).map(tab => (
                  <button key={tab} onClick={() => setSupplierDetailTab(tab)}
                    className={`flex-1 py-2 rounded-lg font-mono text-[8px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                      supplierDetailTab === tab ? "bg-accent text-bg shadow-lg" : "text-ink/40 hover:text-ink/70"
                    }`}
                  >
                    {tab === "ledger" ? "Ledger" : tab === "supplies" ? "Supplies" : "Payments"}
                  </button>
                ))}
              </div>

              {/* Supplies Tab */}
              {supplierDetailTab === "supplies" && (
                <div className="space-y-2">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-ink/30 font-bold">All Supply Records</span>
                  {filteredSupplyLogs.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-ink-faint rounded-lg">
                      <p className="font-mono text-[9px] uppercase tracking-widest opacity-20 italic">No supplies recorded</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
                      {filteredSupplyLogs.map(log => (
                        editSupplyId === log.id ? (
                          <form key={log.id} onSubmit={handleUpdateSupply} className="bg-sky-500/10 border border-sky-400/40 p-3 rounded-xl space-y-2">
                            <span className="font-mono text-[7px] font-bold uppercase tracking-widest text-sky-300">Edit Supply</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-mono text-[6px] opacity-40 uppercase">Weight (KG)</span>
                                <input type="number" step="0.01" value={editSupplyWeight} onChange={e => setEditSupplyWeight(e.target.value)}
                                  className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                              <div>
                                <span className="font-mono text-[6px] opacity-40 uppercase">Rate (Rs/KG)</span>
                                <input type="number" value={editSupplyRate} onChange={e => setEditSupplyRate(e.target.value)}
                                  className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                            </div>
                            <div>
                              <span className="font-mono text-[6px] opacity-40 uppercase">Notes</span>
                              <input type="text" value={editSupplyNotes} onChange={e => setEditSupplyNotes(e.target.value)}
                                className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none" />
                            </div>
                            <div className="flex justify-end gap-3 pt-1">
                              <button type="button" onClick={cancelEditSupply} className="font-mono text-[7px] uppercase opacity-40 hover:opacity-80">Cancel</button>
                              <button type="submit" className="font-mono text-[7px] font-bold uppercase text-sky-300 border-b border-sky-300">Save</button>
                            </div>
                          </form>
                        ) : (
                          <div key={log.id} className="bg-surface border border-ink-faint p-3 rounded-xl flex items-center justify-between group hover:border-ink/30 transition-all">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-sky-400">{log.category || "RAW_CHICKEN"}</span>
                                <span className="font-mono text-[7px] text-ink/30">{log.date}</span>
                                {log.notes?.startsWith("PENDING:") && (
                                  <span className="font-mono text-[6px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-full">Pending</span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono text-sm font-black text-ink">{log.weightKg}</span>
                                <span className="font-mono text-[7px] font-bold uppercase text-ink/40">KG</span>
                                <span className="font-mono text-[8px] text-ink/30 ml-2">@ Rs.{log.supplyRatePerKg}</span>
                              </div>
                              <span className="font-mono text-sm font-black text-sky-400">Rs. {log.totalCost.toLocaleString()}</span>
                              {log.notes && <span className="font-mono text-[7px] text-ink/30 block">{log.notes.replace(/^PENDING:/, "")}</span>}
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {log.notes?.startsWith("PENDING:") && onUpdateSupplyLog && (
                                <button type="button" onClick={async () => {
                                  try {
                                    await onUpdateSupplyLog(log.id, { notes: log.notes.replace("PENDING:", "RECEIVED:") });
                                  } catch (err) { console.error(err); }
                                }} className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-bg rounded-lg font-mono text-[7px] font-bold uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-sky-500/20">
                                  Receive
                                </button>
                              )}
                              {onUpdateSupplyLog && (
                                <button type="button" onClick={() => startEditSupply(log)} className="p-1 hover:bg-ink-faint/20 rounded transition-colors cursor-pointer">
                                  <RefreshCw className="w-3.5 h-3.5 text-ink/40" />
                                </button>
                              )}
                              {onDeleteSupplyLog && (
                                <button type="button" onClick={() => { if (confirm("Delete this supply record?")) onDeleteSupplyLog(log.id); }} className="p-1 hover:bg-red-500/20 rounded transition-colors cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payments Tab */}
              {supplierDetailTab === "payments" && (
                <div className="space-y-2">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-ink/30 font-bold">All Payment Records</span>
                  {filteredPayments.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-ink-faint rounded-lg">
                      <p className="font-mono text-[9px] uppercase tracking-widest opacity-20 italic">No payments recorded</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
                      {filteredPayments.map(p => (
                        editPaymentId === p.id ? (
                          <form key={p.id} onSubmit={handleUpdatePayment} className="bg-emerald-500/10 border border-emerald-400/40 p-3 rounded-xl space-y-2">
                            <span className="font-mono text-[7px] font-bold uppercase tracking-widest text-emerald-300">Edit Payment</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-mono text-[6px] opacity-40 uppercase">Amount</span>
                                <input type="number" value={editPayAmount} onChange={e => setEditPayAmount(e.target.value)}
                                  className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                              <div>
                                <span className="font-mono text-[6px] opacity-40 uppercase">Date</span>
                                <input type="date" value={editPayDate} onChange={e => setEditPayDate(e.target.value)}
                                  className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                            </div>
                            <div>
                              <span className="font-mono text-[6px] opacity-40 uppercase">Notes</span>
                              <input type="text" value={editPayNotes} onChange={e => setEditPayNotes(e.target.value)}
                                className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none" />
                            </div>
                            <div className="flex justify-end gap-3 pt-1">
                              <button type="button" onClick={cancelEditPayment} className="font-mono text-[7px] uppercase opacity-40 hover:opacity-80">Cancel</button>
                              <button type="submit" className="font-mono text-[7px] font-bold uppercase text-emerald-300 border-b border-emerald-300">Save</button>
                            </div>
                          </form>
                        ) : (
                          <div key={p.id} className="bg-surface border border-ink-faint p-3 rounded-xl flex items-center justify-between group hover:border-ink/30 transition-all">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-emerald-400">Payment</span>
                                <span className="font-mono text-[7px] text-ink/30">{p.date}</span>
                              </div>
                              <span className="font-mono text-sm font-black text-emerald-400">Rs. {p.amountPaid.toLocaleString()}</span>
                              {p.notes && <span className="font-mono text-[7px] text-ink/30 block">{p.notes}</span>}
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {onUpdatePayment && (
                                <button type="button" onClick={() => startEditPayment(p)} className="p-1 hover:bg-ink-faint/20 rounded transition-colors cursor-pointer">
                                  <RefreshCw className="w-3.5 h-3.5 text-ink/40" />
                                </button>
                              )}
                              {onDeletePayment && (
                                <button type="button" onClick={() => { if (confirm("Delete this payment record?")) onDeletePayment(p.id); }} className="p-1 hover:bg-red-500/20 rounded transition-colors cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ledger Tab */}
              {supplierDetailTab === "ledger" && (
                <div className="space-y-2">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-ink/30 font-bold">Running Ledger</span>
                  {(() => {
                    const ledger = buildSupplierLedger();
                    if (ledger.length === 0) return (
                      <div className="py-8 text-center border border-dashed border-ink-faint rounded-lg">
                        <p className="font-mono text-[9px] uppercase tracking-widest opacity-20 italic">No activity found</p>
                      </div>
                    );
                    return (
                      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                        {ledger.map(day => (
                          <div key={day.date} className="bg-surface border border-ink-faint p-3 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/40">
                                {new Date(day.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}
                              </span>
                              <span className={`font-mono text-[8px] font-bold uppercase tracking-widest ${day.net > 0 ? "text-red-400" : day.net < 0 ? "text-emerald-400" : "text-ink/20"}`}>
                                {day.net > 0 ? `Dues: Rs. ${day.net.toLocaleString()}` : day.net < 0 ? `Excess: Rs. ${Math.abs(day.net).toLocaleString()}` : "Settled"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {day.supplies.length > 0 && (
                                <div className="space-y-1">
                                  <span className="font-mono text-[6px] uppercase tracking-widest text-sky-400/60 font-bold">Supplies</span>
                                  {day.supplies.map(s => (
                                    <div key={s.id} className="flex justify-between items-center">
                                      <span className="font-mono text-[8px] text-ink/60 truncate max-w-[60%]">{s.category || "CHICKEN"} {s.weightKg}kg</span>
                                      <span className="font-mono text-[8px] font-bold text-ink">Rs.{s.totalCost.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {day.payments.length > 0 && (
                                <div className="space-y-1">
                                  <span className="font-mono text-[6px] uppercase tracking-widest text-emerald-400/60 font-bold">Payments</span>
                                  {day.payments.map(p => (
                                    <div key={p.id} className="flex justify-between items-center">
                                      <span className="font-mono text-[8px] text-ink/60 truncate max-w-[60%]">{p.notes || "Payment"}</span>
                                      <span className="font-mono text-[8px] font-bold text-emerald-400">Rs.{p.amountPaid.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Quick Pay Modal */}
              {showQuickPay && (
                <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowQuickPay(false)}>
                  <div className="bg-surface border border-ink-faint rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Quick Pay — {selectedSupplier.name}</span>
                      <button onClick={() => setShowQuickPay(false)} className="p-1 hover:bg-ink-faint rounded transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest block mb-1">Amount (Rs.)</span>
                      <input type="number" min="1" placeholder="0" value={quickPayAmount} onChange={e => setQuickPayAmount(e.target.value)}
                        className="w-full bg-bg border border-ink-faint rounded px-4 py-4 font-mono text-3xl font-bold text-ink focus:ring-1 focus:ring-accent outline-none" autoFocus />
                    </div>
                    <div className="text-right space-x-3">
                      <button onClick={() => setShowQuickPay(false)} className="px-4 py-2 font-mono text-[8px] uppercase tracking-widest opacity-40 hover:opacity-80">Cancel</button>
                      <button onClick={handleQuickPay} disabled={!quickPayAmount || parseFloat(quickPayAmount) <= 0}
                        className="px-6 py-2 bg-emerald-500 text-bg rounded-lg font-mono text-[8px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer">
                        Pay Rs. {parseFloat(quickPayAmount || "0").toLocaleString()}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40 font-bold">Summary</span>
              <div className="h-px bg-ink-faint/20 flex-1" />
            </div>
          )}
          </div>

        {/* Right Side: Dues & Chart */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40 font-bold">Ledger</span>
            <div className="h-px bg-ink-faint/20 flex-1" />
          </div>

          {/* Balance/Dues Card */}
          <div className={`bg-surface border p-4 space-y-1.5 rounded-2xl transition-all duration-300 ${outstandingSupplierDues > 0 ? "border-red-500/20" : "border-emerald-500/20"}`}>
            <span className={`font-mono text-[9px] uppercase tracking-widest font-bold ${outstandingSupplierDues > 0 ? "text-red-400" : "text-emerald-400"}`}>Dues Balance</span>
            <span className={`font-mono text-[7px] sm:text-[10px] font-bold uppercase block ${outstandingSupplierDues > 0 ? "text-red-400/60" : "text-emerald-400/60"}`}>Rs.</span>
            <div className={`font-mono text-3xl font-black tracking-tight truncate ${outstandingSupplierDues > 0 ? "text-red-400" : "text-emerald-400"}`}>{outstandingSupplierDues.toLocaleString()}</div>
            <span className={`font-mono text-[10px] uppercase tracking-widest block truncate font-bold ${outstandingSupplierDues > 0 ? "text-red-400/60" : "text-emerald-400/60"}`}>
              {outstandingSupplierDues > 0 ? "Pending" : "Settled"} &bull; {selectedSupplierId === "" || selectedSupplierId === "All" ? "All Vendors" : selectedSupplierId === "SELF_PURCHASE" ? "Self Purchase" : suppliers.find(s => s.id === selectedSupplierId)?.name}
            </span>
          </div>

          <div className="space-y-3">
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Sales vs Expense History</span>
            <div className="h-[120px] flex items-end gap-2.5 pt-4">
              {chartData.map((d, i) => {
                const total = d.sales + d.cost;
                const salesH = total > 0 ? (d.sales / maxVal) * 100 : 8;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                    {/* Hover Tooltip */}
                    <div className="absolute -top-12 bg-surface border border-ink-faint rounded px-2 py-1 text-[8px] font-mono text-ink opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 pointer-events-none shadow-xl">
                      <div className="text-ink/40 font-bold">Sales: Rs. {d.sales}</div>
                      <div className="text-ink/40">Cost: Rs. {d.cost}</div>
                    </div>
                    
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 relative overflow-hidden ${
                        i === 6 
                          ? "bg-accent/40" 
                          : "bg-ink-faint/30 opacity-60 group-hover:opacity-90"
                      }`} 
                      style={{ height: `${salesH}%` }}
                    >
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between border-t border-ink-faint pt-2">
              <span className="font-mono text-[9px] uppercase opacity-40">{last7Days[0].split('-').slice(1).reverse().join('/')}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-accent font-bold">Today</span>
            </div>
          </div>

          <div className="space-y-3">
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Recent Logs</span>
            <div className="flex flex-col gap-1.5">
              {recentLogs.slice(0, 8).map(log => {
                const isSupply = 'totalCost' in log;
                const sLog = isSupply ? (log as SupplyLog) : null;
                const pLog = !isSupply ? (log as SupplierPayment) : null;
                const sup = log.supplierId ? suppliers.find(s => s.id === log.supplierId) : null;
                const supName = sup?.name || (!log.supplierId ? "Self Purchase (Owner)" : log.notes?.split(' ')[0] || 'Unknown');
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`bg-orange-500/5 border border-orange-500/20 p-2.5 rounded-lg text-left hover:border-orange-400/40 transition-all cursor-pointer`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${isSupply ? "text-sky-400" : "text-emerald-400"}`}>
                        {isSupply ? "Supply" : "Payment"}
                      </span>
                      <span className="font-mono text-[7px] text-orange-300/60">
                        {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div className="font-mono text-sm font-bold text-orange-100">
                      Rs. {(isSupply ? sLog!.totalCost : pLog!.amountPaid).toLocaleString()}
                    </div>
                    <div className="font-mono text-[9px] md:text-[10px] text-orange-300/60 truncate mt-0.5">
                      {supName}
                    </div>
                    {isSupply && sLog && (
                      <div className="font-mono text-[8px] text-sky-300/40 mt-0.5">
                        {sLog.weightKg}kg × Rs.{sLog.supplyRatePerKg}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setSelectedLog(null)}>
          <div className="bg-surface border border-ink-faint rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className={`font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40`}>
                {'totalCost' in selectedLog ? 'Supply Detail' : 'Payment Detail'}
              </span>
              <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-ink-faint rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {'totalCost' in selectedLog ? (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-ink-faint pb-2">
                    <span className="font-mono text-[9px] opacity-40">Date</span>
                    <span className="font-mono text-[9px] font-bold">{selectedLog.date}</span>
                  </div>
                  <div className="flex justify-between border-b border-ink-faint pb-2">
                    <span className="font-mono text-[9px] opacity-40">Category</span>
                    <span className="font-mono text-[11px] md:text-xs font-bold text-sky-400">{selectedLog.category || 'Raw Chicken'}</span>
                  </div>
                  <div className="flex justify-between border-b border-ink-faint pb-2">
                    <span className="font-mono text-[9px] opacity-40">Weight</span>
                    <span className="font-mono text-[9px] font-bold">{selectedLog.weightKg} kg</span>
                  </div>
                  <div className="flex justify-between border-b border-ink-faint pb-2">
                    <span className="font-mono text-[9px] opacity-40">Rate / Kg</span>
                    <span className="font-mono text-[9px] font-bold">Rs. {selectedLog.supplyRatePerKg}</span>
                  </div>
                  <div className="flex justify-between border-b border-ink-faint pb-2">
                    <span className="font-mono text-[9px] opacity-40">Total Cost</span>
                    <span className="font-mono text-[9px] font-bold text-sky-400">Rs. {selectedLog.totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-[9px] opacity-40">Notes</span>
                    <span className="font-mono text-[9px] font-bold text-right max-w-[60%] break-words">{selectedLog.notes || '—'}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-ink-faint pb-2">
                    <span className="font-mono text-[9px] opacity-40">Date</span>
                    <span className="font-mono text-[9px] font-bold">{selectedLog.date}</span>
                  </div>
                  <div className="flex justify-between border-b border-ink-faint pb-2">
                    <span className="font-mono text-[9px] opacity-40">Amount Paid</span>
                    <span className="font-mono text-[9px] font-bold text-emerald-400">Rs. {selectedLog.amountPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-[9px] opacity-40">Notes</span>
                    <span className="font-mono text-[9px] font-bold text-right max-w-[60%] break-words">{selectedLog.notes || '—'}</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setSelectedLog(null)} className="flex-1 py-2.5 bg-accent text-bg font-mono text-[9px] font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowReport(false)}>
          <div className="bg-surface border border-ink-faint rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Day / Week / Month Report</span>
              <button onClick={() => setShowReport(false)} className="p-1 hover:bg-ink-faint rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Today */}
            <div className="bg-bg/60 border border-ink-faint p-3 rounded-xl space-y-1.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/40">Today <span className="text-ink/20 normal-case font-normal">{selectedDate}</span></span>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Sales</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink">Rs.{todaySales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Delivery</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink/70">Rs.{todaySuppliesCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Expenses</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink/70">Rs.{todayExpensesCost.toLocaleString()}</span>
              </div>
              <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Profit</span>
                 <span className={`font-mono text-sm md:text-base font-black ${todayNetProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>Rs.{todayNetProfit.toLocaleString()}</span>
              </div>
            </div>

            {/* This Week */}
            <div className="bg-bg/60 border border-ink-faint p-3 rounded-xl space-y-1.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/40">This Week <span className="text-ink/20 normal-case font-normal">{last7FromSelected[0]} – {selectedDate}</span></span>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Sales</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink">Rs.{weekSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Delivery</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink/70">Rs.{weekSupplyCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Expenses</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink/70">Rs.{weekExpenses.toLocaleString()}</span>
              </div>
              <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Profit</span>
                 <span className={`font-mono text-sm md:text-base font-black ${weekProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>Rs.{weekProfit.toLocaleString()}</span>
              </div>
            </div>

            {/* This Month */}
            <div className="bg-bg/60 border border-ink-faint p-3 rounded-xl space-y-1.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/40">This Month <span className="text-ink/20 normal-case font-normal">{selectedDateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span></span>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Sales</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink">Rs.{monthSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Delivery</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink/70">Rs.{monthSupplyCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Expenses</span>
                 <span className="font-mono text-xs md:text-sm font-bold text-ink/70">Rs.{monthExpensesTotal.toLocaleString()}</span>
              </div>
              <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                <span className="font-mono text-[8px] text-ink/40 uppercase">Profit</span>
                 <span className={`font-mono text-sm md:text-base font-black ${monthProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>Rs.{monthProfit.toLocaleString()}</span>
              </div>
            </div>

            <button onClick={() => setShowReport(false)} className="w-full py-2.5 bg-accent text-bg font-mono text-[9px] font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Rate Edit Modal */}
      {showRateModal && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowRateModal(false)}>
          <div className="bg-surface border border-ink-faint rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Update Daily Rate</span>
              <button onClick={() => setShowRateModal(false)} className="p-1 hover:bg-ink-faint rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickRateUpdate} className="space-y-4">
              <div>
                <span className="font-mono text-[8px] text-ink/40 uppercase tracking-widest block mb-1">Date</span>
                <input type="date" value={rateModalDate} onChange={e => setRateModalDate(e.target.value)}
                  className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-sm focus:ring-1 focus:ring-accent outline-none" />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm opacity-30">Rs.</span>
                <input
                  type="number"
                  value={quickRate}
                  onChange={(e) => setQuickRate(e.target.value)}
                  className="w-full bg-bg border border-ink-faint rounded px-10 py-4 font-mono text-3xl font-bold focus:ring-1 focus:ring-accent outline-none transition-all"
                  placeholder="000"
                  autoFocus
                />
              </div>
              {dailyRates && dailyRates[rateModalDate] && (
                <div className="font-mono text-[8px] text-ink/40">
                  Previously saved: <span className="font-bold text-accent">Rs.{dailyRates[rateModalDate]}</span> for {rateModalDate}
                </div>
              )}
              {supplyLogs.some(s => s.date === rateModalDate) && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={updateExistingSupplies} onChange={e => setUpdateExistingSupplies(e.target.checked)} className="accent-accent w-4 h-4" />
                  <span className="font-mono text-[9px] text-ink/60">Update existing supplies for this date with new rate</span>
                </label>
              )}
              {orders.some(o => o.date === rateModalDate) && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={updateExistingOrders} onChange={e => setUpdateExistingOrders(e.target.checked)} className="accent-accent w-4 h-4" />
                  <span className="font-mono text-[9px] text-ink/60">Update existing orders (bills) for this date with new rate</span>
                </label>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRateModal(false)} className="flex-1 py-3 font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-80 rounded transition-all cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRate || !quickRate || parseFloat(quickRate) <= 0}
                  className="flex-1 py-3 bg-accent text-bg font-mono font-bold text-[9px] uppercase tracking-widest rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 cursor-pointer"
                >
                  {isUpdatingRate ? "Updating..." : "Update Rate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Select Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowSupplierModal(false)}>
          <div className="bg-surface border border-ink-faint rounded-xl p-5 w-full max-w-xs shadow-2xl space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Select Source</span>
              <button onClick={() => setShowSupplierModal(false)} className="p-1 hover:bg-ink-faint rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              <button onClick={() => { onSupplierSelect("All"); setShowSupplierModal(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer ${selectedSupplierId === "" || selectedSupplierId === "All" ? "bg-accent text-bg" : "hover:bg-ink-faint/20 text-ink/70"}`}>
                All Suppliers
              </button>
              <button onClick={() => { onSupplierSelect("SELF_PURCHASE"); setShowSupplierModal(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer ${selectedSupplierId === "SELF_PURCHASE" ? "bg-accent text-bg" : "hover:bg-ink-faint/20 text-ink/70"}`}>
                Self Purchase (Owner)
              </button>
              {suppliers.map(s => (
                <button key={s.id} onClick={() => { onSupplierSelect(s.id); setShowSupplierModal(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer ${selectedSupplierId === s.id ? "bg-accent text-bg" : "hover:bg-ink-faint/20 text-ink/70"}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
