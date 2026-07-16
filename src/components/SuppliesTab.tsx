import React, { useState, useEffect } from "react";
import { FormulaSettings, SupplyLog, Supplier } from "../types";
import { Plus, Trash2, Calendar, Weight, DollarSign, Tag, RefreshCw, Layers, Filter, Sparkles, CheckCircle2, Users, Package, ChevronDown, ChevronUp, Flame, ShoppingCart } from "lucide-react";
import { evaluate } from "mathjs";

interface SuppliesTabProps {
  settings: FormulaSettings;
  supplyLogs: SupplyLog[];
  suppliers: Supplier[];
  onAddLog: (log: Omit<SupplyLog, "id">) => Promise<string>;
  onUpdateLog: (id: string, log: Partial<SupplyLog>) => Promise<void>;
  onDeleteLog: (id: string) => Promise<void>;
  onSaveSettings: (settings: FormulaSettings) => Promise<void>;
  onNavigateToSales?: () => void;
}

export default function SuppliesTab({ settings, supplyLogs, suppliers, onAddLog, onUpdateLog, onDeleteLog, onSaveSettings, onNavigateToSales }: SuppliesTabProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [weightKg, setWeightKg] = useState<string>("");

  // Only categories that are added in settings, plus the default Whole Chicken (avoiding duplicates)
  const uniqueCategories = Array.from(
    new Set([
      "Whole Chicken",
      "Chest / Boneless",
      "Leg / Thigh",
      "Wings",
      "Wings V",
      ...Object.values(settings.items || {})
        .filter(it => it.name && it.name.trim() !== "")
        .map(it => it.name),
      ...supplyLogs.map((log) => log.category).filter(Boolean),
    ])
  );

  const [category, setCategory] = useState<string>("Whole Chicken");
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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [extraNotes, setExtraNotes] = useState("");

  // New multi-category inputs
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");

  // Supplier filter state
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>("All");

  // Edit state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedLogIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedLogIds(newSet);
  };

  // Helper to extract supplier name from a combined notes field
  const getSupplierNameFromNotes = (notesStr: string) => {
    const note = notesStr?.trim() || "";
    if (!note) return "Zeeshan Broiler";
    if (note.includes("(")) {
      const part = note.split("(")[0].trim();
      if (part) return part;
    }
    if (note.includes(",")) {
      const part = note.split(",")[0].trim();
      if (part) return part;
    }
    if (note.includes(":")) {
      const part = note.split(":")[0].trim();
      if (part) return part;
    }
    return note;
  };

  // Helper to extract extra details from combined notes
  const getExtraDetailsFromNotes = (notesStr: string) => {
    const note = notesStr?.trim() || "";
    if (note.includes("(")) {
      const match = note.match(/\(([^)]+)\)/);
      if (match) return match[1];
    }
    if (note.includes(",")) {
      const parts = note.split(",");
      if (parts.length > 1) return parts.slice(1).join(",").trim();
    }
    return "";
  };

  // Dynamically extract unique suppliers from existing supply logs AND registered suppliers to populate dropdown
  const uniqueSuppliers = Array.from(
    new Set([
      "Zeeshan Broiler",
      "Sajid Poultry",
      ...suppliers.map(s => s.name),
      ...supplyLogs.map((log) => getSupplierNameFromNotes(log.notes)),
    ])
  ).filter(Boolean);

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
      case "Whole Chicken":
        return base;
      case "Chest / Boneless":
        return Math.round(base * (settings.items.boneless?.multiplier || 1.4));
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

  const handleSupplierChange = (selectedSupId: string) => {
    setSelectedSupplierId(selectedSupId);
  };

  const startEditingLog = (log: SupplyLog) => {
    setEditingLogId(log.id);
    setEditWeight(log.weightKg.toString());
    setEditRate(log.supplyRatePerKg.toString());
    setEditDate(log.date);
    setEditSupplierId(log.supplierId || "");
    setEditNotes(log.notes || "");
    setEditCategory(log.category || "Whole Chicken");
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
        supplierId: editSupplierId,
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
      alert("Please select a supplier. If the list is empty, add a supplier in Settings.");
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

  // Filter list of supply logs
  const filteredLogs = supplyLogs.filter((log) => {
    if (selectedSupplierFilter === "All") return true;
    return log.supplierId === selectedSupplierFilter;
  });

  const totalRawWeight = supplyLogs.reduce((sum, log) => sum + log.weightKg, 0);
  const totalRawCost = supplyLogs.reduce((sum, log) => sum + log.totalCost, 0);

  const displayedWeight = filteredLogs.reduce((sum, log) => sum + log.weightKg, 0);
  const displayedCost = filteredLogs.reduce((sum, log) => sum + log.totalCost, 0);

  const colorPalettes = [
    { bg: "from-teal-950/50 via-cyan-950/10 to-emerald-950/30", border: "border-teal-500/30 hover:border-teal-400/60 shadow-[0_4px_20px_rgba(20,184,166,0.1)]", glow: "glow-emerald", labelText: "text-teal-300", accentText: "text-teal-400" },
    { bg: "from-blue-950/50 via-indigo-950/10 to-blue-950/30", border: "border-blue-500/30 hover:border-blue-400/60 shadow-[0_4px_20px_rgba(59,130,246,0.1)]", glow: "glow-blue", labelText: "text-blue-300", accentText: "text-blue-400" },
    { bg: "from-purple-950/50 via-fuchsia-950/10 to-purple-950/30", border: "border-purple-500/30 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(168,85,247,0.1)]", glow: "glow-purple", labelText: "text-purple-300", accentText: "text-purple-400" },
    { bg: "from-amber-950/50 via-orange-950/10 to-amber-950/30", border: "border-amber-500/30 hover:border-amber-400/60 shadow-[0_4px_20px_rgba(245,158,11,0.1)]", glow: "glow-orange", labelText: "text-amber-300", accentText: "text-amber-400" },
    { bg: "from-rose-950/50 via-pink-950/10 to-rose-950/30", border: "border-rose-500/30 hover:border-rose-400/60 shadow-[0_4px_20px_rgba(244,63,94,0.1)]", glow: "glow-rose", labelText: "text-rose-300", accentText: "text-rose-400" },
  ];

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
        <div className="bg-gradient-to-br from-teal-950/50 via-cyan-950/20 to-emerald-900/30 border border-teal-500/35 p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl shadow-[0_8px_30px_rgba(20,184,166,0.12)] hover:border-teal-400/50 transition-all duration-300 glow-emerald">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-teal-300">Raw Stock</span>
            <Weight className="w-3 h-3 sm:w-4 sm:h-4 text-teal-400 animate-pulse" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-teal-100 tracking-tight truncate">
                {displayedWeight.toLocaleString()}
              </span>
              <span className="font-mono text-[7px] sm:text-[10px] font-bold text-teal-300/60 uppercase">KG</span>
            </div>
            {selectedSupplierFilter !== "All" && (
              <span className="font-mono text-[6px] sm:text-[8px] font-bold text-teal-400 uppercase tracking-widest block italic truncate">
                {selectedSupplierFilter}
              </span>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-fuchsia-950/50 via-purple-950/20 to-pink-900/30 border border-fuchsia-500/35 p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl shadow-[0_8px_30px_rgba(217,70,239,0.12)] hover:border-fuchsia-400/50 transition-all duration-300 glow-purple">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-fuchsia-300">Inv. Cost</span>
            <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-fuchsia-400" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className="font-mono text-[7px] sm:text-[10px] font-bold text-fuchsia-400/60 uppercase">Rs.</span>
              <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-fuchsia-100 tracking-tight truncate">
                {displayedCost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-950/50 via-amber-950/20 to-orange-900/30 border border-orange-500/35 p-3 sm:p-5 md:p-6 flex flex-col justify-between h-28 sm:h-32 md:h-36 rounded-2xl shadow-[0_8px_30px_rgba(249,115,22,0.12)] hover:border-orange-400/50 transition-all duration-300 glow-orange">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-orange-300">Market Rate</span>
            <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400 animate-bounce" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <div className="flex items-baseline gap-0.5 sm:gap-2">
              <span className="font-mono text-[7px] sm:text-[10px] font-bold text-orange-400/60 uppercase">Rs.</span>
              <span className="font-display text-xs sm:text-2xl md:text-4xl font-black text-orange-300 tracking-tight italic truncate">
                {settings.baseRawRate}
              </span>
              <span className="font-mono text-[7px] sm:text-[10px] font-bold text-orange-400/60 uppercase truncate">/KG</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        {/* Left pane: Inventory Cards Grid (POS-style) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between gap-8 border-b border-ink-faint pb-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[8px] font-black uppercase tracking-[0.2em] opacity-20 shrink-0">Stock History</span>
              <div className="h-px bg-ink-faint flex-1 min-w-[50px]" />
            </div>

            <select
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              className="bg-transparent border-none p-0 font-mono text-[10px] font-bold uppercase tracking-widest text-accent focus:ring-0 cursor-pointer"
            >
              <option value="All">All Sources</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name.toUpperCase()}
                </option>
              ))}
              {uniqueSuppliers.filter(name => !suppliers.some(s => s.name === name)).map(name => (
                <option key={name} value={name}>
                  {name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-ink-faint rounded">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No inventory logs found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filteredLogs.map((log, idx) => {
                const supplier = suppliers.find(s => s.id === log.supplierId || s.name === log.supplierId);
                const supplierName = supplier?.name || log.supplierId || "Unknown Supplier";
                const isExpanded = expandedLogIds.has(log.id);
                const theme = colorPalettes[idx % colorPalettes.length];
                const catKey = (log.category || "WHOLE CHICKEN").replace(/\s+/g, "_").toUpperCase();

                return (
                  <div
                    key={log.id}
                    onClick={() => editingLogId !== log.id && toggleExpand(log.id)}
                    className={`bg-gradient-to-br ${theme.bg} border ${isExpanded ? theme.border.replace("hover:", "") : "border-ink-faint hover:" + theme.border.split(" ").slice(2).join(" ")} ${theme.glow} p-3 md:p-5 transition-all duration-300 flex flex-col justify-between rounded-2xl group cursor-pointer select-none active:scale-[0.96] relative overflow-hidden`}
                    style={{ minHeight: "130px" }}
                  >
                    {editingLogId === log.id ? (
                      <form 
                        onSubmit={handleUpdateLogSubmit} 
                        className="space-y-3 animate-fade-in relative z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className={`font-mono text-[8px] font-bold uppercase tracking-widest ${theme.labelText}`}>Edit Entry</span>
                        <div className="space-y-2">
                          <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Weight (KG)</span>
                          <input 
                            type="number" step="0.01"
                            value={editWeight} 
                            onChange={e => setEditWeight(e.target.value)}
                            className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Supplier</span>
                          <select 
                            value={editSupplierId} 
                            onChange={e => setEditSupplierId(e.target.value)}
                            className="w-full bg-bg/80 border border-ink-faint rounded px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                          >
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); cancelEditingLog(); }}
                            className="font-mono text-[8px] uppercase tracking-widest opacity-40 hover:opacity-80"
                          >Cancel</button>
                          <button type="submit"
                            className={`font-mono text-[8px] font-bold uppercase tracking-widest ${theme.accentText} border-b border-current`}
                          >Save</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between relative z-10">
                          <span className={`font-mono text-[7px] md:text-[8px] font-black uppercase tracking-widest ${theme.labelText} opacity-80`}>
                            {catKey}
                          </span>
                          <div className="flex items-center gap-2">
                            {!isExpanded && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); startEditingLog(log); }}
                                  className={`${theme.accentText} opacity-0 group-hover:opacity-60 hover:opacity-100 transition-all p-0.5`}
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
                          <span className="block font-display text-xs md:text-sm uppercase leading-tight tracking-tight text-white/90 truncate">
                            {supplierName}
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className={`font-mono text-[11px] md:text-sm font-black leading-none text-white`}>{log.weightKg}</span>
                            <span className={`font-mono text-[7px] font-bold uppercase ${theme.labelText} opacity-60`}>KG</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-baseline gap-1">
                            <span className={`font-mono text-[7px] font-bold uppercase ${theme.accentText}`}>Rs.</span>
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
                                <span className={`font-mono text-[6px] font-bold uppercase tracking-widest block ${theme.labelText} opacity-60`}>Date</span>
                                <span className="font-mono text-[10px] text-white/80">
                                  {new Date(log.date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                              </div>
                              <div>
                                <span className={`font-mono text-[6px] font-bold uppercase tracking-widest block ${theme.labelText} opacity-60`}>Rate</span>
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

        {/* Right pane: Add Stock Form (POS-style sticky panel) */}
        <div className="lg:col-span-4">
          <div className="bg-gradient-to-br from-cyan-950/40 via-teal-950/10 to-emerald-950/30 border border-teal-500/35 p-5 md:p-6 sticky top-12 space-y-5 rounded-2xl glow-emerald shadow-xl">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-300 font-bold">Add Stock</span>
              <Package className="w-4 h-4 text-teal-400" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Entry Date</span>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none" />
              </div>

              <div className="space-y-2">
                <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Supplier Source</span>
                <select value={selectedSupplierId} onChange={(e) => handleSupplierChange(e.target.value)}
                  className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none cursor-pointer">
                  <option value="">-- SELECT SOURCE --</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>{sup.name.toUpperCase()}</option>
                  ))}
                  {uniqueSuppliers.filter(name => !suppliers.some(s => s.name === name)).map(name => (
                    <option key={name} value={name}>{name.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Stock Category</span>
                {isNewCategory ? (
                  <div className="animate-fade-in">
                    <input type="text" required placeholder="CATEGORY_NAME" value={customCategoryName}
                      onChange={(e) => { setCustomCategoryName(e.target.value); setCategory(e.target.value); }}
                      className="w-full bg-bg/80 border border-accent/20 rounded px-3 py-2 font-mono text-xs text-accent outline-none appearance-none" />
                    <button type="button" onClick={() => { setIsNewCategory(false); setCategory(uniqueCategories[0] || ""); }}
                      className="font-mono text-[7px] text-rose-400/60 hover:text-rose-400 mt-1 uppercase tracking-widest">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
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
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`bg-gradient-to-br ${ct.bg} border ${isSelected ? ct.selected : ct.border} p-2 rounded-lg text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] cursor-pointer ${isSelected ? "scale-[1.02]" : "opacity-70 hover:opacity-100"}`}
                          >
                            <span className={`font-mono text-[6px] font-bold uppercase tracking-widest block ${ct.text}`}>{cat.toUpperCase()}</span>
                            <span className="font-mono text-[8px] font-black text-white leading-none">Rs.{estimatedRate}<span className="text-[6px] font-normal opacity-50">/KG</span></span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setIsNewCategory(true)}
                        className="bg-bg/40 border border-dashed border-ink-faint p-2 rounded-lg text-center transition-all hover:border-accent/40 hover:bg-accent/5 cursor-pointer flex flex-col items-center justify-center"
                      >
                        <span className="font-mono text-[14px] font-bold text-accent/60 leading-none">+</span>
                        <span className="font-mono text-[6px] font-bold uppercase tracking-widest text-accent/40">New</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Net Weight (KG)</span>
                <input type="number" step="0.01" min="0.1" required placeholder="00.00"
                  value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-3 font-mono text-2xl font-bold text-ink focus:ring-1 focus:ring-accent outline-none appearance-none" />
              </div>

              <div className="space-y-2">
                <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">Additional Memo</span>
                <input type="text" placeholder="OPTIONAL_NOTES" value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)}
                  className="w-full bg-bg/80 border border-ink-faint rounded px-3 py-2 font-mono text-[10px] opacity-40 focus:opacity-100 outline-none appearance-none" />
              </div>

              {weightKg && (
                <div className="bg-bg/60 border border-teal-500/20 rounded p-3 space-y-1">
                  <span className="font-mono text-[7px] font-bold opacity-40 uppercase tracking-widest">
                    Valuation (Est. Rs. {getEstimatedRateForCategory(isNewCategory ? customCategoryName : category)}/Kg)
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-[8px] font-bold opacity-40 uppercase">Rs.</span>
                    <span className="font-display text-xl text-ink tracking-tighter">
                      {(parseFloat(weightKg) * getEstimatedRateForCategory(isNewCategory ? customCategoryName : category)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <button type="submit" disabled={saving}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-4 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer shadow-lg shadow-teal-500/20"
              >
                {saving ? "Processing..." : "Commit to Inventory ⚡"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
