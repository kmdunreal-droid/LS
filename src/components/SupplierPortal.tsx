import React, { useState, useEffect } from "react";
import { evaluate } from "mathjs";
import { FormulaSettings, SupplyLog, Supplier, SupplierPayment } from "../types";
import { 
  Weight, 
  Unlock, 
  CheckCircle, 
  LogOut,
  X,
  RefreshCw,
  CreditCard,
  LayoutDashboard,
  Settings,
  Flame,
  Activity,
  Menu
} from "lucide-react";
import { useAuth } from "./AuthGate";

interface SupplierPortalProps {
  settings: FormulaSettings;
  supplyLogs: SupplyLog[];
  suppliers: Supplier[];
  payments: SupplierPayment[];
  onAddLog: (log: Omit<SupplyLog, "id">) => Promise<string>;
  onUpdateLog: (id: string, log: Partial<SupplyLog>) => Promise<void>;
  onDeleteLog: (id: string) => Promise<void>;
  onAddPayment: (payment: Omit<SupplierPayment, "id">) => Promise<string>;
  onUpdatePayment: (id: string, payment: Partial<SupplierPayment>) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
  onSaveSettings?: (settings: FormulaSettings) => Promise<void>;
  onExit: () => void;
  isLockedOnly?: boolean;
  dailyRates?: Record<string, number>;
  getEffectiveRate?: (date: string) => number;
}

