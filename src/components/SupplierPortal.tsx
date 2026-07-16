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
  Flame
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
  isLockedOnly = false
}: SupplierPortalProps) {
  const { isSupplier, supplierId } = useAuth();
  
  // Find current logged-in supplier if any
  const currentSupplier = suppliers.find(s => s.id === supplierId);
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [weightKg, setWeightKg] = useState<string>("");
  const [category, setCategory] = useState<string>("Whole Chicken");
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

  const [supplierName, setSupplierName] = useState(currentSupplier ? currentSupplier.name : "Zeeshan Broiler");
  const [isOtherSupplier, setIsOtherSupplier] = useState(false);
  const [otherSupplierName, setOtherSupplierName] = useState("");

  const handleSupplierNameChange = (val: string) => {
    if (val === "__OTHER__") {
      setIsOtherSupplier(true);
      setSupplierName("");
    } else {
      setIsOtherSupplier(false);
      setSupplierName(val);
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

  const getEstimatedRateForCategory = (cat: string) => {
    const base = settings.baseRawRate;
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
      case "Whole Chicken": return base;
      case "Chest / Boneless": return Math.round(base * 1.4);
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
      const selectedSup = suppliers.find(s => s.name === supplierName);
      const finalSupplierName = isOtherSupplier ? otherSupplierName.trim() : supplierName.trim();

      await onAddLog({
        date,
        weightKg: weightNum,
        supplyRatePerKg: rateNum,
        totalCost: weightNum * rateNum,
        notes: `${finalSupplierName} ${notes.trim() ? `(${notes.trim()})` : ""}`.trim() || "Raw Chicken Supply",
        category: finalCategory,
        ...(currentSupplier ? { supplierId: currentSupplier.id } : (selectedSup ? { supplierId: selectedSup.id } : { supplierId: finalSupplierName })),
      });
      setWeightKg("");
      setNotes("");
      setOtherSupplierName("");
      setIsOtherSupplier(false);
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
    setEditCategory(log.category || "Whole Chicken");
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
      const selectedSup = suppliers.find(s => s.name === supplierName);
      const finalSupplierName = isOtherSupplier ? otherSupplierName.trim() : supplierName.trim();

      await onAddPayment({
        date,
        amountPaid: amountNum,
        notes: `${finalSupplierName} ${payNotes.trim() ? `(${payNotes.trim()})` : ""}`.trim() || "Cash Payment Received",
        ...(currentSupplier ? { supplierId: currentSupplier.id } : (selectedSup ? { supplierId: selectedSup.id } : { supplierId: finalSupplierName })),
      });
      setPayAmount("");
      setPayNotes("");
      setOtherSupplierName("");
      setIsOtherSupplier(false);
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
    ? supplyLogs.filter(l => l.supplierId === currentSupplier.id || l.notes.toLowerCase().includes(currentSupplier.name.toLowerCase()))
    : supplyLogs;

  const todayLogs = relevantLogs.filter((log) => log.date === date);
  const totalTodayWeight = todayLogs.reduce((sum, log) => sum + log.weightKg, 0);
  const totalTodayCost = todayLogs.reduce((sum, log) => sum + log.totalCost, 0);

  const relevantPayments = currentSupplier 
    ? payments.filter(p => p.supplierId === currentSupplier.id || p.notes.toLowerCase().includes(currentSupplier.name.toLowerCase()))
    : payments;

  const todayPayments = relevantPayments.filter((p) => p.date === date);
  const totalTodayPayments = todayPayments.reduce((sum, p) => sum + p.amountPaid, 0);

  // Dashboard calculations
  const totalSupplied = relevantLogs.reduce((sum, l) => sum + l.totalCost, 0);
  const totalPaid = relevantPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const balance = totalSupplied - totalPaid;

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
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent text-bg shadow-lg shadow-accent/20 rounded-lg">
              <Weight className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] opacity-40 leading-none block">Supplier</span>
              <span className="font-display text-sm uppercase tracking-tight leading-tight block">Portal</span>
            </div>
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

        <div className="p-3 border-t border-ink-faint">
          {isSupplier ? (
            <button onClick={onExit} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          ) : isLockedOnly ? (
            <button onClick={() => setShowPinModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest text-accent/60 hover:text-accent hover:bg-accent/10 transition-all cursor-pointer">
              <Unlock className="w-4 h-4" /> Admin Unlock
            </button>
          ) : (
            <button onClick={onExit} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40 hover:text-ink/70 hover:bg-ink-faint/10 transition-all cursor-pointer">
              <X className="w-4 h-4" /> Exit
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Rate Editor Bar */}
        <div className="bg-bg/50 border-b border-ink-faint px-4 md:px-8 py-3">
          <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 text-orange-400 rounded-lg">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-orange-300 font-bold">Daily Rate</span>
                <p className="font-mono text-[8px] text-orange-400/60">Update today's chicken rate</p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-orange-400/60">Rs.</span>
                <input
                  type="number"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  className="w-24 bg-transparent border-b-2 border-orange-500/30 text-xl font-display font-black text-orange-400 text-center focus:outline-none focus:border-orange-400 transition-all py-0.5"
                  placeholder="000"
                />
              </div>
              <button
                onClick={handleUpdateGlobalRate}
                disabled={isUpdatingRate || parseFloat(proposedRate) === settings.baseRawRate}
                className="font-mono text-[9px] font-bold uppercase tracking-widest px-4 py-2 border border-orange-500/30 bg-orange-500/10 text-orange-300 rounded-lg hover:bg-orange-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                {isUpdatingRate ? "Updating..." : "Update Rate"}
              </button>
            </div>
            {rateSuccessMsg && (
              <span className="font-mono text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-emerald-400 animate-fade-in">{rateSuccessMsg}</span>
            )}
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 p-4 md:p-8">
        {activeTab === "dashboard" ? (
          <>
            <div className="lg:col-span-12 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-violet-950/50 via-purple-950/20 to-fuchsia-900/30 border border-violet-500/35 p-6 md:p-8 flex flex-col justify-between rounded-2xl shadow-[0_8px_30px_rgba(139,92,246,0.12)] hover:border-violet-400/50 transition-all duration-300 glow-purple">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-violet-300">Total Supplied (Raqam)</span>
                    <Weight className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="space-y-1 mt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[9px] font-bold text-violet-400/60 uppercase">Rs.</span>
                      <span className="font-display text-3xl md:text-4xl font-black text-violet-100 tracking-tight">{totalSupplied.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-950/50 via-teal-950/20 to-green-900/30 border border-emerald-500/35 p-6 md:p-8 flex flex-col justify-between rounded-2xl shadow-[0_8px_30px_rgba(16,185,129,0.12)] hover:border-emerald-400/50 transition-all duration-300 glow-emerald">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-300">Total Paid (Ada Shuda)</span>
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="space-y-1 mt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[9px] font-bold text-emerald-400/60 uppercase">Rs.</span>
                      <span className="font-display text-3xl md:text-4xl font-black text-emerald-100 tracking-tight">{totalPaid.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className={`bg-gradient-to-br p-6 md:p-8 flex flex-col justify-between rounded-2xl shadow-[0_8px_30px_rgba(249,115,22,0.12)] transition-all duration-300 ${
                  balance > 0
                    ? "from-orange-950/50 via-amber-950/20 to-orange-900/30 border border-orange-500/35 hover:border-orange-400/50 glow-orange"
                    : "from-teal-950/50 via-cyan-950/20 to-emerald-900/30 border border-teal-500/35 hover:border-teal-400/50 glow-emerald"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[8px] font-bold uppercase tracking-[0.2em] ${balance > 0 ? "text-orange-300" : "text-teal-300"}`}>Balance (Baki)</span>
                    {balance > 0 ? <Weight className="w-4 h-4 text-orange-400" /> : <CheckCircle className="w-4 h-4 text-teal-400" />}
                  </div>
                  <div className="space-y-1 mt-4">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-mono text-[9px] font-bold uppercase ${balance > 0 ? "text-orange-400/60" : "text-teal-400/60"}`}>Rs.</span>
                      <span className={`font-display text-3xl md:text-4xl font-black tracking-tight ${balance > 0 ? "text-orange-100" : "text-teal-100"}`}>
                        {Math.abs(balance).toLocaleString()}
                      </span>
                      <span className={`font-mono text-[8px] font-bold uppercase ${balance > 0 ? "text-orange-400/60" : "text-teal-400/60"}`}>
                        {balance >= 0 ? "Receivable" : "Excess"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : activeTab === "deliveries" ? (
          <>
            {/* Left Column: Deliveries Form */}
            <div className="lg:col-span-5 space-y-8 md:space-y-12 animate-fade-in">
              <div className="space-y-6 md:space-y-8">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 shrink-0">Add Delivery</span>
                  <div className="h-px bg-ink-faint flex-1" />
                </div>

                {successMessage && <div className="bg-emerald-custom/10 border border-emerald-custom/20 text-emerald-custom p-6 font-mono text-sm animate-fade-in rounded-lg">{successMessage}</div>}

                <form onSubmit={handleAddLog} className="space-y-10">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Effective Date</label>
                        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs focus:ring-1 focus:ring-accent outline-none font-mono rounded" />
                      </div>
                      <div className="space-y-2">
                        <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Supplier Name</label>
                        {currentSupplier ? (
                          <input 
                            type="text" 
                            disabled 
                            value={currentSupplier.name} 
                            className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs font-mono font-bold uppercase outline-none rounded opacity-50 cursor-not-allowed" 
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="relative">
                              <select
                                value={isOtherSupplier ? "__OTHER__" : supplierName}
                                onChange={(e) => handleSupplierNameChange(e.target.value)}
                                className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs font-mono font-bold uppercase outline-none rounded focus:ring-1 focus:ring-accent appearance-none cursor-pointer"
                              >
                                <option value="">-- SELECT SOURCE --</option>
                                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name.toUpperCase()}</option>)}
                                <option value="Zeeshan Broiler">ZEESHAN BROILER</option>
                                <option value="Sajid Poultry">SAJID POULTRY</option>
                                <option value="__OTHER__">+ REGISTER_NEW_SOURCE</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                              </div>
                            </div>
                            {isOtherSupplier && (
                              <input 
                                type="text" 
                                required 
                                placeholder="ENTER_SOURCE_NAME" 
                                value={otherSupplierName} 
                                onChange={(e) => setOtherSupplierName(e.target.value)} 
                                className="w-full bg-accent/5 border border-accent/20 px-4 py-3 text-xs text-accent font-mono font-bold uppercase rounded outline-none focus:ring-1 focus:ring-accent" 
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Category</label>
                      <div className="grid grid-cols-2 gap-1.5 mb-3">
                        {uniqueCategories.map((cat) => {
                          const estimatedRate = getEstimatedRateForCategory(cat);
                          const isSelected = category === cat;
                          const colorIdx = uniqueCategories.indexOf(cat) % 5;
                          const cardThemes = [
                            { bg: "from-teal-950/60 to-emerald-950/40", border: "border-teal-500/30", selected: "border-teal-400 ring-2 ring-teal-400/30", text: "text-teal-300" },
                            { bg: "from-blue-950/60 to-indigo-950/40", border: "border-blue-500/30", selected: "border-blue-400 ring-2 ring-blue-400/30", text: "text-blue-300" },
                            { bg: "from-purple-950/60 to-fuchsia-950/40", border: "border-purple-500/30", selected: "border-purple-400 ring-2 ring-purple-400/30", text: "text-purple-300" },
                            { bg: "from-amber-950/60 to-orange-950/40", border: "border-amber-500/30", selected: "border-amber-400 ring-2 ring-amber-400/30", text: "text-amber-300" },
                            { bg: "from-rose-950/60 to-pink-950/40", border: "border-rose-500/30", selected: "border-rose-400 ring-2 ring-rose-400/30", text: "text-rose-300" },
                          ];
                          const ct = cardThemes[colorIdx];
                          return (
                            <button key={cat} type="button" onClick={() => setCategory(cat)}
                              className={`bg-gradient-to-br ${ct.bg} border ${isSelected ? ct.selected : ct.border} p-2 rounded-lg text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] cursor-pointer ${isSelected ? "scale-[1.02]" : "opacity-70 hover:opacity-100"}`}>
                              <span className={`font-mono text-[6px] font-bold uppercase tracking-widest block ${ct.text}`}>{cat.toUpperCase()}</span>
                              <span className="font-mono text-[8px] font-black text-white leading-none">Rs.{estimatedRate}<span className="text-[6px] font-normal opacity-50">/KG</span></span>
                            </button>
                          );
                        })}
                        <button type="button" onClick={() => setIsNewCategory(true)}
                          className="bg-bg/40 border border-dashed border-ink-faint p-2 rounded-lg text-center transition-all hover:border-accent/40 hover:bg-accent/5 cursor-pointer flex flex-col items-center justify-center">
                          <span className="font-mono text-[14px] font-bold text-accent/60 leading-none">+</span>
                          <span className="font-mono text-[6px] font-bold uppercase tracking-widest text-accent/40">New</span>
                        </button>
                      </div>
                      <select value={isNewCategory ? "__CUSTOM_CAT__" : category} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs cursor-pointer appearance-none uppercase font-mono font-bold tracking-tight rounded outline-none focus:ring-1 focus:ring-accent">
                        {uniqueCategories.map((cat) => {
                          const estimatedRate = getEstimatedRateForCategory(cat);
                          return <option key={cat} value={cat} className="bg-surface">{cat.toUpperCase()} (RS. {estimatedRate}/KG)</option>;
                        })}
                        <option value="__CUSTOM_CAT__" className="text-accent bg-surface">+ ADD_CUSTOM_CLASS</option>
                      </select>
                      {isNewCategory && <input type="text" required placeholder="Enter Category..." value={customCategoryName} onChange={(e) => { setCustomCategoryName(e.target.value); setCategory(e.target.value); }} className="w-full bg-accent/5 border border-accent/20 px-4 py-3 text-xs text-accent font-mono font-bold uppercase mt-2 rounded outline-none focus:ring-1 focus:ring-accent" />}
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Weight (KG)</label>
                      <input type="number" step="0.01" min="0.1" required value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="w-full bg-surface border border-ink-faint px-4 py-4 text-2xl font-mono font-bold focus:ring-1 focus:ring-accent outline-none rounded" />
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Metadata / Annotations</label>
                      <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs font-mono opacity-50 focus:opacity-100 transition-all focus:ring-1 focus:ring-accent outline-none rounded" placeholder="Optional logistics notes..." />
                    </div>
                  </div>

                  {weightKg && supplyRate && (
                    <div className="bg-surface border border-ink-faint border-l-4 border-l-accent p-8 space-y-4 rounded-lg relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5"><CheckCircle className="w-16 h-16" /></div>
                      <span className="block font-mono text-[8px] font-bold text-accent uppercase tracking-widest">Computed Gross Value</span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-4xl font-bold tracking-tighter">Rs. {(parseFloat(weightKg) * parseFloat(supplyRate)).toLocaleString()}</span>
                      </div>
                      <span className="block font-mono text-[10px] opacity-20 uppercase tracking-widest">Audit Ref: L-{Date.now().toString().slice(-6)}</span>
                    </div>
                  )}

                  <button type="submit" disabled={saving} className="w-full bg-accent text-bg font-mono font-bold py-5 rounded text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-accent/10 hover:brightness-110 transition-all disabled:opacity-20 cursor-pointer">
                    {saving ? "Processing Transaction..." : "Commit Logistics Entry"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Deliveries Ledger */}
            <div className="lg:col-span-7 space-y-12 animate-fade-in">
              <div className="grid grid-cols-3 gap-8">
                <div className="bg-surface border border-ink-faint p-8 space-y-4 rounded-lg">
                  <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Daily Total Weight</span>
                  <span className="block font-mono text-[26px] font-bold tracking-tighter">{totalTodayWeight.toLocaleString()} <span className="text-sm opacity-30 uppercase">KG</span></span>
                </div>
                <div className="bg-surface border border-ink-faint p-8 space-y-4 rounded-lg">
                  <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Daily Total Value</span>
                  <span className="block font-mono text-[26px] font-bold text-accent tracking-tighter">Rs. {totalTodayCost.toLocaleString()}</span>
                </div>
                <div className="bg-surface border border-ink-faint p-8 space-y-4 rounded-lg">
                  <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Avg Rate / Kg</span>
                  <span className="block font-mono text-[26px] font-bold text-emerald-400 tracking-tighter">Rs. {totalTodayWeight > 0 ? Math.round(totalTodayCost / totalTodayWeight).toLocaleString() : "0"} <span className="text-sm opacity-30 uppercase">/KG</span></span>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-50 shrink-0">Daily Deliveries</span>
                  <div className="h-px bg-ink-faint flex-1" />
                </div>

                {todayLogs.length === 0 ? (
                  <div className="py-32 text-center space-y-4 border border-dashed border-ink-faint rounded-lg">
                    <span className="block font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No entries recorded</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {todayLogs.map((log) => (
                      <div key={log.id} className="bg-surface border border-ink-faint p-6 group hover:border-accent/30 transition-all rounded-lg relative">
                        {editingLogId === log.id ? (
                          <form onSubmit={handleUpdateLogSubmit} className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-1">
                                <label className="font-mono text-[8px] uppercase opacity-30">Weight (KG)</label>
                                <input type="number" step="0.01" value={editWeight} onChange={e => setEditWeight(e.target.value)} className="w-full bg-bg border border-ink-faint rounded px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                              <div className="space-y-1">
                                <label className="font-mono text-[8px] uppercase opacity-30">Rate (PKR)</label>
                                <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="w-full bg-bg border border-ink-faint rounded px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                            </div>
                            <div className="flex gap-6">
                              <button onClick={() => setEditingLogId(null)} className="font-mono text-[8px] font-bold uppercase opacity-30 hover:opacity-100 transition-all">Cancel</button>
                              <button type="submit" className="font-mono text-[8px] font-bold uppercase text-accent border-b border-accent">Save Changes</button>
                            </div>
                          </form>
                        ) : (
                          <div className="md:flex md:justify-between md:items-center">
                            <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                <span className="font-mono text-[9px] font-bold uppercase tracking-widest bg-bg border border-ink-faint px-3 py-1 rounded text-accent">{log.category?.toUpperCase() || "UNCLASSIFIED"}</span>
                                <span className="font-mono text-xs opacity-50 truncate max-w-[200px] md:max-w-none">{log.notes}</span>
                              </div>
                              <div className="flex gap-8 font-mono text-[10px] font-bold opacity-30 uppercase">
                                <span>Weight: {log.weightKg}kg</span>
                                <span>Rate: Rs.{log.supplyRatePerKg}</span>
                              </div>
                            </div>
                            <div className="mt-6 md:mt-0 flex items-center gap-8">
                              <div className="text-right">
                                <span className="block font-mono text-[8px] font-bold opacity-20 uppercase mb-1">Value</span>
                                <span className="font-mono text-xl font-bold text-accent tracking-tighter">Rs.{log.totalCost.toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditingLog(log)} className="opacity-30 hover:opacity-100 hover:text-accent transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>
                                <button onClick={() => { if (confirm("Delete this entry?")) onDeleteLog(log.id); }} className="opacity-30 hover:opacity-100 hover:text-accent transition-all"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === "payments" ? (
          <>
            {/* Left Column: Payments Form */}
            <div className="lg:col-span-5 space-y-8 md:space-y-12 animate-fade-in">
              <div className="space-y-6 md:space-y-8">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 shrink-0">Add Payment Received</span>
                  <div className="h-px bg-ink-faint flex-1" />
                </div>

                {successMessage && <div className="bg-emerald-custom/10 border border-emerald-custom/20 text-emerald-custom p-6 font-mono text-sm animate-fade-in rounded-lg">{successMessage}</div>}

                <form onSubmit={handleAddPaymentSubmit} className="space-y-10">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Effective Date</label>
                        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs focus:ring-1 focus:ring-accent outline-none font-mono rounded" />
                      </div>
                      <div className="space-y-2">
                        <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Supplier Name</label>
                        {currentSupplier ? (
                          <input 
                            type="text" 
                            disabled 
                            value={currentSupplier.name} 
                            className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs font-mono font-bold uppercase outline-none rounded opacity-50 cursor-not-allowed" 
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="relative">
                              <select
                                value={isOtherSupplier ? "__OTHER__" : supplierName}
                                onChange={(e) => handleSupplierNameChange(e.target.value)}
                                className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs font-mono font-bold uppercase outline-none rounded focus:ring-1 focus:ring-accent appearance-none cursor-pointer"
                              >
                                <option value="">-- SELECT SOURCE --</option>
                                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name.toUpperCase()}</option>)}
                                <option value="Zeeshan Broiler">ZEESHAN BROILER</option>
                                <option value="Sajid Poultry">SAJID POULTRY</option>
                                <option value="__OTHER__">+ REGISTER_NEW_SOURCE</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                              </div>
                            </div>
                            {isOtherSupplier && (
                              <input 
                                type="text" 
                                required 
                                placeholder="ENTER_SOURCE_NAME" 
                                value={otherSupplierName} 
                                onChange={(e) => setOtherSupplierName(e.target.value)} 
                                className="w-full bg-accent/5 border border-accent/20 px-4 py-3 text-xs text-accent font-mono font-bold uppercase rounded outline-none focus:ring-1 focus:ring-accent" 
                              />
                            )}
                          </div>
                        )}
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

                  <button type="submit" disabled={paySaving} className="w-full bg-accent text-bg font-mono font-bold py-5 rounded text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-accent/10 hover:brightness-110 transition-all disabled:opacity-20 cursor-pointer">
                    {paySaving ? "Saving Payment..." : "Record Payment Entry"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Payments Ledger */}
            <div className="lg:col-span-7 space-y-12 animate-fade-in">
              <div className="grid grid-cols-1 gap-8">
                <div className="bg-surface border border-ink-faint p-8 space-y-4 rounded-lg">
                  <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Daily Total Payments Received</span>
                  <span className="block font-mono text-4xl font-bold text-emerald-custom tracking-tighter">Rs. {totalTodayPayments.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-50 shrink-0">Daily Payments</span>
                  <div className="h-px bg-ink-faint flex-1" />
                </div>

                {todayPayments.length === 0 ? (
                  <div className="py-32 text-center space-y-4 border border-dashed border-ink-faint rounded-lg">
                    <span className="block font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No payments recorded for this date</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {todayPayments.map((pay) => (
                      <div key={pay.id} className="bg-surface border border-ink-faint p-6 group hover:border-accent/30 transition-all rounded-lg relative">
                        {editingPaymentId === pay.id ? (
                          <form onSubmit={handleUpdatePaymentSubmit} className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 gap-6">
                              <div className="space-y-1">
                                <label className="font-mono text-[8px] uppercase opacity-30">Amount (PKR)</label>
                                <input type="number" value={editPayAmount} onChange={e => setEditPayAmount(e.target.value)} className="w-full bg-bg border border-ink-faint rounded px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                              <div className="space-y-1">
                                <label className="font-mono text-[8px] uppercase opacity-30">Notes</label>
                                <input type="text" value={editPayNotes} onChange={e => setEditPayNotes(e.target.value)} className="w-full bg-bg border border-ink-faint rounded px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-accent outline-none" />
                              </div>
                            </div>
                            <div className="flex gap-6">
                              <button onClick={() => setEditingPaymentId(null)} className="font-mono text-[8px] font-bold uppercase opacity-30 hover:opacity-100 transition-all">Cancel</button>
                              <button type="submit" className="font-mono text-[8px] font-bold uppercase text-accent border-b border-accent">Save Changes</button>
                            </div>
                          </form>
                        ) : (
                          <div className="md:flex md:justify-between md:items-center">
                            <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                <span className="font-mono text-[9px] font-bold uppercase tracking-widest bg-bg border border-emerald-custom/20 text-emerald-custom px-3 py-1 rounded">CASH RECEIVED</span>
                                <span className="font-mono text-xs opacity-50 truncate max-w-[200px] md:max-w-none">{pay.notes}</span>
                              </div>
                            </div>
                            <div className="mt-6 md:mt-0 flex items-center gap-8">
                              <div className="text-right">
                                <span className="block font-mono text-[8px] font-bold opacity-20 uppercase mb-1">Amount</span>
                                <span className="font-mono text-xl font-bold text-emerald-custom tracking-tighter">Rs. {pay.amountPaid.toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditingPayment(pay)} className="opacity-30 hover:opacity-100 hover:text-accent transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>
                                <button onClick={() => { if (confirm("Delete this payment?")) onDeletePayment(pay.id); }} className="opacity-30 hover:opacity-100 hover:text-accent transition-all"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
                  <span className="font-display text-2xl text-accent">Rs. {settings.baseRawRate} / KG</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <footer className="bg-surface border-t border-ink-faint py-6 px-8 mt-auto">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-6">
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-ink-faint grid grid-cols-3 py-3 z-40 shadow-[0_-8px_20px_rgba(0,0,0,0.3)]">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 transform ${
            activeTab === "dashboard" 
              ? "text-purple-500 scale-112 font-bold opacity-100" 
              : "text-ink/40 hover:text-purple-400 hover:scale-105"
          }`}
        >
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${
            activeTab === 'dashboard' 
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md shadow-purple-500/20 ring-2 ring-purple-500/20' 
              : 'bg-purple-500/5 text-purple-400/60 hover:bg-purple-500/10'
          }`}>
            <LayoutDashboard className={`w-5 h-5 transition-transform ${activeTab === 'dashboard' ? 'stroke-[2.5px] scale-110' : ''}`} />
          </div>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${activeTab === 'dashboard' ? 'text-purple-500' : 'text-ink/50'}`}>Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab("deliveries")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 transform ${
            activeTab === "deliveries" 
              ? "text-orange-500 scale-112 font-bold opacity-100" 
              : "text-ink/40 hover:text-orange-400 hover:scale-105"
          }`}
        >
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${
            activeTab === 'deliveries' 
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-bg shadow-md shadow-orange-500/20 ring-2 ring-orange-500/20' 
              : 'bg-orange-500/5 text-orange-400/60 hover:bg-orange-500/10'
          }`}>
            <Weight className={`w-5 h-5 transition-transform ${activeTab === 'deliveries' ? 'stroke-[2.5px] scale-110' : ''}`} />
          </div>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${activeTab === 'deliveries' ? 'text-orange-500' : 'text-ink/50'}`}>Deliveries</span>
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 transform ${
            activeTab === "payments" 
              ? "text-emerald-500 scale-112 font-bold opacity-100" 
              : "text-ink/40 hover:text-emerald-400 hover:scale-105"
          }`}
        >
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${
            activeTab === 'payments' 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20' 
              : 'bg-emerald-500/5 text-emerald-400/60 hover:bg-emerald-500/10'
          }`}>
            <CreditCard className={`w-5 h-5 transition-transform ${activeTab === 'payments' ? 'stroke-[2.5px] scale-110' : ''}`} />
          </div>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${activeTab === 'payments' ? 'text-emerald-500' : 'text-ink/50'}`}>Payments</span>
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
    </div>
  );
}
