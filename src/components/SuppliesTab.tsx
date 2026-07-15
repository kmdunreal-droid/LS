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
        {/* Raw Stock - Ocean / Teal */}
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

        {/* Inv. Cost - Magic Fuchsia / Purple */}
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

        {/* Market Rate - Fire Orange / Amber */}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left pane: Add Supply Form */}
        <div className="lg:col-span-4 space-y-4">


          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[8px] font-black uppercase tracking-[0.2em] opacity-20 shrink-0">Add Stock</span>
              <div className="h-px bg-ink-faint flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 bg-surface border border-ink-faint p-4 rounded">
              <div className="space-y-4">
                {/* Date */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Entry Date</span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                  />
                </div>



                {/* Supplier Selection */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Supplier Source</span>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none cursor-pointer"
                  >
                    <option value="">-- SELECT SOURCE --</option>
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

                {/* Chicken Category */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Stock Category</span>
                  <select
                    value={isNewCategory ? "__CUSTOM_CAT__" : category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none cursor-pointer"
                  >
                    {uniqueCategories.map((cat) => {
                      const estimatedRate = getEstimatedRateForCategory(cat);
                      return (
                        <option key={cat} value={cat}>
                          {cat.toUpperCase()} (RS. {estimatedRate}/KG)
                        </option>
                      );
                    })}
                    <option value="__CUSTOM_CAT__" className="text-accent">+ ADD NEW CATEGORY</option>
                  </select>

                  {isNewCategory && (
                    <div className="pt-4 animate-fade-in">
                      <input
                        type="text"
                        required
                        placeholder="CATEGORY_NAME"
                        value={customCategoryName}
                        onChange={(e) => {
                          setCustomCategoryName(e.target.value);
                          setCategory(e.target.value);
                        }}
                        className="w-full bg-bg border border-accent/20 rounded px-3 py-2 font-mono text-xs text-accent outline-none appearance-none"
                      />
                    </div>
                  )}
                </div>

                {/* Weight */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Net Weight (KG)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    placeholder="00.00"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-3 font-mono text-2xl font-bold text-ink focus:ring-1 focus:ring-accent outline-none appearance-none"
                  />
                </div>

                {/* Extra notes */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Additional Memo</span>
                  <input
                    type="text"
                    placeholder="OPTIONAL_NOTES"
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-[10px] opacity-40 focus:opacity-100 outline-none appearance-none"
                  />
                </div>
              </div>

              {/* Real-time calculated Total */}
              {weightKg && (
                <div className="bg-bg border border-ink-faint rounded p-4 space-y-2">
                  <span className="font-mono text-[8px] font-bold opacity-20 uppercase tracking-widest">
                    Entry Valuation (Est. Rs. {getEstimatedRateForCategory(isNewCategory ? customCategoryName : category)}/Kg)
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] font-bold opacity-30 uppercase">Rs.</span>
                    <span className="font-display text-2xl text-ink tracking-tighter">
                      {(parseFloat(weightKg) * getEstimatedRateForCategory(isNewCategory ? customCategoryName : category)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-accent text-bg py-4 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30"
              >
                {saving ? "Processing..." : "Commit to Inventory"}
              </button>
            </form>
          </div>
        </div>

        {/* Right pane: Supply Logs History */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between gap-8 border-b border-ink-faint pb-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[8px] font-black uppercase tracking-[0.2em] opacity-20 shrink-0">History</span>
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {filteredLogs.map((log) => {
                const supplier = suppliers.find(s => s.id === log.supplierId || s.name === log.supplierId);
                const supplierName = supplier?.name || log.supplierId || "Unknown Supplier";

                const isExpanded = expandedLogIds.has(log.id);

                return (
                  <div
                    key={log.id}
                    onClick={() => editingLogId !== log.id && toggleExpand(log.id)}
                    className={`bg-surface border border-ink-faint rounded transition-all group relative cursor-pointer ${isExpanded ? "p-3 md:p-4 space-y-2 md:space-y-3 border-accent/20" : "p-3 md:p-4 hover:border-accent/10"}`}
                  >
                    {editingLogId === log.id ? (
                      <form 
                        onSubmit={handleUpdateLogSubmit} 
                        className="space-y-4 animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-2">
                          <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Weight (KG)</span>
                          <input 
                            type="number" 
                            step="0.01"
                            value={editWeight} 
                            onChange={e => setEditWeight(e.target.value)}
                            className="w-full bg-bg border border-ink-faint rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Supplier</span>
                          <select 
                            value={editSupplierId} 
                            onChange={e => setEditSupplierId(e.target.value)}
                            className="w-full bg-bg border border-ink-faint rounded px-2 py-1.5 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                          >
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center justify-end gap-4 pt-2">
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEditingLog();
                            }}
                            className="font-mono text-[9px] uppercase tracking-widest opacity-20 hover:opacity-50"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            className="font-mono text-[9px] font-bold uppercase tracking-widest text-accent"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    ) : isExpanded ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] font-bold opacity-20 uppercase">
                            {new Date(log.date).toLocaleDateString("en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingLog(log);
                              }}
                              className="text-accent opacity-30 hover:opacity-100 transition-colors p-1"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Are you sure you want to delete this supply record?")) {
                                  onDeleteLog(log.id);
                                }
                              }}
                              className="text-accent opacity-30 hover:opacity-100 transition-colors p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="font-mono text-[9px] font-bold opacity-20 uppercase tracking-widest block italic leading-none">
                            {log.category || "WHOLE CHICKEN"}
                          </span>
                          <span className="font-display text-base md:text-lg uppercase text-ink leading-tight block">
                            {supplierName}
                          </span>
                        </div>

                        <div className="border-t border-ink-faint pt-4">
                          <div className="space-y-1">
                            <span className="font-mono text-[7px] font-bold opacity-30 uppercase tracking-widest">Weight</span>
                            <div className="flex items-baseline gap-1">
                              <span className="font-mono text-sm md:text-base font-bold text-ink tracking-tight">{log.weightKg}</span>
                              <span className="font-mono text-[8px] font-bold opacity-30 uppercase">KG</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-bg border border-ink-faint p-3 flex items-center justify-between rounded">
                          <span className="font-mono text-[7px] font-bold opacity-20 uppercase tracking-widest">Total Cost</span>
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono text-[8px] font-bold opacity-30 uppercase">Rs.</span>
                            <span className="font-display text-base md:text-lg text-ink tracking-tighter">
                              {log.totalCost.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {log.notes && (
                          <p className="font-mono text-[8px] opacity-20 uppercase italic leading-relaxed truncate">
                            {log.notes}
                          </p>
                        )}
                        
                        <div className="text-center pt-2">
                          <span className="font-mono text-[7px] font-bold opacity-10 uppercase tracking-widest">Click to collapse</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="block font-display text-[10px] md:text-xs uppercase tracking-widest text-ink truncate">
                            {supplierName}
                          </span>
                          <span className="block font-mono text-[8px] opacity-20 uppercase tracking-tighter">
                            {new Date(log.date).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block font-display text-xs md:text-sm text-accent tracking-tighter">
                            Rs. {log.totalCost.toLocaleString()}
                          </span>
                          <span className="block font-mono text-[7px] opacity-10 uppercase tracking-[0.2em] italic">Details</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