export default function SupplierPortal({ 
  settings, 
  supplyLogs, 
  suppliers,
  payments,
  onAddLog, 
  onUpdateLog,
  onDeleteLog, 
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onSaveSettings,
  onExit,
  isLockedOnly = false,
  dailyRates,
  getEffectiveRate
}: SupplierPortalProps) {
  const { isSupplier, supplierId } = useAuth();
  
  // Find current logged-in supplier if any
  const currentSupplier = suppliers.find(s => s.id === supplierId);
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [weightKg, setWeightKg] = useState<string>("");
  const [category, setCategory] = useState<string>("Chicken Dabu");
  const [supplyRate, setSupplyRate] = useState<string>(settings.baseRawRate.toString());
  const [proposedRate, setProposedRate] = useState<string>(settings.baseRawRate.toString());
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [rateSuccessMsg, setRateSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setProposedRate(settings.baseRawRate.toString());
    setSupplyRate(settings.baseRawRate.toString());
  }, [settings.baseRawRate]);

  const handleUpdateGlobalRate = async () => {
    const num = parseFloat(proposedRate);
    if (isNaN(num) || num <= 0 || !onSaveSettings) return;
    if (num === settings.baseRawRate) return;
    setIsUpdatingRate(true);
    try {
      await onSaveSettings({ ...settings, baseRawRate: num });
      setSupplyRate(proposedRate);
      setRateSuccessMsg("✓ Rate updated");
      setTimeout(() => setRateSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isNewCategory, setIsNewCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Weight entry modal (category click)
  const [weightModalCat, setWeightModalCat] = useState<string | null>(null);
  const [weightModalWeight, setWeightModalWeight] = useState<string>("");
  const [weightModalSaving, setWeightModalSaving] = useState(false);

  // Quick weight edit modal
  const weightEditPressRef = React.useRef<any>(null);
  const weightEditStartRef = React.useRef<number>(0);
  const [weightEditLog, setWeightEditLog] = useState<SupplyLog | null>(null);
  const [weightEditValue, setWeightEditValue] = useState<string>("");

  // Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "deliveries" | "payments" | "settings">("dashboard");

  // Payment states
  const [payAmount, setPayAmount] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [paySaving, setPaySaving] = useState<boolean>(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPayAmount, setEditPayAmount] = useState<string>("");
  const [editPayNotes, setEditPayNotes] = useState<string>("");

  const uniqueCategories = Object.values(settings.items || {})
    .filter(it => it.name && it.name.trim() !== "" && it.expression && it.expression.trim() !== "")
    .map(it => it.name);

  const getEstimatedRateForCategory = (cat: string, forDate?: string) => {
    const dateRate = forDate && getEffectiveRate ? getEffectiveRate(forDate) : null;
    const base = dateRate ?? settings.baseRawRate;
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
          console.error("Evaluation error in SupplierPortal:", err);
        }
      }
      if (formulaItem.multiplier !== undefined) {
        return Math.round(base * formulaItem.multiplier + (formulaItem.markup || 0));
      }
    }
    switch (cat) {
      case "Chicken Dabu": return base;
      case "Leg / Thigh": return Math.round(base * 1.1);
      case "Wings": return Math.round(base * 0.8);
      case "Wings V": return Math.round(base * 0.85);
      default: return base;
    }
  };

  const handleCategoryChange = (selectedCat: string) => {
    if (selectedCat === "__CUSTOM_CAT__") {
      setIsNewCategory(true);
      setCategory("");
    } else {
      setIsNewCategory(false);
      setCategory(selectedCat);
    }
  };

  const [pinInput, setPinInput] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weightKg);
    const rateNum = parseFloat(supplyRate);
    const finalCategory = isNewCategory ? customCategoryName.trim() : category.trim();

    if (!finalCategory || isNaN(weightNum) || weightNum <= 0 || isNaN(rateNum) || rateNum <= 0) {
      alert("Please fill all fields correctly.");
      return;
    }

    setSaving(true);
    try {
      await onAddLog({
        date,
        weightKg: weightNum,
        supplyRatePerKg: rateNum,
        totalCost: weightNum * rateNum,
        notes: notes.trim() || "PENDING:Raw Chicken Supply",
        category: finalCategory,
        supplierId: currentSupplier!.id,
      });
      setWeightKg("");
      setNotes("");
      setCustomCategoryName("");
      setIsNewCategory(false);
      setSuccessMessage("✓ Delivery Saved");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  const startEditingLog = (log: SupplyLog) => {
    setEditingLogId(log.id);
    setEditWeight(log.weightKg.toString());
    setEditRate(log.supplyRatePerKg.toString());
    setEditCategory(log.category || "Chicken Dabu");
    setEditNotes(log.notes || "");
  };

  const handleUpdateLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLogId) return;
    const wNum = parseFloat(editWeight);
    const rNum = parseFloat(editRate);
    if (isNaN(wNum) || isNaN(rNum)) return;

    try {
      await onUpdateLog(editingLogId, {
        weightKg: wNum,
        supplyRatePerKg: rNum,
        totalCost: wNum * rNum,
        category: editCategory,
        notes: editNotes,
      });
      setEditingLogId(null);
      setSuccessMessage("✓ Entry Updated.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "1234" || pinInput === "786") {
      onExit();
    } else {
      setPinError("Invalid Access Code.");
      setPinInput("");
    }
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setPaySaving(true);
    try {
      await onAddPayment({
        date,
        amountPaid: amountNum,
        notes: payNotes.trim() || "Cash Payment Received",
        supplierId: currentSupplier!.id,
      });
      setPayAmount("");
      setPayNotes("");
      setSuccessMessage("✓ Payment recorded successfully");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to save payment.");
    } finally {
      setPaySaving(false);
    }
  };

  const startEditingPayment = (pay: SupplierPayment) => {
    setEditingPaymentId(pay.id);
    setEditPayAmount(pay.amountPaid.toString());
    setEditPayNotes(pay.notes || "");
  };

  const handleUpdatePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentId) return;
    const aNum = parseFloat(editPayAmount);
    if (isNaN(aNum) || aNum <= 0) return;

    try {
      await onUpdatePayment(editingPaymentId, {
        amountPaid: aNum,
        notes: editPayNotes,
      });
      setEditingPaymentId(null);
      setSuccessMessage("✓ Payment Entry Updated.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const relevantLogs = currentSupplier 
    ? supplyLogs.filter(l => l.supplierId === currentSupplier.id || (l.notes || "").toLowerCase().includes(currentSupplier.name.toLowerCase()))
    : supplyLogs;

  const todayLogs = relevantLogs.filter((log) => log.date === date);
  const totalTodayWeight = todayLogs.reduce((sum, log) => sum + log.weightKg, 0);
  const totalTodayCost = todayLogs.reduce((sum, log) => sum + log.totalCost, 0);

  const relevantPayments = currentSupplier 
    ? payments.filter(p => p.supplierId === currentSupplier.id || (p.notes || "").toLowerCase().includes(currentSupplier.name.toLowerCase()))
    : payments;

  const todayPayments = relevantPayments.filter((p) => p.date === date);
  const totalTodayPayments = todayPayments.reduce((sum, p) => sum + p.amountPaid, 0);

  // Dashboard calculations
  const totalSupplied = relevantLogs.reduce((sum, l) => sum + l.totalCost, 0);
  const totalPaid = relevantPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const balance = totalSupplied - totalPaid;

  // Report calculations
  const reportDateObj = new Date(date + "T00:00:00");
  const reportMonth = reportDateObj.getMonth();
  const reportYear = reportDateObj.getFullYear();

  const getLast7FromDate = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(reportDateObj);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };
  const last7FromSelected = getLast7FromDate();

  const weekSupplied = last7FromSelected.reduce((sum, d) => sum + relevantLogs.filter(l => l.date === d).reduce((s, l) => s + l.totalCost, 0), 0);
  const weekPaid = last7FromSelected.reduce((sum, d) => sum + relevantPayments.filter(p => p.date === d).reduce((s, p) => s + p.amountPaid, 0), 0);
  const weekBalance = weekSupplied - weekPaid;

  const monthSupplies = relevantLogs.filter(l => { const d = new Date(l.date + "T00:00:00"); return d.getMonth() === reportMonth && d.getFullYear() === reportYear; });
  const monthPayments = relevantPayments.filter(p => { const d = new Date(p.date + "T00:00:00"); return d.getMonth() === reportMonth && d.getFullYear() === reportYear; });
  const monthSupplied = monthSupplies.reduce((s, l) => s + l.totalCost, 0);
  const monthPaid = monthPayments.reduce((s, p) => s + p.amountPaid, 0);
  const monthBalance = monthSupplied - monthPaid;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "deliveries", label: "Deliveries", icon: Weight },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <div id="supplier-portal-root" className="min-h-screen bg-bg text-ink flex font-sans selection:bg-accent selection:text-bg pb-16 md:pb-0">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-surface border-r border-ink-faint shrink-0">
        <div className="p-5 border-b border-ink-faint">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent text-bg shadow-lg shadow-accent/20 rounded-lg">
                <Weight className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] opacity-40 leading-none block">Supplier</span>
                <span className="font-display text-sm uppercase tracking-tight leading-tight block">Portal</span>
              </div>
            </div>
            <button onClick={onExit} className="p-2 rounded-lg hover:bg-rose-500/10 text-ink/30 hover:text-rose-400 transition-all cursor-pointer" title="Exit">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer ${
                activeTab === item.id
                  ? item.id === "dashboard" ? "bg-violet-500/15 text-violet-300 shadow-sm"
                    : item.id === "deliveries" ? "bg-orange-500/15 text-orange-300 shadow-sm"
                    : item.id === "payments" ? "bg-emerald-500/15 text-emerald-300 shadow-sm"
                    : "bg-accent/15 text-accent shadow-sm"
                  : "text-ink/40 hover:text-ink/70 hover:bg-ink-faint/10"
              }`}
            >
              <item.icon className={`w-4 h-4 ${
                activeTab === item.id ? "opacity-100" : "opacity-40"
              }`} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">

        <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 p-3 md:p-4">
        {activeTab === "dashboard" ? (
          <>
            {/* Row 1: Menu (mobile) + Rate / Exit */}
            <div className="lg:col-span-12 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-1.5 bg-surface border border-ink-faint rounded-lg text-ink active:scale-90 transition-all cursor-pointer">
                  <Menu className="w-4 h-4" />
                </button>
                <button onClick={() => setShowRateModal(true)} className="px-5 py-3 bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-xl font-mono text-sm font-bold uppercase tracking-widest text-accent hover:from-accent/20 hover:to-accent/10 transition-all cursor-pointer shrink-0 flex items-center gap-2 shadow-md">
                  <Flame className="w-5 h-5 text-accent" />
                  <span className="text-lg">Rs. {settings.baseRawRate}</span>
                  <span className="text-[9px] text-ink/40 uppercase">/KG</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onExit} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-ink/30 hover:text-rose-400 transition-all cursor-pointer" title="Exit">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="lg:col-span-12 animate-fade-in">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="group relative bg-surface/80 backdrop-blur-sm border border-ink-faint/50 p-3 md:p-4 flex flex-col justify-between rounded-xl hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.02] to-transparent rounded-xl pointer-events-none" />
                  <div className="flex items-center justify-between mb-1.5 relative z-10">
                    <span className="font-mono text-[7px] font-bold uppercase tracking-[0.2em] text-ink/50">Total Supplied (Raqam)</span>
                    <div className="p-1.5 rounded-lg bg-accent/5 group-hover:bg-accent/10 transition-colors">
                      <Weight className="w-3 h-3 text-accent/60 group-hover:text-accent transition-colors" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-2xl md:text-3xl font-black text-ink tracking-tight truncate">{totalSupplied.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="group relative bg-surface/80 backdrop-blur-sm border border-ink-faint/50 p-3 md:p-4 flex flex-col justify-between rounded-xl hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] to-transparent rounded-xl pointer-events-none" />
                  <div className="flex items-center justify-between mb-1.5 relative z-10">
                    <span className="font-mono text-[7px] font-bold uppercase tracking-[0.2em] text-ink/50">Today Delivery</span>
                    <div className="p-1.5 rounded-lg bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors">
                      <Activity className="w-3 h-3 text-blue-400/60 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-2xl md:text-3xl font-black text-ink tracking-tight truncate">{totalTodayCost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="group relative bg-surface/80 backdrop-blur-sm border border-emerald-500/20 p-3 md:p-4 flex flex-col justify-between rounded-xl hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent rounded-xl pointer-events-none" />
                  <div className="flex items-center justify-between mb-1.5 relative z-10">
                    <span className="font-mono text-[7px] font-bold uppercase tracking-[0.2em] text-emerald-400">Total Paid (Ada Shuda)</span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors">
                      <CreditCard className="w-3 h-3 text-emerald-400/60 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-2xl md:text-3xl font-black text-emerald-400 tracking-tight truncate">{totalPaid.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className={`group relative bg-surface/80 backdrop-blur-sm border p-3 md:p-4 flex flex-col justify-between rounded-xl transition-all duration-300 hover:shadow-lg ${balance > 0 ? "border-red-500/20 hover:border-red-500/40 hover:shadow-red-500/5" : "border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-500/5"}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${balance > 0 ? "from-red-500/[0.03]" : "from-emerald-500/[0.03]"} to-transparent rounded-xl pointer-events-none`} />
                  <div className="flex items-center justify-between mb-1.5 relative z-10">
                    <span className={`font-mono text-[7px] font-bold uppercase tracking-[0.2em] ${balance > 0 ? "text-red-400" : "text-emerald-400"}`}>Balance (Baki / Pending)</span>
                    <div className={`p-1.5 rounded-lg transition-colors ${balance > 0 ? "bg-red-500/5 group-hover:bg-red-500/10" : "bg-emerald-500/5 group-hover:bg-emerald-500/10"}`}>
                      {balance > 0 ? <Weight className="w-3 h-3 text-red-400/60 group-hover:text-red-400 transition-colors" /> : <CheckCircle className="w-3 h-3 text-emerald-400/60 group-hover:text-emerald-400 transition-colors" />}
                    </div>
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-baseline gap-1">
                      <span className={`font-display text-2xl md:text-3xl font-black tracking-tight truncate ${balance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {Math.abs(balance).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Report below cards */}
            <div className="lg:col-span-12 flex flex-col sm:flex-row items-center justify-center md:justify-end gap-2">
              <div className="flex items-center gap-1.5 bg-surface/60 border border-ink-faint/50 rounded-xl px-3 py-1.5 backdrop-blur-sm">
                <span className="font-mono text-[7px] font-bold uppercase tracking-widest text-ink/30">Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-32 bg-transparent border-none font-mono text-[10px] text-ink/70 focus:outline-none cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:hover:opacity-70 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
              </div>
              <button onClick={() => setShowReport(true)} className="group relative px-5 py-2.5 bg-gradient-to-r from-accent to-accent/80 rounded-xl font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white hover:from-accent/90 hover:to-accent shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-300 cursor-pointer shrink-0 flex items-center gap-2 overflow-hidden">
                <span className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] group-hover:bg-[position:100%_0] transition-all duration-700" />
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Generate Report
                </span>
              </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
              <div className="fixed inset-0 z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />
                <div className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-ink-faint shadow-2xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b border-ink-faint flex items-center justify-between">
                    <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">Menu</span>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-ink-faint/10 text-ink/30 hover:text-ink transition-all cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <nav className="p-3 space-y-1">
                    {navItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                          activeTab === item.id
                            ? "bg-accent text-bg shadow-lg shadow-accent/20"
                            : "text-ink/50 hover:bg-ink-faint/10 hover:text-ink"
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            )}

            {/* Rate Modal */}
            {showRateModal && (
              <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowRateModal(false)}>
                <div className="bg-surface border border-ink-faint rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Update Daily Rate</span>
                    <button onClick={() => setShowRateModal(false)} className="p-1 hover:bg-ink-faint rounded transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="font-mono text-[8px] text-ink/40 uppercase tracking-widest block mb-1">Date</span>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-sm focus:ring-1 focus:ring-accent outline-none" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-ink/40">Rs.</span>
                      <input
                        type="number"
                        value={proposedRate}
                        onChange={(e) => setProposedRate(e.target.value)}
                        className="flex-1 bg-bg border border-ink-faint rounded px-3 py-2 text-lg font-display font-black text-ink text-center focus:outline-none focus:border-accent transition-all"
                        placeholder="000"
                        autoFocus
                      />
                      <span className="font-mono text-[10px] font-bold text-ink/40">/KG</span>
                    </div>
                    <button
                      onClick={() => { handleUpdateGlobalRate(); if (!isUpdatingRate) setShowRateModal(false); }}
                      disabled={isUpdatingRate || parseFloat(proposedRate) === settings.baseRawRate}
                      className="w-full bg-accent text-bg font-mono text-[9px] font-bold uppercase tracking-widest py-3 rounded-lg hover:brightness-110 transition-all disabled:opacity-30"
                    >
                      {isUpdatingRate ? "Updating..." : "Update Rate"}
                    </button>
                    {rateSuccessMsg && (
                      <span className="block text-center font-mono text-[8px] font-bold uppercase tracking-widest text-emerald-custom">{rateSuccessMsg}</span>
                    )}
                  </div>
                  <button onClick={() => setShowRateModal(false)} className="w-full py-2 font-mono text-[8px] opacity-40 hover:opacity-80 uppercase tracking-widest rounded transition-all">
                    Cancel
                  </button>
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
                    <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/40">Today <span className="text-ink/20 normal-case font-normal">{date}</span></span>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Supplied</span>
                      <span className="font-mono text-xs md:text-sm font-bold text-ink">{totalTodayCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Paid</span>
                      <span className="font-mono text-xs md:text-sm font-bold text-ink/70">{totalTodayPayments.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Balance</span>
                      <span className={`font-mono text-sm md:text-base font-black ${(totalTodayCost - totalTodayPayments) >= 0 ? "text-red-400" : "text-emerald-400"}`}>{(totalTodayCost - totalTodayPayments).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* This Week */}
                  <div className="bg-bg/60 border border-ink-faint p-3 rounded-xl space-y-1.5">
                    <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/40">This Week <span className="text-ink/20 normal-case font-normal">{last7FromSelected[0]} – {date}</span></span>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Supplied</span>
                      <span className="font-mono text-xs md:text-sm font-bold text-ink">{weekSupplied.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Paid</span>
                      <span className="font-mono text-xs md:text-sm font-bold text-ink/70">{weekPaid.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Balance</span>
                      <span className={`font-mono text-sm md:text-base font-black ${weekBalance >= 0 ? "text-red-400" : "text-emerald-400"}`}>{weekBalance.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* This Month */}
                  <div className="bg-bg/60 border border-ink-faint p-3 rounded-xl space-y-1.5">
                    <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/40">This Month <span className="text-ink/20 normal-case font-normal">{reportDateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span></span>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Supplied</span>
                      <span className="font-mono text-xs md:text-sm font-bold text-ink">{monthSupplied.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Paid</span>
                      <span className="font-mono text-xs md:text-sm font-bold text-ink/70">{monthPaid.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-ink-faint/20 pt-1 flex justify-between items-center">
                      <span className="font-mono text-[8px] text-ink/40 uppercase">Balance</span>
                      <span className={`font-mono text-sm md:text-base font-black ${monthBalance >= 0 ? "text-red-400" : "text-emerald-400"}`}>{monthBalance.toLocaleString()}</span>
                    </div>
                  </div>

                  <button onClick={() => setShowReport(false)} className="w-full py-2.5 bg-accent text-bg font-mono text-[9px] font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all">
                    Close
                  </button>
                </div>
              </div>
            )}
          </>
        ) : activeTab === "deliveries" ? (
          <>
            {/* Add Stock Form */}
            <div className="lg:col-span-12 space-y-8 animate-fade-in">
              {successMessage && <div className="bg-emerald-custom/10 border border-emerald-custom/20 text-emerald-custom p-6 font-mono text-sm animate-fade-in rounded-lg">{successMessage}</div>}

              <div className="bg-surface border border-emerald-500/20 p-3 md:p-5 space-y-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs md:text-sm uppercase tracking-[0.2em] text-emerald-400 font-bold">Add Stock</span>
                  <Weight className="w-5 h-5 text-emerald-400/60" />
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="font-mono text-[8px] font-bold opacity-40 uppercase tracking-widest">Entry Date</span>
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none" />
                  </div>

                  <div className="space-y-1">
                    <span className="font-mono text-[8px] font-bold opacity-40 uppercase tracking-widest">Stock Category</span>
                    {isNewCategory ? (
                      <div className="animate-fade-in">
                        <input type="text" required placeholder="CATEGORY_NAME" value={customCategoryName}
                          onChange={(e) => { setCustomCategoryName(e.target.value); setCategory(e.target.value); }}
                          className="w-full bg-bg/80 border border-emerald-400/20 rounded px-3 py-2 font-mono text-xs text-emerald-400 outline-none appearance-none" />
                        <div className="flex items-center gap-2 mt-2">
                          <button type="button" onClick={() => { setWeightModalCat(customCategoryName.trim()); setWeightModalWeight(""); }}
                            disabled={!customCategoryName.trim()}
                            className="flex-1 bg-emerald-500 text-bg rounded-lg px-3 py-2 font-mono text-[8px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
                          >Add Weight →</button>
                          <button type="button" onClick={() => { setIsNewCategory(false); setCategory(uniqueCategories[0] || ""); }}
                            className="font-mono text-[7px] text-rose-400/60 hover:text-rose-400 uppercase tracking-widest"
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {uniqueCategories.map((cat) => {
                          const estimatedRate = getEstimatedRateForCategory(cat, date);
                          const isSelected = category === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => { setWeightModalCat(cat); setWeightModalWeight(""); }}
                              className={`bg-surface border ${isSelected ? "border-emerald-400 ring-2 ring-emerald-400/20" : "border-emerald-500/20 hover:border-emerald-400/40"} p-3 md:p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] cursor-pointer ${isSelected ? "scale-[1.02]" : "opacity-70 hover:opacity-100"}`}
                            >
                              <span className="font-mono text-xs md:text-sm font-bold uppercase tracking-widest block text-emerald-400 mb-1">{cat.toUpperCase()}</span>
                              <span className="font-mono text-sm md:text-base font-black text-emerald-100 leading-none">Rs.{estimatedRate}<span className="text-[9px] font-normal opacity-50">/KG</span></span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setIsNewCategory(true)}
                          className="bg-bg/40 border border-dashed border-emerald-500/20 p-3 md:p-4 rounded-xl text-center transition-all hover:border-emerald-400/40 hover:bg-emerald-500/5 cursor-pointer flex flex-col items-center justify-center min-h-[80px]"
                        >
                          <span className="font-mono text-lg font-bold text-emerald-400/60 leading-none">+</span>
                          <span className="font-mono text-xs md:text-sm font-bold uppercase tracking-widest text-emerald-400/40">New</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stock History */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-50 shrink-0">Stock History</span>
                  <div className="h-px bg-ink-faint flex-1" />
                </div>

                {todayLogs.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-ink-faint rounded-lg">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No entries recorded</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {todayLogs.map((log, idx) => {
                      const catKey = (log.category || "UNCLASSIFIED").replace(/\s+/g, "_").toUpperCase();
                      return editingLogId === log.id ? (
                        <div className="bg-surface border border-emerald-400/40 p-3 rounded-2xl animate-fade-in">
                          <form onSubmit={handleUpdateLogSubmit} className="space-y-3">
                            <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-emerald-300">Edit Entry</span>
                            <div className="space-y-2">
                              <div>
                                <span className="font-mono text-[6px] font-bold opacity-40 uppercase tracking-widest">Weight (KG)</span>
                                <input type="number" step="0.01" value={editWeight} onChange={e => setEditWeight(e.target.value)} className="w-full bg-bg/80 border border-ink-faint rounded px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                              <div>
                                <span className="font-mono text-[6px] font-bold opacity-40 uppercase tracking-widest">Rate (Rs/KG)</span>
                                <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="w-full bg-bg/80 border border-ink-faint rounded px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                              <div>
                                <span className="font-mono text-[6px] font-bold opacity-40 uppercase tracking-widest">Notes</span>
                                <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full bg-bg/80 border border-ink-faint rounded px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-3">
                              <button type="button" onClick={() => setEditingLogId(null)} className="font-mono text-[7px] uppercase opacity-40 hover:opacity-80">Cancel</button>
                              <button type="submit" className="font-mono text-[7px] font-bold uppercase text-emerald-300 border-b border-emerald-300">Save</button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <div
                          key={log.id}
                          className={`bg-surface border border-emerald-500/20 hover:border-emerald-400/40 p-3 md:p-4 transition-all duration-300 flex flex-col justify-between rounded-2xl group cursor-pointer select-none active:scale-[0.96] relative overflow-hidden`}
                          style={{ WebkitTouchCallout: "none", userSelect: "none" as const }}
                          onMouseDown={() => { weightEditStartRef.current = Date.now(); }}
                          onMouseUp={() => { if (Date.now() - weightEditStartRef.current >= 300 && editingLogId !== log.id) { setWeightEditLog(log); setWeightEditValue(log.weightKg.toString()); } }}
                          onTouchStart={() => { weightEditStartRef.current = Date.now(); }}
                          onTouchEnd={() => { if (Date.now() - weightEditStartRef.current >= 300 && editingLogId !== log.id) { setWeightEditLog(log); setWeightEditValue(log.weightKg.toString()); } }}
                        >
                          <div className="flex items-start justify-between relative z-10">
                            <span className="font-mono text-lg md:text-xl font-black uppercase tracking-widest text-emerald-400">
                              {catKey}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEditingLogId(log.id); setEditWeight(log.weightKg.toString()); setEditRate(log.supplyRatePerKg.toString()); setEditCategory(log.category || ""); setEditNotes(log.notes || ""); }}
                                className="opacity-60 hover:opacity-100 transition-all p-0.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-emerald-300" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); if (confirm("Delete this entry?")) onDeleteLog(log.id); }}
                                className="text-red-400 opacity-60 hover:opacity-100 transition-all p-0.5"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 relative z-10">
                            <div className="flex items-baseline gap-1.5 mt-1">
                              <span className="font-mono text-base md:text-lg font-black leading-none text-emerald-100">{log.weightKg}</span>
                              <span className="font-mono text-[10px] font-bold uppercase text-emerald-300/60">KG</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-mono text-[10px] font-bold uppercase text-emerald-300/60">Rs.</span>
                               <span className="font-mono text-lg md:text-xl font-black text-emerald-100 truncate">{log.totalCost.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === "payments" ? (
          <>
            {/* Left Column: Payments Form */}
            <div className="lg:col-span-5 space-y-4 md:space-y-6 animate-fade-in">
              <div className="space-y-4 md:space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 shrink-0">Add Payment Received</span>
                  <div className="h-px bg-ink-faint flex-1" />
                  <button onClick={() => setShowPaymentModal(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-bg font-mono text-[9px] font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer shrink-0 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Quick Receive
                  </button>
                </div>

                {successMessage && <div className="bg-emerald-custom/10 border border-emerald-custom/20 text-emerald-custom p-6 font-mono text-sm animate-fade-in rounded-lg">{successMessage}</div>}

                <form onSubmit={handleAddPaymentSubmit} className="space-y-5">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Effective Date</label>
                        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs focus:ring-1 focus:ring-accent outline-none font-mono rounded" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Amount Received (PKR)</label>
                      <input type="number" min="1" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full bg-surface border border-ink-faint px-4 py-4 text-2xl font-mono font-bold text-accent focus:ring-1 focus:ring-accent outline-none rounded" placeholder="e.g. 50000" />
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Payment Details / Notes</label>
                      <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs font-mono opacity-50 focus:opacity-100 transition-all focus:ring-1 focus:ring-accent outline-none rounded" placeholder="e.g. Cash received by hand, bank transfer, etc..." />
                    </div>
                  </div>

                  <button type="submit" disabled={paySaving} className="w-full bg-accent text-bg font-mono font-bold py-3.5 rounded text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-accent/10 hover:brightness-110 transition-all disabled:opacity-20 cursor-pointer">
                    {paySaving ? "Saving Payment..." : "Record Payment Entry"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Payments Ledger */}
            <div className="lg:col-span-7 space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-surface border border-ink-faint p-5 space-y-3 rounded-lg">
                  <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Daily Total Payments Received</span>
                   <span className="block font-mono text-4xl font-bold text-emerald-400 tracking-tighter truncate">Rs. {totalTodayPayments.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-50 shrink-0">Daily Payments</span>
                  <div className="h-px bg-ink-faint flex-1" />
                </div>

                {todayPayments.length === 0 ? (
                  <div className="py-32 text-center space-y-4 border border-dashed border-orange-500/20 rounded-lg">
                    <span className="block font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No payments recorded for this date</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {todayPayments.map((pay) => (
                      <div key={pay.id}>
                        {editingPaymentId === pay.id ? (
                          <form onSubmit={handleUpdatePaymentSubmit} className="bg-orange-500/10 border border-orange-400/40 p-3 rounded-lg space-y-3 animate-fade-in">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="font-mono text-[7px] uppercase opacity-40">Amount (PKR)</label>
                                <input type="number" value={editPayAmount} onChange={e => setEditPayAmount(e.target.value)} className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                              <div className="space-y-1">
                                <label className="font-mono text-[7px] uppercase opacity-40">Notes</label>
                                <input type="text" value={editPayNotes} onChange={e => setEditPayNotes(e.target.value)} className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                            </div>
                            <div className="flex justify-end gap-3">
                              <button onClick={() => setEditingPaymentId(null)} className="font-mono text-[8px] uppercase opacity-40 hover:opacity-100">Cancel</button>
                              <button type="submit" className="font-mono text-[8px] font-bold text-orange-300 border-b border-orange-300">Save</button>
                            </div>
                          </form>
                        ) : (
                          <div className="bg-orange-500/5 border border-orange-500/20 p-2.5 rounded-lg flex items-center justify-between group">
                            <div className="space-y-0.5">
                              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-orange-300">CASH RECEIVED</span>
                              <span className="font-mono text-[8px] text-orange-300/60 italic block">{pay.notes}</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <span className="font-mono text-sm font-bold text-orange-100 truncate">Rs. {pay.amountPaid.toLocaleString()}</span>
                              <button onClick={() => startEditingPayment(pay)} className="opacity-60 hover:opacity-100 p-0.5"><RefreshCw className="w-3.5 h-3.5 text-orange-300" /></button>
                              <button onClick={() => { if (confirm("Delete this payment?")) onDeletePayment(pay.id); }} className="text-red-400 opacity-60 hover:opacity-100 p-0.5"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Receive Modal */}
            {showPaymentModal && (
              <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowPaymentModal(false)}>
                <div className="bg-surface border border-ink-faint rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">Quick Receive Payment</span>
                    <button onClick={() => setShowPaymentModal(false)} className="p-1 hover:bg-ink-faint rounded transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={(e) => { handleAddPaymentSubmit(e); setShowPaymentModal(false); }}>
                    <div className="space-y-3">
                      <div>
                        <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Amount (PKR)</span>
                        <input type="number" min="1" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                          className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-3 font-mono text-lg font-bold text-accent focus:ring-1 focus:ring-accent outline-none mt-1" placeholder="Enter amount" autoFocus />
                      </div>
                      <div>
                        <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Notes (optional)</span>
                        <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                          className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-2 font-mono text-xs opacity-60 focus:opacity-100 focus:ring-1 focus:ring-accent outline-none mt-1" placeholder="e.g. Cash" />
                      </div>
                    </div>
                    <button type="submit" className="w-full mt-4 py-3 bg-emerald-500 text-bg font-mono text-[9px] font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer">
                      Receive Payment
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : activeTab === "settings" ? (
          <div className="lg:col-span-12 animate-fade-in">
            <div className="bg-surface border border-ink-faint p-6 md:p-8 rounded-2xl space-y-6">
              <div className="flex items-center gap-4">
                <Settings className="w-5 h-5 text-accent" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50">Supplier Settings</span>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest block mb-1">Supplier Name</span>
                  <span className="font-display text-lg uppercase text-ink">{currentSupplier?.name || "N/A"}</span>
                </div>
                <div>
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest block mb-1">Username</span>
                  <span className="font-mono text-sm text-ink/70">{settings.supplierUsername || "N/A"}</span>
                </div>
                <div>
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest block mb-1">Current Rate</span>
                   <span className="font-display text-2xl text-accent truncate">Rs. {settings.baseRawRate} / KG</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer */}
        <footer className="bg-surface border-t border-ink-faint py-3 px-4 mt-auto">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="font-mono text-[9px] text-ink/40 uppercase tracking-[0.2em]">
            Supplier Portal &copy; {new Date().getFullYear()}
          </div>
          <div className="font-mono text-[9px] text-ink/30 uppercase tracking-[0.2em]">
            System Online
          </div>
        </div>
      </footer>
      </div>

      {/* Mobile Bottom Navigation Bar for Supplier Portal */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-ink-faint grid grid-cols-3 py-2 z-40">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 transform ${
            activeTab === "dashboard" 
              ? "text-accent scale-112 font-bold opacity-100" 
              : "text-ink/40 hover:text-ink/70 hover:scale-105"
          }`}
        >
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${
            activeTab === 'dashboard' 
              ? 'bg-accent text-bg' 
              : 'bg-ink-faint/10 text-ink/50 hover:bg-ink-faint/20'
          }`}>
            <LayoutDashboard className={`w-5 h-5 transition-transform ${activeTab === 'dashboard' ? 'stroke-[2.5px] scale-110' : ''}`} />
          </div>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${activeTab === 'dashboard' ? 'text-accent' : 'text-ink/50'}`}>Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab("deliveries")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 transform ${
            activeTab === "deliveries" 
              ? "text-accent scale-112 font-bold opacity-100" 
              : "text-ink/40 hover:text-ink/70 hover:scale-105"
          }`}
        >
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${
            activeTab === 'deliveries' 
              ? 'bg-accent text-bg' 
              : 'bg-ink-faint/10 text-ink/50 hover:bg-ink-faint/20'
          }`}>
            <Weight className={`w-5 h-5 transition-transform ${activeTab === 'deliveries' ? 'stroke-[2.5px] scale-110' : ''}`} />
          </div>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${activeTab === 'deliveries' ? 'text-accent' : 'text-ink/50'}`}>Deliveries</span>
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 transform ${
            activeTab === "payments" 
              ? "text-accent scale-112 font-bold opacity-100" 
              : "text-ink/40 hover:text-ink/70 hover:scale-105"
          }`}
        >
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${
            activeTab === 'payments' 
              ? 'bg-accent text-bg' 
              : 'bg-ink-faint/10 text-ink/50 hover:bg-ink-faint/20'
          }`}>
            <CreditCard className={`w-5 h-5 transition-transform ${activeTab === 'payments' ? 'stroke-[2.5px] scale-110' : ''}`} />
          </div>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${activeTab === 'payments' ? 'text-accent' : 'text-ink/50'}`}>Payments</span>
        </button>
      </nav>

      {showPinModal && (
        <div className="fixed inset-0 bg-bg/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-ink-faint p-12 w-full max-w-sm shadow-2xl space-y-10 rounded-lg">
            <div className="text-center space-y-2">
              <p className="font-display text-xl uppercase tracking-tight">Enter Pin</p>
            </div>

            {pinError && <div className="text-accent text-[10px] font-bold font-mono uppercase tracking-widest text-center">{pinError}</div>}

            <form onSubmit={handlePinSubmit} className="space-y-8">
              <input
                type="password"
                required
                maxLength={4}
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(""); }}
                className="w-full bg-bg border border-ink-faint py-6 text-center font-mono font-bold text-4xl text-ink tracking-[1em] focus:ring-1 focus:ring-accent outline-none rounded"
                placeholder="••••"
                autoFocus
              />
              <div className="flex gap-4">
                <button type="button" onClick={() => { setPinInput(""); setShowPinModal(false); }} className="flex-1 py-4 font-mono text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-accent text-bg font-mono text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-accent/20 rounded hover:brightness-110 transition-colors">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Weight Edit Modal */}
      {weightEditLog && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setWeightEditLog(null)}>
          <div className="bg-surface border border-ink-faint rounded-xl p-5 w-full max-w-xs shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Edit Weight</span>
              <button onClick={() => setWeightEditLog(null)} className="p-1 hover:bg-ink-faint rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[8px] font-bold opacity-40 uppercase tracking-widest">Weight (KG)</span>
              <input type="number" step="0.01" value={weightEditValue} onChange={e => setWeightEditValue(e.target.value)} className="w-full bg-bg border border-ink-faint rounded px-3 py-3 font-mono text-2xl font-bold text-ink focus:ring-1 focus:ring-accent outline-none" autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setWeightEditLog(null)} className="flex-1 py-2.5 font-mono text-[9px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-all cursor-pointer">Cancel</button>
              <button onClick={async () => {
                const w = parseFloat(weightEditValue);
                if (isNaN(w) || w <= 0) return;
                try {
                  await onUpdateLog(weightEditLog.id, { weightKg: w, totalCost: w * weightEditLog.supplyRatePerKg });
                  setWeightEditLog(null);
                } catch (e) { console.error(e); }
              }} className="flex-1 py-2.5 bg-accent text-bg font-mono text-[9px] font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Weight Entry Modal (category click) */}
      {weightModalCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setWeightModalCat(null)}>
          <div className="bg-surface border border-ink-faint rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">{weightModalCat}</span>
                <button type="button" onClick={() => setWeightModalCat(null)} className="opacity-40 hover:opacity-100 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div>
                <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest block mb-1">Net Weight (KG)</span>
                <input
                  type="number" step="0.01" min="0.1" required
                  placeholder="00.00"
                  value={weightModalWeight}
                  onChange={(e) => setWeightModalWeight(e.target.value)}
                  className="w-full bg-bg/80 border border-ink-faint rounded px-4 py-4 font-mono text-3xl font-bold text-ink focus:ring-1 focus:ring-accent outline-none appearance-none"
                  autoFocus
                />
              </div>
              {weightModalWeight && parseFloat(weightModalWeight) > 0 && (
                <div className="bg-bg/60 border border-ink-faint rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">Rate</span>
                    <span className="font-mono text-sm font-bold text-ink">Rs. {getEstimatedRateForCategory(weightModalCat!, date).toLocaleString()}/KG</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-ink-faint/40 pt-2">
                    <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">Total Raqam</span>
                    <span className="font-display text-xl font-black text-accent">Rs. {(parseFloat(weightModalWeight) * getEstimatedRateForCategory(weightModalCat!, date)).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="text-right space-x-3">
                <button
                  type="button"
                  onClick={() => setWeightModalCat(null)}
                  className="px-4 py-2 font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-80"
                >Cancel</button>
                <button
                  type="button"
                  disabled={weightModalSaving || !weightModalWeight || parseFloat(weightModalWeight) <= 0}
                  onClick={async () => {
                    const w = parseFloat(weightModalWeight);
                    if (!weightModalCat || isNaN(w) || w <= 0) return;
                    setWeightModalSaving(true);
                    try {
                      const rate = getEstimatedRateForCategory(weightModalCat, date);
                      await onAddLog({
                        date,
                        weightKg: w,
                        supplyRatePerKg: rate,
                        totalCost: w * rate,
                        category: weightModalCat,
                        notes: "PENDING:Quick Add",
                        supplierId: currentSupplier?.id || "",
                      });
                      setWeightModalCat(null);
                      setWeightModalWeight("");
                    } catch (err) {
                      console.error(err);
                      alert("Failed to save.");
                    } finally {
                      setWeightModalSaving(false);
                    }
                  }}
                  className="px-6 py-2 bg-accent text-bg rounded-lg font-mono text-[9px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
                >
                  {weightModalSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
