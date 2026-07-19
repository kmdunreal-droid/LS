import React, { useState, useEffect } from "react";
import { FormulaSettings, SupplyLog, Supplier } from "../types";
import { Plus, Trash2, Calendar, Weight, DollarSign, Tag, RefreshCw, Layers, Filter, Sparkles, CheckCircle2, Users, Package, ChevronDown, ChevronUp, Flame, ShoppingCart } from "lucide-react";
import { evaluate } from "mathjs";

interface SuppliesTabProps {
  settings: FormulaSettings;
  supplyLogs: SupplyLog[];
  suppliers: Supplier[];
  selectedSupplierId: string;
  onAddLog: (log: Omit<SupplyLog, "id">) => Promise<string>;
  onUpdateLog: (id: string, log: Partial<SupplyLog>) => Promise<void>;
  onDeleteLog: (id: string) => Promise<void>;
  onSaveSettings: (settings: FormulaSettings) => Promise<void>;
  onNavigateToSales?: () => void;
}

export default function SuppliesTab({ settings, supplyLogs, suppliers, selectedSupplierId, onAddLog, onUpdateLog, onDeleteLog, onSaveSettings, onNavigateToSales }: SuppliesTabProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [weightKg, setWeightKg] = useState<string>("");

  // Unique categories from defaults, settings items, and existing supply logs
  const uniqueCategories = Array.from(
    new Set([
      "Chicken Dabu",
      "Leg / Thigh",
      "Wings",
      "Wings V",
      ...Object.values(settings.items || {})
        .filter(it => it.name && it.name.trim() !== "")
        .map(it => it.name),
      ...supplyLogs.map((log) => log.category).filter(Boolean),
    ])
  );

  const [category, setCategory] = useState<string>("Chicken Dabu");
  const [saving, setSaving] = useState(false);
  const [showRatesDropdown, setShowRatesDropdown] = useState(false);

  // Auto-sync category selection if settings items update
  useEffect(() => {
    if (uniqueCategories.length > 0 && !uniqueCategories.includes(category)) {
      setCategory(uniqueCategories[0]);
    }
  }, [settings.items]);

  // Local state for Base supply rate
  const [baseRawRate, setBaseRawRate] = useState<number>(settings.baseRawRate);

  // Sync default rate on raw base rate change
  useEffect(() => {
    setBaseRawRate(settings.baseRawRate);
  }, [settings.baseRawRate]);

  const handleBaseRateChange = async (newRate: number) => {
    setBaseRawRate(newRate);
    try {
      await onSaveSettings({
        ...settings,
        baseRawRate: newRate,
      });
    } catch (e) {
      console.error("Failed to auto-save base raw rate:", e);
    }
  };

  // Supplier info
  const [extraNotes, setExtraNotes] = useState("");
  const isSelfPurchase = selectedSupplierId === "SELF_PURCHASE";

  // Weight entry popup state
  const [weightModalCat, setWeightModalCat] = useState<string | null>(null);
  const [weightModalWeight, setWeightModalWeight] = useState("");
  const [weightModalSaving, setWeightModalSaving] = useState(false);

  // Supplier picker state (when no supplier selected)
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [pendingWeightData, setPendingWeightData] = useState<{ cat: string; weight: number } | null>(null);

  // New multi-category inputs
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");



  // Edit state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedLogIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedLogIds(newSet);
  };

  // Derived unique categories are declared at the component start

  // Smart rate calculator based on selected category & settings
  const getEstimatedRateForCategory = (cat: string) => {
    const base = baseRawRate;
    // Find matching formula item in settings
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
          console.error("Evaluation error in SuppliesTab:", err);
        }
      }
      if (formulaItem.multiplier !== undefined) {
        return Math.round(base * formulaItem.multiplier + (formulaItem.markup || 0));
      }
    }

    // Legacy default fallback
    switch (cat) {
      case "Chicken Dabu":
        return base;
      case "Leg / Thigh":
        return Math.round(base * (settings.items.leg?.multiplier || 1.1));
      case "Wings":
        return Math.round(base * (settings.items.wings?.multiplier || 0.8));
      case "Wings V":
        return Math.round(base * (settings.items.wingsV?.multiplier || 0.85));
      default:
        return base;
    }
  };

  // When category changes, auto-suggest the appropriate raw supply rate
  const handleCategoryChange = (selectedCat: string) => {
    if (selectedCat === "__CUSTOM_CAT__") {
      setIsNewCategory(true);
      setCategory("");
    } else {
      setIsNewCategory(false);
      setCategory(selectedCat);
    }
  };

  const startEditingLog = (log: SupplyLog) => {
    setEditingLogId(log.id);
    setEditWeight(log.weightKg.toString());
    setEditRate(log.supplyRatePerKg.toString());
    setEditDate(log.date);
    setEditNotes(log.notes || "");
    setEditCategory(log.category || "Chicken Dabu");
  };

  const cancelEditingLog = () => {
    setEditingLogId(null);
  };

  const handleUpdateLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLogId) return;

    const wNum = parseFloat(editWeight);
    const rNum = parseFloat(editRate);

    if (isNaN(wNum) || isNaN(rNum)) {
      alert("Please enter valid weight and rate.");
      return;
    }

    try {
      await onUpdateLog(editingLogId, {
        weightKg: wNum,
        supplyRatePerKg: rNum,
        totalCost: wNum * rNum,
        date: editDate,
        notes: editNotes,
        category: editCategory,
      });
      setEditingLogId(null);
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weightKg);
    const finalCategory = isNewCategory ? customCategoryName.trim() : category.trim();
    const rateNum = getEstimatedRateForCategory(finalCategory);

    if (!selectedSupplierId || selectedSupplierId === "All") {
      alert("Please select a source (Supplier or Self Purchase) from the Dashboard first.");
      return;
    }

    if (!finalCategory) {
      alert("Please select or type a category name.");
      return;
    }

    if (isNaN(weightNum) || weightNum <= 0 || isNaN(rateNum) || rateNum <= 0) {
      alert("Please enter valid Weight.");
      return;
    }

    setSaving(true);
    try {
      const totalCost = weightNum * rateNum;

      await onAddLog({
        date,
        weightKg: weightNum,
        supplyRatePerKg: rateNum,
        totalCost,
        supplierId: isSelfPurchase ? "" : selectedSupplierId,
        notes: isSelfPurchase ? "Self Purchase (Owner)" : extraNotes.trim(),
        category: finalCategory,
      });

      setWeightKg("");
      setExtraNotes("");
      setCustomCategoryName("");
      setIsNewCategory(false);
    } catch (e) {
      console.error(e);
      alert("An error occurred while saving the supply record.");
    } finally {
      setSaving(false);
    }
  };

  const totalRawWeight = supplyLogs.reduce((sum, log) => sum + log.weightKg, 0);
  const totalRawCost = supplyLogs.reduce((sum, log) => sum + log.totalCost, 0);

  const displayedWeight = supplyLogs.reduce((sum, log) => sum + log.weightKg, 0);
  const displayedCost = supplyLogs.reduce((sum, log) => sum + log.totalCost, 0);

  const cardTheme = { labelText: "text-teal-300", accentText: "text-teal-400" };

  return (
    <div id="supplies-tab" className="space-y-4 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-ink-faint/40 pb-3">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-accent/5 text-accent rounded">
            <Package className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <span className="block font-mono text-[7px] font-bold opacity-30 uppercase tracking-widest leading-tight">Inventory</span>
            <h2 className="font-display text-base uppercase tracking-tight">Supplies</h2>
          </div>
        </div>
      </div>

      {/* Supplies Stats Cards - Responsive */}
      <div className="grid grid-cols-3 gap-2 md:gap-6">
        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-ink/60">Raw Stock</span>
            <Weight className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/40 uppercase block">KG</span>
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-ink tracking-tight truncate">
                {displayedWeight.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-ink/60">Inv. Cost</span>
            <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/40 uppercase block">Rs.</span>
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-ink tracking-tight truncate">
                {displayedCost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-ink-faint p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-ink/60">Market Rate</span>
            <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-ink/40" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <span className="font-mono text-[7px] sm:text-[10px] font-bold text-ink/40 uppercase block">Rs. / KG</span>
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-ink tracking-tight italic truncate">
                {settings.baseRawRate}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Stock Form */}
      <div className="bg-surface border border-ink-faint p-2 space-y-2 rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-teal-300 font-bold">Add Stock</span>
            <span className="font-mono text-[7px] uppercase tracking-widest text-ink/30 bg-ink-faint/20 px-2 py-0.5 rounded-full">
              {isSelfPurchase ? "Self Purchase" : selectedSupplierId ? "Via Supplier" : "Select Source"}
            </span>
          </div>
          <Package className="w-3.5 h-3.5 text-teal-400" />
        </div>

        <div>
          <div>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg/80 border border-ink-faint rounded px-2 py-1.5 font-mono text-[10px] focus:ring-1 focus:ring-accent outline-none appearance-none" />
          </div>

          <div>
            {isNewCategory ? (
              <div className="animate-fade-in mt-1">
                <input type="text" required placeholder="CATEGORY_NAME" value={customCategoryName}
                  onChange={(e) => { setCustomCategoryName(e.target.value); setCategory(e.target.value); }}
                  className="w-full bg-bg/80 border border-accent/20 rounded px-2 py-1.5 font-mono text-[10px] text-accent outline-none appearance-none" />
                <div className="flex items-center gap-1 mt-1">
                  <button type="button" onClick={() => { setWeightModalCat(customCategoryName.trim()); setWeightModalWeight(""); }}
                    disabled={!customCategoryName.trim()}
                    className="flex-1 bg-accent text-bg rounded px-2 py-1 font-mono text-[7px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
                  >Add Weight →</button>
                  <button type="button" onClick={() => { setIsNewCategory(false); setCategory(uniqueCategories[0] || ""); }}
                    className="font-mono text-[7px] text-rose-400/60 hover:text-rose-400 uppercase tracking-widest"
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  {uniqueCategories.map((cat) => {
                    const estimatedRate = getEstimatedRateForCategory(cat);
                    const isSelected = category === cat;
                    const colorIdx = uniqueCategories.indexOf(cat) % 5;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setWeightModalCat(cat); setWeightModalWeight(""); }}
                        className={`bg-surface border ${isSelected ? "border-accent ring-2 ring-accent/20" : "border-ink-faint hover:border-ink/40"} p-2.5 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] cursor-pointer ${isSelected ? "scale-[1.02]" : "opacity-70 hover:opacity-100"}`}
                      >
                        <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest block text-emerald-400">{cat.toUpperCase()}</span>
                        <span className="font-mono text-xs md:text-sm font-black text-ink leading-none">Rs.{estimatedRate}<span className="text-[8px] font-normal opacity-50">/KG</span></span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsNewCategory(true)}
                    className="bg-bg/40 border border-dashed border-ink-faint p-2.5 rounded-xl text-center transition-all hover:border-accent/40 hover:bg-accent/5 cursor-pointer flex flex-col items-center justify-center min-h-[64px]"
                  >
                    <span className="font-mono text-lg font-bold text-accent/60 leading-none">+</span>
                    <span className="font-mono text-[9px] md:text-[11px] font-bold uppercase tracking-widest text-accent/40">New</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stock History */}
      <div className="space-y-4">
        <div className="flex items-center gap-8 border-b border-ink-faint pb-3">
          <span className="font-mono text-[8px] font-black uppercase tracking-[0.2em] opacity-20 shrink-0">Stock History</span>
          <div className="h-px bg-ink-faint flex-1 min-w-[50px]" />
        </div>

        {supplyLogs.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-orange-500/20 rounded">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No inventory logs found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {supplyLogs.map((log, idx) => {
              const theme = cardTheme;
              const catKey = (log.category || "WHOLE CHICKEN").replace(/\s+/g, "_").toUpperCase();

              return editingLogId === log.id ? (
                <form 
                  onSubmit={handleUpdateLogSubmit} 
                  className="bg-orange-500/10 border border-orange-400/40 p-3 rounded-2xl space-y-3 animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-orange-300">Edit Entry</span>
                  <div className="space-y-2">
                    <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Weight (KG)</span>
                    <input 
                      type="number" step="0.01"
                      value={editWeight} 
                      onChange={e => setEditWeight(e.target.value)}
                      className="w-full bg-bg/80 border border-ink-faint rounded px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button type="button" onClick={(e) => { e.stopPropagation(); cancelEditingLog(); }}
                      className="font-mono text-[8px] uppercase tracking-widest opacity-40 hover:opacity-80"
                    >Cancel</button>
                    <button type="submit"
                      className="font-mono text-[8px] font-bold uppercase tracking-widest text-orange-300 border-b border-orange-300"
                    >Save</button>
                  </div>
                </form>
              ) : (
                <div
                  key={log.id}
                  className="bg-orange-500/5 border border-orange-500/20 p-3 rounded-lg flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <span className="font-mono text-xs md:text-sm font-black uppercase tracking-widest text-emerald-400">
                      {catKey}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-sm md:text-base font-black leading-none text-orange-100">{log.weightKg}</span>
                      <span className="font-mono text-[9px] font-bold uppercase text-orange-300/60">KG</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[9px] font-bold uppercase text-orange-300/60">Rs.</span>
                       <span className="font-mono text-base md:text-lg font-black text-orange-100 truncate">{log.totalCost.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEditingLog(log); }}
                      className="opacity-60 hover:opacity-100 transition-all p-0.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-orange-300" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (confirm("Delete this supply record?")) onDeleteLog(log.id); }}
                      className="text-red-400 opacity-60 hover:opacity-100 transition-all p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Supplier Picker Modal */}
      {showSupplierPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => { setShowSupplierPicker(false); setPendingWeightData(null); }}>
          <div className="bg-surface border border-ink-faint rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Select Supplier</span>
                <button type="button" onClick={() => { setShowSupplierPicker(false); setPendingWeightData(null); }} className="opacity-40 hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              {pendingWeightData && (
                <div className="bg-bg/60 border border-ink-faint rounded-xl p-3 space-y-1 text-center">
                  <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest block">{pendingWeightData.cat}</span>
                  <span className="font-mono text-lg font-black text-ink">{pendingWeightData.weight} KG</span>
                </div>
              )}
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {suppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={async () => {
                      if (!pendingWeightData) return;
                      const rate = getEstimatedRateForCategory(pendingWeightData.cat);
                      setWeightModalSaving(true);
                      setShowSupplierPicker(false);
                      try {
                        await onAddLog({
                          date: new Date().toISOString().split("T")[0],
                          weightKg: pendingWeightData.weight,
                          supplyRatePerKg: rate,
                          totalCost: pendingWeightData.weight * rate,
                          supplierId: s.id,
                          notes: "",
                          category: pendingWeightData.cat,
                        });
                        setPendingWeightData(null);
                      } catch (err) {
                        console.error(err);
                        alert("Failed to save.");
                      } finally {
                        setWeightModalSaving(false);
                      }
                    }}
                    className="w-full text-left bg-bg/60 border border-ink-faint hover:border-accent/40 p-3 rounded-xl transition-all cursor-pointer group"
                  >
                    <span className="font-mono text-xs font-bold text-ink group-hover:text-accent transition-colors">{s.name}</span>
                    {s.category && <span className="font-mono text-[8px] text-ink/40 block">{s.category}</span>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setShowSupplierPicker(false); setPendingWeightData(null); }}
                className="w-full py-2 font-mono text-[8px] opacity-40 hover:opacity-80 uppercase tracking-widest rounded transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weight Entry Modal */}
      {weightModalCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setWeightModalCat(null)}>
          <div className="bg-surface border border-ink-faint rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">{weightModalCat}</span>
                <button type="button" onClick={() => setWeightModalCat(null)} className="opacity-40 hover:opacity-100 transition-opacity">
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
                    <span className="font-mono text-sm font-bold text-ink">Rs. {getEstimatedRateForCategory(weightModalCat!).toLocaleString()}/KG</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-ink-faint/40 pt-2">
                    <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">Total Raqam</span>
                    <span className="font-display text-xl font-black text-accent">Rs. {(parseFloat(weightModalWeight) * getEstimatedRateForCategory(weightModalCat!)).toLocaleString()}</span>
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
                    if (!selectedSupplierId || selectedSupplierId === "All") {
                      setPendingWeightData({ cat: weightModalCat, weight: w });
                      setWeightModalCat(null);
                      setWeightModalWeight("");
                      setShowSupplierPicker(true);
                      return;
                    }
                    setWeightModalSaving(true);
                    try {
                      const rate = getEstimatedRateForCategory(weightModalCat);
                      await onAddLog({
                        date: new Date().toISOString().split("T")[0],
                        weightKg: w,
                        supplyRatePerKg: rate,
                        totalCost: w * rate,
                        supplierId: isSelfPurchase ? "" : selectedSupplierId,
                        notes: isSelfPurchase ? "Self Purchase (Owner)" : "",
                        category: weightModalCat,
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
