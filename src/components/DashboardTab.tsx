import React, { useState } from "react";
import { Order, SupplyLog, SupplierPayment, Expense, FormulaSettings, Supplier } from "../types";
import { 
  DollarSign, 
  AlertCircle, 
  Flame, 
  Smartphone,
  Check,
  Activity,
  Layers,
  ChevronDown,
  ShoppingCart
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
  const [showRatesDropdown, setShowRatesDropdown] = useState(false);

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

  return (
    <div id="dashboard-tab" className="space-y-4 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-ink-faint/40 pb-3">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-accent/5 text-accent rounded">
            <Activity className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <span className="block font-mono text-[7px] font-bold opacity-30 uppercase tracking-widest leading-tight">Command Center</span>
            <h2 className="font-display text-base uppercase tracking-tight">Overview</h2>
          </div>
        </div>
      </div>


      {/* View Header & Rate Editor */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
        <div className="md:col-span-8 bg-surface border border-ink-faint border-l-4 border-l-accent p-4 md:p-5 flex flex-col gap-4 rounded-lg">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50">Active Pricing</span>
            <h3 className="font-display text-base uppercase tracking-tight mt-1">Daily Rate</h3>
          </div>
          
          <form onSubmit={handleQuickRateUpdate} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm opacity-30">Rs.</span>
              <input 
                type="number" 
                value={quickRate}
                onChange={(e) => setQuickRate(e.target.value)}
                className="w-full bg-bg border border-ink-faint rounded px-12 py-3 md:py-4 font-mono text-xl md:text-2xl focus:ring-1 focus:ring-accent outline-none transition-all"
                placeholder="000"
              />
            </div>
            
            <button 
              type="submit"
              disabled={isUpdatingRate || parseFloat(quickRate) === settings.baseRawRate}
              className="px-8 py-3 sm:py-0 bg-accent text-bg font-mono font-bold uppercase tracking-widest rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 cursor-pointer"
            >
              {isUpdatingRate ? "Syncing..." : "Update Rate"}
            </button>
          </form>


        </div>

        <div className="md:col-span-4 bg-surface border border-ink-faint p-6 md:p-8 flex flex-col gap-6 rounded-lg justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50">Report Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-transparent text-ink font-mono font-bold text-sm border border-ink-faint rounded px-3 py-2 mt-2 focus:ring-1 focus:ring-accent outline-none"
            />
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50">Supplier Filter</span>
            <select
              value={selectedSupplierId}
              onChange={(e) => onSupplierSelect(e.target.value)}
              className="w-full bg-transparent text-ink font-mono font-bold text-xs border border-ink-faint rounded px-3 py-2 mt-2 focus:ring-1 focus:ring-accent outline-none appearance-none"
            >
              <option value="All">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Strip - Responsive Columns */}
      <div className="grid grid-cols-3 gap-2 md:gap-6">
        {/* Sales Card - Electric Blue / Indigo */}
        <div className="bg-gradient-to-br from-blue-950/50 via-indigo-950/20 to-blue-900/30 border border-blue-500/30 p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl shadow-[0_8px_30px_rgba(59,130,246,0.12)] hover:border-blue-400/50 transition-all duration-300 glow-blue group">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] sm:text-[8px] md:text-[10px] uppercase tracking-[0.15em] text-blue-300 font-bold">Sales</span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500 animate-ping" />
          </div>
          <div className="font-mono text-xs sm:text-xl md:text-3.5xl font-black leading-none text-blue-100 tracking-tight">Rs. {todaySales.toLocaleString()}</div>
          <span className="font-mono text-[6px] sm:text-[7px] md:text-[8px] uppercase tracking-widest text-blue-400/60 block font-bold truncate">Live Volume</span>
        </div>
        
        {/* Stock Card - Amber / Gold */}
        <div className="bg-gradient-to-br from-amber-950/50 via-orange-950/20 to-amber-900/30 border border-amber-500/30 p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl shadow-[0_8px_30px_rgba(245,158,11,0.12)] hover:border-amber-400/50 transition-all duration-300 glow-orange">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] sm:text-[8px] md:text-[10px] uppercase tracking-[0.15em] text-amber-300 font-bold">Stock</span>
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="font-mono text-xs sm:text-xl md:text-3.5xl font-black leading-none text-amber-100 tracking-tight">{daySupplies.reduce((s, log) => s + log.weightKg, 0).toFixed(1)}<span className="text-[9px] sm:text-xs ml-0.5 sm:ml-1.5 opacity-60 text-amber-300">KG</span></div>
          <span className="font-mono text-[6px] sm:text-[7px] md:text-[8px] uppercase tracking-widest text-amber-400/60 block font-bold truncate">Today Weight</span>
        </div>
 
        {/* Profit Card - Neon Emerald */}
        <div className="bg-gradient-to-br from-emerald-950/50 via-teal-950/20 to-emerald-900/30 border border-emerald-500/40 p-3 sm:p-5 md:p-6 space-y-2 md:space-y-4 rounded-2xl shadow-[0_8px_30px_rgba(16,185,129,0.15)] hover:border-emerald-400/60 transition-all duration-300 glow-emerald">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] sm:text-[8px] md:text-[10px] uppercase tracking-[0.15em] text-emerald-300 font-bold">Profit</span>
            <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400 animate-bounce" />
          </div>
          <div className="font-mono text-xs sm:text-xl md:text-3.5xl font-black leading-none text-emerald-300 tracking-tight">Rs. {todayNetProfit.toLocaleString()}</div>
          <span className="font-mono text-[6px] sm:text-[7px] md:text-[8px] uppercase tracking-widest text-emerald-400/60 block font-bold truncate">Net Operating</span>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Reports Side */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-rose-400 font-bold">Summary</span>
            <div className="h-px bg-rose-500/20 flex-1" />
          </div>


        </div>

        {/* Right Side: Dues & Chart */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-purple-400 font-bold">Ledger</span>
            <div className="h-px bg-purple-500/20 flex-1" />
          </div>

          {/* Balance/Dues Card - Vibrant Purple */}
          <div className="bg-gradient-to-br from-purple-950/50 via-fuchsia-950/25 to-purple-900/30 border border-purple-500/30 p-4 space-y-1.5 rounded-2xl shadow-[0_8px_30px_rgba(168,85,247,0.12)] hover:border-purple-400/50 transition-all duration-300 glow-purple">
            <span className="font-mono text-[9px] uppercase tracking-widest text-purple-300 font-bold">Dues Balance</span>
            <div className="font-mono text-3xl font-black text-purple-300 tracking-tight">Rs. {outstandingSupplierDues.toLocaleString()}</div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400/70 block truncate font-bold">
              {selectedSupplierId === "" || selectedSupplierId === "All" ? "Across All Vendors" : suppliers.find(s => s.id === selectedSupplierId)?.name}
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
                      <div className="text-blue-400 font-bold">Sales: Rs. {d.sales}</div>
                      <div className="text-rose-400">Cost: Rs. {d.cost}</div>
                    </div>
                    
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 relative overflow-hidden ${
                        i === 6 
                          ? "bg-gradient-to-t from-orange-500 via-pink-500 to-purple-500 shadow-[0_0_15px_rgba(236,72,153,0.4)]" 
                          : "bg-gradient-to-t from-blue-600 via-indigo-500 to-purple-500 opacity-60 group-hover:opacity-90 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
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

          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Recent Logs</span>
            <div className="divide-y divide-ink-faint">
              {recentLogs.slice(0, 4).map(log => {
                const isSupply = 'totalCost' in log;
                return (
                  <div key={log.id} className="py-3 flex justify-between items-center group">
                    <div className="space-y-1">
                      <span className={`font-mono text-[9px] font-bold uppercase tracking-widest ${isSupply ? "text-accent" : "text-emerald-custom"}`}>
                        {isSupply ? "Supply" : "Payment"}
                      </span>
                      <div className="font-mono text-sm font-bold">
                        Rs. {(isSupply ? (log as SupplyLog).totalCost : (log as SupplierPayment).amountPaid).toLocaleString()}
                      </div>
                    </div>
                    <span className="font-mono text-[9px] opacity-30">
                      {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
