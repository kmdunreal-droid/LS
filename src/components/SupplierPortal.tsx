import React, { useState } from "react";
import { evaluate } from "mathjs";
import { FormulaSettings, SupplyLog, Supplier, SupplierPayment } from "../types";
import { 
  Weight, 
  Unlock, 
  CheckCircle, 
  LogOut,
  X,
  RefreshCw,
  CreditCard
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
  const [activeTab, setActiveTab] = useState<"deliveries" | "payments">("deliveries");

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

  return (
    <div id="supplier-portal-root" className="min-h-screen bg-bg text-ink flex flex-col font-sans selection:bg-accent selection:text-bg pb-16 md:pb-0">
      <header className="bg-surface border-b border-ink-faint px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="p-3 bg-accent text-bg shadow-xl shadow-accent/20 rounded">
            <Weight className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <h1 className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 leading-none">Supplier</h1>
            <p className="font-display text-2xl uppercase tracking-tight leading-tight">Portal</p>
          </div>

        </div>

        {/* Top Navbar Style Navigation Tabs - Hidden on mobile, shown on desktop */}
        <div className="hidden md:flex bg-bg/80 backdrop-blur-md border border-ink-faint p-1.5 rounded-xl gap-2.5 items-center shadow-inner">
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`flex items-center gap-2.5 px-6 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-300 transform cursor-pointer ${
              activeTab === "deliveries"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-bg shadow-lg shadow-orange-500/30 scale-[1.1] ring-2 ring-orange-500/20"
                : "text-orange-400/80 hover:text-orange-400 hover:bg-orange-500/10 hover:scale-105"
            }`}
          >
            📦 Deliveries (Mal Bheja)
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`flex items-center gap-2.5 px-6 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-300 transform cursor-pointer ${
              activeTab === "payments"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-[1.1] ring-2 ring-emerald-500/20"
                : "text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/10 hover:scale-105"
            }`}
          >
            💰 Payments Received (Raqam)
          </button>
        </div>

        <div className="flex items-center gap-8">
          {isSupplier ? (
            <button onClick={onExit} className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent border-b border-accent pb-0.5 hover:opacity-70 transition-opacity flex items-center gap-2">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          ) : isLockedOnly ? (
            <button onClick={() => setShowPinModal(true)} className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent border-b border-accent pb-0.5 hover:opacity-70 transition-opacity flex items-center gap-2">
              <Unlock className="w-3.5 h-3.5" /> Admin Unlock
            </button>
          ) : (
            <button onClick={onExit} className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-colors flex items-center gap-2">
              <X className="w-3.5 h-3.5" /> Exit
            </button>
          )}
        </div>
      </header>

      {/* Supplier Rate Editor with Date - matches owner portal UI */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-12 pt-4 md:pt-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          <div className="md:col-span-8 bg-surface border border-ink-faint border-l-4 border-l-accent p-4 md:p-5 flex flex-col gap-4 rounded-lg">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50">Active Pricing</span>
              <h3 className="font-display text-base uppercase tracking-tight mt-1">Daily Rate</h3>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const num = parseFloat(proposedRate);
              if (!isNaN(num) && num > 0 && onSaveSettings) {
                setIsUpdatingRate(true);
                try {
                  await onSaveSettings({ ...settings, baseRawRate: num });
                  setSupplyRate(proposedRate);
                } finally {
                  setIsUpdatingRate(false);
                }
              }
            }} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm opacity-30">Rs.</span>
                <input
                  type="number"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  className="w-full bg-bg border border-ink-faint rounded px-12 py-3 md:py-4 font-mono text-xl md:text-2xl focus:ring-1 focus:ring-accent outline-none transition-all"
                  placeholder={settings.baseRawRate.toString()}
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingRate || parseFloat(proposedRate) === settings.baseRawRate}
                className="px-8 py-3 sm:py-0 bg-accent text-bg font-mono font-bold uppercase tracking-widest rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 cursor-pointer"
              >
                {isUpdatingRate ? "Syncing..." : "Update Rate"}
              </button>
            </form>
          </div>

          <div className="md:col-span-4 bg-surface border border-ink-faint p-4 md:p-5 flex flex-col gap-3 rounded-lg justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50">Report Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-ink font-mono font-bold text-sm border border-ink-faint rounded px-3 py-2 mt-2 focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 p-4 md:p-12 flex-1">
        {activeTab === "deliveries" ? (
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
        ) : (
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
        )}
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

      {/* Mobile Bottom Navigation Bar for Supplier Portal */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-ink-faint grid grid-cols-2 py-3 z-40 shadow-[0_-8px_20px_rgba(0,0,0,0.3)]">
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
