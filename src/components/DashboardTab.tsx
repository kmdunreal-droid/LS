import React, { useState, useEffect } from "react";
import { Order, SupplyLog, SupplierPayment, Expense, FormulaSettings, Supplier } from "../types";
import { 
  Flame,
  Activity,
  X
} from "lucide-react";
import { evaluate } from "mathjs";

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
  onNavigateToSales
}: DashboardTabProps) {
  const [quickRate, setQuickRate] = useState<string>(settings.baseRawRate.toString());
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SupplyLog | SupplierPayment | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    setQuickRate(settings.baseRawRate.toString());
  }, [settings.baseRawRate]);

  // Extract custom formula categories
  const uniqueCategories = Object.values(settings.items || {})
    .filter(it => it.name && it.name.trim() !== "" && it.expression && it.expression.trim() !== "")
    .map(it => it.name);

  const getEstimatedRateForCategory = (cat: string, base: number) => {
    const formulaItem = Object.values(settings.items || {}).find(
      (it) => it.name.toLowerCase() === cat.toLowerCase()
    );

    if (formulaItem) {
      if (formulaItem.expression) {
        try {
          const cleanExpression = formulaItem.expression.toLowerCase().replace(/supply/g, base.toString());
          const result = evaluate(cleanExpression);
          return Math.round(Number(result));
        } catch (err) {
          console.error("Evaluation error in DashboardTab:", err);
        }
      }
      if (formulaItem.multiplier !== undefined) {
        return Math.round(base * formulaItem.multiplier + (formulaItem.markup || 0));
      }
    }
    return base;
  };

  const currentTempRate = parseFloat(quickRate) || settings.baseRawRate;

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
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const currentSupplierName = selectedSupplierId === "" || selectedSupplierId === "All"
    ? "All Suppliers"
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

      {/* Daily Rate Editor */}
      <div className="bg-surface border border-ink-faint border-l-4 border-l-accent p-4 md:p-5 flex flex-col gap-3 rounded-lg">
        <h3 className="font-display text-base uppercase tracking-tight">Daily Rate</h3>
        <form onSubmit={handleQuickRateUpdate} className="flex flex-row gap-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs opacity-30">Rs.</span>
            <input 
              type="number" 
              value={quickRate}
              onChange={(e) => setQuickRate(e.target.value)}
              className="w-full bg-bg border border-ink-faint rounded px-8 py-2 md:py-3 font-mono text-lg md:text-xl focus:ring-1 focus:ring-accent outline-none transition-all"
              placeholder="000"
            />
          </div>
          <button 
            type="submit"
            disabled={isUpdatingRate || parseFloat(quickRate) === settings.baseRawRate}
            className="px-4 py-2 bg-accent text-bg font-mono font-bold text-[9px] uppercase tracking-widest rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 cursor-pointer shrink-0"
          >
            {isUpdatingRate ? "..." : "Update"}
          </button>
        </form>
      </div>

      {/* Stats Strip - Responsive Columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6">
        {/* Sales Card */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl hover:border-ink/40 transition-all duration-300 group">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] sm:text-[8px] md:text-[10px] uppercase tracking-[0.15em] text-ink/70 font-bold">Sales</span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-ink-faint" />
          </div>
          <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/40 uppercase block">Rs.</span>
          <div className="font-mono text-xs sm:text-xl md:text-3.5xl font-black leading-none text-ink/70 tracking-tight">{todaySales.toLocaleString()}</div>
          <span className="font-mono text-[6px] sm:text-[7px] md:text-[8px] uppercase tracking-widest text-ink/40 block font-bold truncate">Live Volume</span>
        </div>
        
        {/* Delivery Card */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] sm:text-[8px] md:text-[10px] uppercase tracking-[0.15em] text-ink/70 font-bold">Delivery</span>
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/40 uppercase block">Rs.</span>
          <div className="font-mono text-xs sm:text-xl md:text-3.5xl font-black leading-none text-ink/70 tracking-tight">{todaySuppliesCost.toLocaleString()}</div>
          <span className="font-mono text-[6px] sm:text-[7px] md:text-[8px] uppercase tracking-widest text-ink/40 block font-bold truncate">Today Cost</span>
        </div>

        {/* Stock Card */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] sm:text-[8px] md:text-[10px] uppercase tracking-[0.15em] text-ink/70 font-bold">Stock</span>
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/40 uppercase block">KG</span>
          <div className="font-mono text-xs sm:text-xl md:text-3.5xl font-black leading-none text-ink/70 tracking-tight">{daySupplies.reduce((s, log) => s + log.weightKg, 0).toFixed(1)}</div>
          <span className="font-mono text-[6px] sm:text-[7px] md:text-[8px] uppercase tracking-widest text-ink/40 block font-bold truncate">Today Weight</span>
        </div>
 
        {/* Profit Card */}
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl hover:border-ink/40 transition-all duration-300">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] sm:text-[8px] md:text-[10px] uppercase tracking-[0.15em] text-ink/70 font-bold">Profit</span>
            <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/40 uppercase block">Rs.</span>
          <div className="font-mono text-xs sm:text-xl md:text-3.5xl font-black leading-none text-ink/70 tracking-tight">{todayNetProfit.toLocaleString()}</div>
          <span className="font-mono text-[6px] sm:text-[7px] md:text-[8px] uppercase tracking-widest text-ink/40 block font-bold truncate">Net Operating</span>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Reports Side */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40 font-bold">Summary</span>
            <div className="h-px bg-ink-faint/20 flex-1" />
          </div>
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
            <div className={`font-mono text-3xl font-black tracking-tight ${outstandingSupplierDues > 0 ? "text-red-400" : "text-emerald-400"}`}>{outstandingSupplierDues.toLocaleString()}</div>
            <span className={`font-mono text-[10px] uppercase tracking-widest block truncate font-bold ${outstandingSupplierDues > 0 ? "text-red-400/60" : "text-emerald-400/60"}`}>
              {outstandingSupplierDues > 0 ? "Pending" : "Settled"} &bull; {selectedSupplierId === "" || selectedSupplierId === "All" ? "All Vendors" : suppliers.find(s => s.id === selectedSupplierId)?.name}
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
                const sup = suppliers.find(s => s.id === log.supplierId);
                const supName = sup?.name || log.notes?.split(' ')[0] || 'Unknown';
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`bg-orange-500/5 border border-orange-500/20 p-2.5 rounded-lg text-left hover:border-orange-400/40 transition-all cursor-pointer`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono text-[8px] font-bold uppercase tracking-widest text-orange-300`}>
                        {isSupply ? "Supply" : "Payment"}
                      </span>
                      <span className="font-mono text-[7px] text-orange-300/60">
                        {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div className="font-mono text-sm font-bold text-orange-100 truncate">
                      Rs. {(isSupply ? sLog!.totalCost : pLog!.amountPaid).toLocaleString()}
                    </div>
                    <div className="font-mono text-[8px] text-orange-300/60 truncate mt-0.5">
                      {supName}
                    </div>
                    {isSupply && sLog && (
                      <div className="font-mono text-[8px] text-orange-300/40 mt-0.5">
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
                    <span className="font-mono text-[9px] font-bold">{selectedLog.category || 'Raw Chicken'}</span>
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
                    <span className="font-mono text-[9px] font-bold text-accent">Rs. {selectedLog.totalCost.toLocaleString()}</span>
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
                    <span className="font-mono text-[9px] font-bold text-ink/40">Rs. {selectedLog.amountPaid.toLocaleString()}</span>
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
              <span className="font-mono text-[7px] font-bold uppercase tracking-widest text-ink/40">Today <span className="text-ink/20 normal-case font-normal">{selectedDate}</span></span>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Sales</span>
                <span className="font-mono text-[10px] font-bold text-ink">Rs.{todaySales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Delivery</span>
                <span className="font-mono text-[10px] font-bold text-ink/70">Rs.{todaySuppliesCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Expenses</span>
                <span className="font-mono text-[10px] font-bold text-ink/70">Rs.{todayExpensesCost.toLocaleString()}</span>
              </div>
              <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Profit</span>
                <span className={`font-mono text-[11px] font-black ${todayNetProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>Rs.{todayNetProfit.toLocaleString()}</span>
              </div>
            </div>

            {/* This Week */}
            <div className="bg-bg/60 border border-ink-faint p-3 rounded-xl space-y-1.5">
              <span className="font-mono text-[7px] font-bold uppercase tracking-widest text-ink/40">This Week <span className="text-ink/20 normal-case font-normal">{last7FromSelected[0]} – {selectedDate}</span></span>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Sales</span>
                <span className="font-mono text-[10px] font-bold text-ink">Rs.{weekSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Delivery</span>
                <span className="font-mono text-[10px] font-bold text-ink/70">Rs.{weekSupplyCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Expenses</span>
                <span className="font-mono text-[10px] font-bold text-ink/70">Rs.{weekExpenses.toLocaleString()}</span>
              </div>
              <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Profit</span>
                <span className={`font-mono text-[11px] font-black ${weekProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>Rs.{weekProfit.toLocaleString()}</span>
              </div>
            </div>

            {/* This Month */}
            <div className="bg-bg/60 border border-ink-faint p-3 rounded-xl space-y-1.5">
              <span className="font-mono text-[7px] font-bold uppercase tracking-widest text-ink/40">This Month <span className="text-ink/20 normal-case font-normal">{selectedDateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span></span>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Sales</span>
                <span className="font-mono text-[10px] font-bold text-ink">Rs.{monthSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Delivery</span>
                <span className="font-mono text-[10px] font-bold text-ink/70">Rs.{monthSupplyCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Expenses</span>
                <span className="font-mono text-[10px] font-bold text-ink/70">Rs.{monthExpensesTotal.toLocaleString()}</span>
              </div>
              <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                <span className="font-mono text-[7px] text-ink/40 uppercase">Profit</span>
                <span className={`font-mono text-[11px] font-black ${monthProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>Rs.{monthProfit.toLocaleString()}</span>
              </div>
            </div>

            <button onClick={() => setShowReport(false)} className="w-full py-2.5 bg-accent text-bg font-mono text-[9px] font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all">
              Close
            </button>
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
