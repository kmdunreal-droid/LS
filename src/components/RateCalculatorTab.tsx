import React, { useState } from "react";
import { FormulaSettings, ItemFormula } from "../types";
import { Coins, HelpCircle, Save, Percent, Sparkles, RefreshCw, KeyRound, Trash2, Plus, Calculator, Info } from "lucide-react";
import { evaluate } from "mathjs";

interface RateCalculatorTabProps {
  settings: FormulaSettings;
  onSaveSettings: (settings: FormulaSettings) => Promise<void>;
}

export default function RateCalculatorTab({ settings, onSaveSettings }: RateCalculatorTabProps) {
  const [baseRawRate, setBaseRawRate] = useState<number>(settings.baseRawRate);
  const [items, setItems] = useState<Record<string, ItemFormula>>(settings.items || {});
  const [supplierUsername, setSupplierUsername] = useState<string>(settings.supplierUsername || "zeeshan");
  const [supplierPassword, setSupplierPassword] = useState<string>(settings.supplierPassword || "786");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Add Custom Formula Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFormulaName, setNewFormulaName] = useState("");
  const [newExpression, setNewExpression] = useState<string>("supply * 1.5 + 50");

  // Long press actions for Formula cards
  const [longPressActionItem, setLongPressActionItem] = useState<{ key: string; name: string; expression: string } | null>(null);
  const [editingFormulaItem, setEditingFormulaItem] = useState<{ key: string; name: string; expression: string } | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemExpression, setEditItemExpression] = useState("");
  const longPressTimeoutRef = React.useRef<any>(null);
  const isLongPressRef = React.useRef<boolean>(false);

  const handleButtonPressStart = (key: string, item: ItemFormula) => {
    isLongPressRef.current = false;
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setLongPressActionItem({
        key,
        name: item.name,
        expression: item.expression || `supply * ${item.multiplier || 1} + ${item.markup || 0}`,
      });
    }, 1500); // Hold for 1.5s
  };

  const handleButtonPressEnd = (e: React.MouseEvent | React.TouchEvent, key: string, item: ItemFormula) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleButtonPressCancel = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleDeleteItem = (key: string) => {
    if (confirm(`Kya aap waqai "${items[key]?.name || key}" formula ko delete karna chahte hain?`)) {
      setItems((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      setLongPressActionItem(null);
    }
  };

  const handleAddFormulaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormulaName.trim()) {
      alert("Formula ka naam likhein!");
      return;
    }

    if (!newExpression.trim()) {
      alert("Formula expression likhein!");
      return;
    }

    // Basic validation of expression
    try {
      evaluate(newExpression.toLowerCase().replace(/supply/g, "100"));
    } catch (err) {
      alert("Formula sahi nahi hai. Bara-e-maherbani check karein. Example: supply * 1.5 + 50");
      return;
    }

    // Generate clean unique snake_case key
    const cleanName = newFormulaName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const uniqueKey = `${cleanName}_${Date.now().toString().slice(-4)}`;

    setItems((prev) => ({
      ...prev,
      [uniqueKey]: {
        name: newFormulaName.trim(),
        expression: newExpression.trim(),
      },
    }));

    setNewFormulaName("");
    setNewExpression("supply * 1.5 + 50");
    setShowAddForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await onSaveSettings({
        baseRawRate,
        items,
        supplierUsername,
        supplierPassword,
      });
      setMessage("Formula aur rates kamyabi se save ho gaye hain! (Successfully Saved!)");
      setTimeout(() => setMessage(""), 4000);
    } catch (e) {
      setMessage("Save karne mein masla aaya. Dobara koshish karein.");
    } finally {
      setSaving(false);
    }
  };

  const isFormulaValid = (expressionStr: string | undefined, testSupply: number = 100): boolean => {
    if (!expressionStr) return true; // Legacy fallback is always valid
    try {
      const cleanExpression = expressionStr.toLowerCase().replace(/supply/g, testSupply.toString());
      const result = evaluate(cleanExpression);
      return typeof result === "number" && !isNaN(result) && isFinite(result);
    } catch (e) {
      return false;
    }
  };

  const calculatePrice = (formula: ItemFormula, supply: number) => {
    try {
      if (formula.expression) {
        // Replace 'supply' (case-insensitive) with the actual value
        const cleanExpression = formula.expression.toLowerCase().replace(/supply/g, supply.toString());
        const result = evaluate(cleanExpression);
        return Math.round(Number(result));
      } else if (formula.multiplier !== undefined && formula.markup !== undefined) {
        // Fallback for legacy data
        return Math.round((supply * formula.multiplier) + formula.markup);
      }
      return 0;
    } catch (err) {
      console.error("Evaluation error:", err);
      return 0;
    }
  };

  return (
    <div id="rate-calculator-tab" className="space-y-3 md:space-y-4 animate-fade-in max-w-full">
      <div className="flex items-center justify-between border-b border-ink-faint pb-2.5">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-accent/5 text-accent rounded">
            <Calculator className="w-4.5 h-4.5" />
          </div>
          <div className="space-y-0.5">
            <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest leading-none">Pricing Setup</span>
            <h2 className="font-display text-sm md:text-base uppercase tracking-tight font-bold">Formulas & Rates</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-accent text-bg px-2.5 py-1.2 rounded font-mono font-bold text-[9px] uppercase tracking-widest flex items-center gap-1 hover:brightness-110 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New Formula
        </button>
      </div>

      {/* Add New Formula Panel */}
      {showAddForm && (() => {
        const isNewFormulaValid = isFormulaValid(newExpression, baseRawRate);
        return (
          <div className={`bg-surface border p-3 rounded-xl space-y-3 animate-fade-in ${isNewFormulaValid ? "border-ink-faint" : "border-ink-faint"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-1">
                <Sparkles className={`w-3.5 h-3.5 ${isNewFormulaValid ? "text-ink/70" : "text-ink/50"}`} />
                Add New Formula Item
              </h3>
              <div className="text-[8px] font-mono opacity-40 italic">
                * Use the word "supply" in your formula expression (e.g., supply * 1.8 + 100)
              </div>
            </div>
            <form onSubmit={handleAddFormulaSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              <div className="md:col-span-4">
                <label className="block font-mono text-[8px] opacity-40 mb-1 uppercase tracking-widest">
                  Item / Formula Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Malai Boti"
                  value={newFormulaName}
                  onChange={(e) => setNewFormulaName(e.target.value)}
                  className="w-full bg-bg border border-ink-faint rounded-lg px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block font-mono text-[8px] opacity-40 mb-1 uppercase tracking-widest">
                  Math Formula (Expression)
                </label>
                <input
                  type="text"
                  required
                  placeholder="supply * 1.8 + 120"
                  value={newExpression}
                  onChange={(e) => setNewExpression(e.target.value)}
                  className={`w-full bg-bg border rounded-lg px-3 py-2 font-mono text-xs focus:ring-1 outline-none appearance-none font-bold ${
                    isNewFormulaValid
                      ? "border-ink-faint text-ink/70 focus:ring-accent"
                      : "border-ink-faint text-ink/50 focus:ring-accent"
                  }`}
                />
                <div className="mt-1 flex items-center justify-between text-[8px] font-mono">
                  <span className={isNewFormulaValid ? "text-ink/70 font-bold" : "text-ink/50 font-bold"}>
                    {isNewFormulaValid ? "✓ Valid Formula" : "✗ Invalid Formula"}
                  </span>
                  {isNewFormulaValid && (
                    <span className="opacity-50 text-ink">
                      Est. Price: Rs. {calculatePrice({ name: "Temp", expression: newExpression }, baseRawRate)}
                    </span>
                  )}
                </div>
              </div>
              <div className="md:col-span-3 flex gap-2">
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg font-mono font-bold text-[9px] uppercase tracking-widest cursor-pointer text-bg ${isNewFormulaValid ? "bg-accent hover:brightness-110" : "bg-ink-faint hover:brightness-110"}`}
                >
                  Add Formula
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-bg text-ink/40 px-3 py-2 rounded-lg font-mono text-[9px] uppercase tracking-widest hover:text-ink/75 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      <form onSubmit={handleSave} className="space-y-3">
        {/* Base Rate Input */}
        <div className="bg-surface border border-ink-faint rounded-xl p-3 md:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <label htmlFor="base-rate" className="block font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-accent">
                Raw Chicken Base Supply Rate (Rs. per Kg)
              </label>
              <p className="font-mono text-[8px] opacity-40 tracking-widest mt-0.5">Enter the supplier's raw chicken rate here, which will substitute "supply" in formulas.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-sm opacity-30">Rs.</span>
              <input
                id="base-rate"
                type="number"
                min="1"
                required
                value={baseRawRate}
                onChange={(e) => setBaseRawRate(Number(e.target.value))}
                className="w-full bg-bg border border-ink-faint rounded-xl pl-12 pr-4 py-2.5 font-mono text-2xl font-bold text-accent focus:ring-1 focus:ring-accent outline-none appearance-none shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-faint pb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 shrink-0">Menu Item Formulas</span>
          <span className="font-mono text-[8px] md:text-[9px] text-accent/80 bg-accent/5 px-2 py-0.5 rounded italic flex items-center gap-1 self-start sm:self-auto">
            💡 Tip: Long press any formula card for 2 seconds to edit or delete it.
          </span>
        </div>

        {/* Formulas Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
          {Object.keys(items).map((key) => {
            const item = items[key];
            if (!item) return null;
            const isValid = isFormulaValid(item.expression, baseRawRate);
            const salePrice = calculatePrice(item, baseRawRate);

            return (
              <div 
                key={key} 
                onMouseDown={() => handleButtonPressStart(key, item)}
                onMouseUp={(e) => handleButtonPressEnd(e, key, item)}
                onMouseLeave={handleButtonPressCancel}
                onTouchStart={() => handleButtonPressStart(key, item)}
                onTouchEnd={(e) => handleButtonPressEnd(e, key, item)}
                className={`border rounded-2xl p-4 transition-all duration-300 space-y-3.5 relative group shadow-lg flex flex-col justify-between select-none active:scale-[0.97] cursor-pointer ${
                  isValid 
                    ? "bg-surface border-ink-faint text-ink/70" 
                    : "bg-surface border-ink-faint text-ink/50"
                }`}
                style={{ WebkitTouchCallout: "none", userSelect: "none" }}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-ink-faint pb-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isValid ? "bg-accent" : "bg-ink-faint"}`} title={isValid ? "Formula Valid" : "Formula Invalid"} />
                    <span className="font-display text-xs md:text-sm font-bold uppercase text-ink truncate flex-1">
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">Sale Price:</span>
                    <span className={`font-mono text-sm md:text-lg font-bold tracking-tight ${isValid ? "text-ink/70" : "text-ink/50"}`}>
                      {isValid ? `Rs. ${salePrice}` : "Error"}
                    </span>
                  </div>

                  {/* Expression Display */}
                  <div className="space-y-1">
                    <label className="block font-mono text-[7px] md:text-[8px] opacity-40 uppercase tracking-widest">
                      Formula (Hisaab)
                    </label>
                    <div className={`w-full bg-bg/50 border rounded-lg px-2.5 py-1.5 font-mono text-[10px] md:text-xs font-bold truncate ${
                      isValid ? "border-ink-faint text-ink/70" : "border-ink-faint text-ink/50"
                    }`}>
                      {item.expression || `supply * ${item.multiplier || 1} + ${item.markup || 0}`}
                    </div>
                  </div>
                </div>

                {/* Formula preview */}
                <div className={`font-mono text-[7px] md:text-[8px] bg-bg/50 px-2 py-1 rounded-md flex justify-between items-center italic truncate ${
                  isValid ? "opacity-45 text-ink/70" : "opacity-90 text-ink/50 font-bold"
                }`}>
                  <span className="truncate">
                    {isValid 
                      ? `Eval: ${item.expression ? item.expression.replace(/supply/g, baseRawRate.toString()) : `(${baseRawRate}×${item.multiplier})+${item.markup}`}`
                      : "Ghalt Formula! Check syntax."
                    }
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface border border-ink-faint rounded-xl p-2.5">
          <div className="font-mono text-[8px] md:text-[9px] opacity-55 italic">
            {message ? (
              <span className="text-ink/70 font-bold">{message}</span>
            ) : (
              <span>* Naye rates live POS aur sales calculations mein foran apply ho jayein ge.</span>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-accent text-bg px-5 py-2.5 rounded-xl font-mono font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:brightness-110 transition-all cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Formulas & Sync
              </>
            )}
          </button>
        </div>
      </form>

      {/* Held Option Modal */}
      {longPressActionItem && (
        <div className="fixed inset-0 bg-bg/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-accent/30 rounded-2xl p-6 max-w-sm w-full space-y-6 shadow-2xl relative">
            <div className="space-y-2 text-center">
              <span className="font-mono text-[9px] text-accent font-bold uppercase tracking-[0.2em] block">
                Formula Options
              </span>
              <h3 className="font-display text-base md:text-lg text-ink font-bold">
                {longPressActionItem.name}
              </h3>
              <p className="font-mono text-[10px] opacity-45">
                Formula: {longPressActionItem.expression}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setEditingFormulaItem(longPressActionItem);
                  setEditItemName(longPressActionItem.name);
                  setEditItemExpression(longPressActionItem.expression);
                  setLongPressActionItem(null);
                }}
                className="w-full bg-accent/10 border border-accent/20 hover:bg-accent hover:text-bg text-accent transition-all duration-200 py-3.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Edit Formula
              </button>

              <button
                type="button"
                onClick={() => handleDeleteItem(longPressActionItem.key)}
                className="w-full bg-ink-faint/10 border border-ink-faint hover:bg-ink-faint hover:text-ink text-ink/50 transition-all duration-200 py-3.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete Formula
              </button>

              <button
                type="button"
                onClick={() => setLongPressActionItem(null)}
                className="w-full bg-bg border border-ink-faint hover:text-accent transition-all duration-200 py-3 rounded-xl font-mono text-xs uppercase tracking-widest cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Formula Modal */}
      {editingFormulaItem && (
        <div className="fixed inset-0 bg-bg/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-accent/30 rounded-2xl p-6 max-w-md w-full space-y-6 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-ink-faint pb-4">
              <div className="p-2.5 bg-accent/10 text-accent rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-sm md:text-base uppercase tracking-tight text-accent">
                  Edit Formula
                </h3>
                <p className="font-mono text-[9px] opacity-40 uppercase tracking-widest">
                  Key: {editingFormulaItem.key}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[8px] opacity-40 mb-1 uppercase tracking-widest">
                  Formula / Item Name
                </label>
                <input
                  type="text"
                  required
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full bg-bg border border-ink-faint rounded-xl px-4 py-2.5 font-mono text-xs focus:ring-1 focus:ring-accent outline-none appearance-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-mono text-[8px] opacity-40 uppercase tracking-widest">
                    Formula Expression (Hisaab)
                  </label>
                  <span className="font-mono text-[7px] opacity-30">Use "supply" as variable</span>
                </div>
                {(() => {
                  const isEditFormulaValid = isFormulaValid(editItemExpression, baseRawRate);
                  return (
                    <div className="space-y-4">
                      <input
                        type="text"
                        required
                        value={editItemExpression}
                        onChange={(e) => setEditItemExpression(e.target.value)}
                        className={`w-full bg-bg border rounded-xl px-4 py-2.5 font-mono text-xs font-bold focus:ring-1 outline-none appearance-none ${
                          isEditFormulaValid 
                            ? "border-ink-faint text-ink/70 focus:ring-accent" 
                            : "border-ink-faint text-ink/50 focus:ring-accent"
                        }`}
                        placeholder="e.g. supply * 1.5 + 50"
                      />

                      {/* Preview calculation */}
                      <div className={`border rounded-xl p-4 font-mono text-xs space-y-1.5 transition-all ${
                        isEditFormulaValid 
                          ? "bg-ink-faint/10 border-ink-faint text-ink/70" 
                          : "bg-ink-faint/10 border-ink-faint text-ink/50"
                      }`}>
                        <span className="text-[8px] opacity-40 uppercase tracking-widest block font-bold">Rate Preview</span>
                        <div className="flex justify-between items-center text-ink/70">
                          <span className="opacity-50">Base Raw Rate:</span>
                          <span className="font-bold">Rs. {baseRawRate}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-dashed border-ink-faint pt-2 mt-2">
                          <span className="opacity-50 text-ink/70">Calculated Sale Price:</span>
                          <span className={`font-bold text-sm ${isEditFormulaValid ? "text-ink/70" : "text-ink/50"}`}>
                            {(() => {
                              try {
                                const clean = editItemExpression.toLowerCase().replace(/supply/g, baseRawRate.toString());
                                const res = evaluate(clean);
                                return isNaN(Number(res)) ? "Error" : `Rs. ${Math.round(Number(res))}`;
                              } catch (e) {
                                return "Invalid Formula";
                              }
                            })()}
                          </span>
                        </div>
                        <div className="text-[8px] font-bold italic pt-1 flex justify-between">
                          <span>{isEditFormulaValid ? "✓ Valid Formula" : "✗ Invalid Formula! Check syntax."}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!editItemName.trim()) {
                    alert("Please enter a name.");
                    return;
                  }
                  if (!editItemExpression.trim()) {
                    alert("Please enter a formula expression.");
                    return;
                  }
                  try {
                    evaluate(editItemExpression.toLowerCase().replace(/supply/g, "100"));
                  } catch (e) {
                    alert("Invalid formula. Please check the syntax.");
                    return;
                  }

                  setItems((prev) => ({
                    ...prev,
                    [editingFormulaItem.key]: {
                      name: editItemName.trim(),
                      expression: editItemExpression.trim(),
                    },
                  }));
                  setEditingFormulaItem(null);
                }}
                className="flex-1 bg-accent text-bg py-3 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer text-center"
              >
                Update Formula
              </button>
              <button
                type="button"
                onClick={() => setEditingFormulaItem(null)}
                className="px-4 bg-bg border border-ink-faint rounded-xl font-mono text-[10px] uppercase tracking-widest hover:text-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
