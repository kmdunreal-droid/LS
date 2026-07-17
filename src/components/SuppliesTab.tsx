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

  // New multi-supplier inputs
  const [extraNotes, setExtraNotes] = useState("");

  // Weight entry popup state
  const [weightModalCat, setWeightModalCat] = useState<string | null>(null);
  const [weightModalWeight, setWeightModalWeight] = useState("");
  const [weightModalSaving, setWeightModalSaving] = useState(false);

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

    if (!selectedSupplierId) {
      alert("Please select a supplier from the Dashboard first.");
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
        supplierId: selectedSupplierId,
        notes: extraNotes.trim(),
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
      <div className="bg-surface border border-ink-faint p-5 md:p-6 space-y-5 rounded-2xl">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-300 font-bold">Add Stock</span>
          <Package className="w-4 h-4 text-teal-400" />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Entry Date</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none" />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Stock Category</span>
            {isNewCategory ? (
              <div className="animate-fade-in">
                <input type="text" required placeholder="CATEGORY_NAME" value={customCategoryName}
                  onChange={(e) => { setCustomCategoryName(e.target.value); setCategory(e.target.value); }}
                  className="w-full bg-bg/80 border border-accent/20 rounded px-3 py-2 font-mono text-xs text-accent outline-none appearance-none" />
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => { setWeightModalCat(customCategoryName.trim()); setWeightModalWeight(""); }}
                    disabled={!customCategoryName.trim()}
                    className="flex-1 bg-accent text-bg rounded-lg px-3 py-2 font-mono text-[8px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer"
                  >Add Weight →</button>
                  <button type="button" onClick={() => { setIsNewCategory(false); setCategory(uniqueCategories[0] || ""); }}
                    className="font-mono text-[7px] text-rose-400/60 hover:text-rose-400 uppercase tracking-widest"
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {uniqueCategories.map((cat) => {
                    const estimatedRate = getEstimatedRateForCategory(cat);
                    const isSelected = category === cat;
                    const colorIdx = uniqueCategories.indexOf(cat) % 5;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setWeightModalCat(cat); setWeightModalWeight(""); }}
                        className={`bg-surface border ${isSelected ? "border-accent ring-2 ring-accent/20" : "border-ink-faint hover:border-ink/40"} p-3 md:p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] cursor-pointer ${isSelected ? "scale-[1.02]" : "opacity-70 hover:opacity-100"}`}
                      >
                        <span className="font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-widest block text-ink/70 mb-1">{cat.toUpperCase()}</span>
                        <span className="font-mono text-[11px] md:text-sm font-black text-ink leading-none">Rs.{estimatedRate}<span className="text-[8px] font-normal opacity-50">/KG</span></span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsNewCategory(true)}
                    className="bg-bg/40 border border-dashed border-ink-faint p-3 md:p-4 rounded-xl text-center transition-all hover:border-accent/40 hover:bg-accent/5 cursor-pointer flex flex-col items-center justify-center min-h-[72px]"
                  >
                    <span className="font-mono text-[18px] font-bold text-accent/60 leading-none">+</span>
                    <span className="font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-accent/40">New</span>
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
          <div className="py-12 text-center border border-dashed border-ink-faint rounded">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No inventory logs found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {supplyLogs.map((log, idx) => {
              const isExpanded = expandedLogIds.has(log.id);
              const theme = cardTheme;
              const catKey = (log.category || "WHOLE CHICKEN").replace(/\s+/g, "_").toUpperCase();

              return (
                <div
                  key={log.id}
                  onClick={() => editingLogId !== log.id && toggleExpand(log.id)}
                  className={`bg-surface border ${isExpanded ? "border-ink/30" : "border-ink-faint hover:border-ink/30"} p-3 md:p-5 transition-all duration-300 flex flex-col justify-between rounded-2xl group cursor-pointer select-none active:scale-[0.96] relative overflow-hidden`}
                  style={{ minHeight: "130px" }}
                >
                  {editingLogId === log.id ? (
                    <form 
                      onSubmit={handleUpdateLogSubmit} 
                      className="space-y-3 animate-fade-in relative z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/70">Edit Entry</span>
                      <div className="space-y-2">
                        <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Weight (KG)</span>
                        <input 
                          type="number" step="0.01"
                          value={editWeight} 
                          onChange={e => setEditWeight(e.target.value)}
                          className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-3 pt-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); cancelEditingLog(); }}
                          className="font-mono text-[8px] uppercase tracking-widest opacity-40 hover:opacity-80"
                        >Cancel</button>
                        <button type="submit"
                          className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink/50 border-b border-current"
                        >Save</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between relative z-10">
                        <span className={`font-mono text-[7px] md:text-[8px] font-black uppercase tracking-widest text-ink/70 opacity-80`}>
                          {catKey}
                        </span>
                        <div className="flex items-center gap-2">
                          {!isExpanded && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); startEditingLog(log); }}
                                className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-all p-0.5 text-ink/50"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); if (confirm("Delete this supply record?")) onDeleteLog(log.id); }}
                                className="text-rose-400 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-all p-0.5"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 relative z-10">
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`font-mono text-[11px] md:text-sm font-black leading-none text-white`}>{log.weightKg}</span>
                          <span className={`font-mono text-[7px] font-bold uppercase ${"text-ink/70"} opacity-60`}>KG</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-baseline gap-1">
                          <span className={`font-mono text-[7px] font-bold uppercase ${"text-ink/50"}`}>Rs.</span>
                          <span className="font-mono text-sm md:text-base font-black text-white">{log.totalCost.toLocaleString()}</span>
                        </div>
                        {!isExpanded && (
                          <span className="font-mono text-[6px] opacity-20 uppercase tracking-wider italic group-hover:opacity-40 transition-opacity">Expand</span>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="relative z-10 space-y-3 mt-2 pt-3 border-t border-white/10 animate-fade-in">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className={`font-mono text-[6px] font-bold uppercase tracking-widest block ${"text-ink/70"} opacity-60`}>Date</span>
                              <span className="font-mono text-[10px] text-white/80">
                                {new Date(log.date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <div>
                              <span className={`font-mono text-[6px] font-bold uppercase tracking-widest block ${"text-ink/70"} opacity-60`}>Rate</span>
                              <span className="font-mono text-[10px] text-white/80">Rs. {log.supplyRatePerKg}/KG</span>
                            </div>
                          </div>
                          {log.notes && (
                            <p className="font-mono text-[7px] text-white/30 uppercase italic leading-relaxed">{log.notes}</p>
                          )}
                          <div className="flex items-center justify-center gap-4 pt-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); startEditingLog(log); }}
                              className="font-mono text-[7px] font-bold uppercase tracking-widest text-accent/50 hover:text-accent transition-colors flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (confirm("Delete this supply record?")) onDeleteLog(log.id); }}
                              className="font-mono text-[7px] font-bold uppercase tracking-widest text-rose-400/50 hover:text-rose-400 transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                          <div className="text-center">
                            <span className="font-mono text-[6px] font-bold opacity-20 uppercase tracking-widest">Click to collapse</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                      const rate = getEstimatedRateForCategory(weightModalCat);
                      await onAddLog({
                        date: new Date().toISOString().split("T")[0],
                        weightKg: w,
                        supplyRatePerKg: rate,
                        totalCost: w * rate,
                        supplierId: selectedSupplierId,
                        notes: "",
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
