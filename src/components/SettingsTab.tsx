import React, { useState } from "react";
import { FormulaSettings, Supplier, Order, SupplyLog, SupplierPayment, Expense } from "../types";
import { KeyRound, ShieldCheck, Save, Eye, EyeOff, AlertTriangle, ExternalLink, HelpCircle, Coins, UserPlus, Trash2, Palette, Plus, Layers, X, Flame, Settings, History, CalendarDays, GitBranch, DollarSign, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { SUPPLY_CATEGORIES } from "../constants";
import { Reorder } from "motion/react";
import RateCalculatorTab from "./RateCalculatorTab";
import HistorySection from "./HistorySection";
import ExpensesTab from "./ExpensesTab";

interface SettingsTabProps {
  settings: FormulaSettings;
  suppliers: Supplier[];
  orders: Order[];
  supplyLogs: SupplyLog[];
  payments: SupplierPayment[];
  expenses: Expense[];
  onAddSupplier: (supplier: Omit<Supplier, "id">) => Promise<string>;
  onUpdateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  onDeleteSupplier: (id: string) => Promise<void>;
  onSaveSettings: (settings: FormulaSettings) => Promise<void>;
  onNavigateToSupplierPortal: () => void;
  onAddExpense: (expense: Omit<Expense, "id">) => Promise<string>;
  onUpdateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onResetAllData: () => Promise<void>;
}

export default function SettingsTab({ 
  settings, 
  suppliers, 
  orders, 
  supplyLogs, 
  payments, 
  expenses, 
  onAddSupplier, 
  onUpdateSupplier, 
  onDeleteSupplier, 
  onSaveSettings, 
  onNavigateToSupplierPortal,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onResetAllData
}: SettingsTabProps) {
  const [shopName, setShopName] = useState<string>(settings.shopName || "ZEESHAN TIKKA");
  const [supplierUsername, setSupplierUsername] = useState<string>(settings.supplierUsername || "zeeshan");
  const [supplierPassword, setSupplierPassword] = useState<string>(settings.supplierPassword || "786");
  const [supplierAccessEnabled, setSupplierAccessEnabled] = useState<boolean>(
    settings.supplierAccessEnabled !== false
  );
  const [gitRepositoryUrl, setGitRepositoryUrl] = useState<string>(
    settings.gitRepositoryUrl || "https://github.com/kmdunreal-droid/ladger-chicken.git"
  );
  const [mobileNavItems, setMobileNavItems] = useState<string[]>(
    settings.mobileNavItems?.length ? settings.mobileNavItems : ["dashboard", "pos", "payments", "supplies"]
  );
  const [sidebarNavItems, setSidebarNavItems] = useState<string[]>(() => {
    const saved = settings.sidebarNavItems;
    if (saved?.length) {
      return saved.includes("pos") ? saved : ["pos", ...saved];
    }
    return ["dashboard", "pos", "supplies", "expenses", "payments", "settings"];
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showResetSection, setShowResetSection] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");

  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierUsername, setNewSupplierUsername] = useState("");
  const [newSupplierPassword, setNewSupplierPassword] = useState("");
  const [newSupplierCategory, setNewSupplierCategory] = useState(SUPPLY_CATEGORIES[0]);
  const [addingSupplier, setAddingSupplier] = useState(false);

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showFormulaForm, setShowFormulaForm] = useState(false);
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [showExpensesForm, setShowExpensesForm] = useState(false);

  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSupplierCategory, setEditSupplierCategory] = useState(SUPPLY_CATEGORIES[0]);

  const PRESET_COLORS = ["#f97316", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#22c55e", "#eab308", "#14b8a6"];

  const handleAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim() || !newSupplierUsername.trim() || !newSupplierPassword.trim()) return;

    setAddingSupplier(true);
    // Auto-select a color from presets based on current count
    const autoColor = PRESET_COLORS[suppliers.length % PRESET_COLORS.length];
    
    try {
      await onAddSupplier({
        name: newSupplierName.trim(),
        color: autoColor,
        username: newSupplierUsername.trim().toLowerCase(),
        password: newSupplierPassword.trim(),
        category: newSupplierCategory,
        createdAt: Date.now(),
      });
      setNewSupplierName("");
      setNewSupplierUsername("");
      setNewSupplierPassword("");
      setNewSupplierCategory(SUPPLY_CATEGORIES[0]);
      setShowSupplierForm(false);
    } catch (err) {
      console.error(err);
      alert("An error occurred while adding the supplier.");
    } finally {
      setAddingSupplier(false);
    }
  };

  const startEditing = (s: Supplier) => {
    setEditingSupplierId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
    setEditUsername(s.username || "");
    setEditPassword(s.password || "");
    setEditSupplierCategory(s.category || SUPPLY_CATEGORIES[0]);
  };

  const cancelEditing = () => {
    setEditingSupplierId(null);
    setEditName("");
    setEditColor("");
    setEditUsername("");
    setEditPassword("");
    setEditSupplierCategory(SUPPLY_CATEGORIES[0]);
  };

  const handleUpdateSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplierId || !editName.trim()) return;

    try {
      await onUpdateSupplier(editingSupplierId, {
        name: editName.trim(),
        color: editColor,
        username: editUsername.trim().toLowerCase(),
        password: editPassword.trim(),
        category: editSupplierCategory,
      });
      setEditingSupplierId(null);
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await onSaveSettings({
        ...settings,
        shopName: shopName.trim(),
        supplierUsername: supplierUsername.trim(),
        supplierPassword: supplierPassword.trim(),
        supplierAccessEnabled,
        gitRepositoryUrl: gitRepositoryUrl.trim(),
        mobileNavItems,
        sidebarNavItems,
      });
      setMessage("Settings saved successfully!");
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      console.error(err);
      setMessage("Error! Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="settings-tab-container" className="space-y-4 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-ink-faint/40 pb-3">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-accent/5 text-accent rounded">
            <Settings className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <span className="block font-mono text-[7px] font-bold opacity-30 uppercase tracking-widest leading-tight">System Core</span>
            <h2 className="font-display text-base uppercase tracking-tight">Configuration</h2>
          </div>
        </div>
      </div>

      {/* Quick Actions Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-4">
        <button 
          onClick={() => { setShowSupplierForm(!showSupplierForm); setShowFormulaForm(false); setShowHistoryForm(false); setShowExpensesForm(false); }}
          className={`flex flex-col items-center justify-center gap-2 md:gap-4 p-2.5 md:p-6 bg-surface border transition-all cursor-pointer group rounded ${showSupplierForm ? "border-accent" : "border-ink-faint hover:border-ink-faint/40"}`}
        >
          <div className={`p-2 md:p-3 rounded transition-colors ${showSupplierForm ? "bg-accent text-bg" : "bg-bg text-accent group-hover:bg-accent group-hover:text-bg"}`}>
            <UserPlus className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="text-center space-y-0.5 md:space-y-1">
            <span className="block font-mono text-[6px] md:text-[8px] font-bold uppercase tracking-[0.2em] opacity-35 text-accent">Registry</span>
            <span className="block font-display text-[8px] md:text-sm uppercase tracking-widest truncate w-full px-0.5">Enroll Source</span>
          </div>
        </button>

        <button 
          onClick={() => { setShowFormulaForm(!showFormulaForm); setShowSupplierForm(false); setShowHistoryForm(false); setShowExpensesForm(false); }}
          className={`flex flex-col items-center justify-center gap-2 md:gap-4 p-2.5 md:p-6 bg-surface border transition-all cursor-pointer group rounded ${showFormulaForm ? "border-accent" : "border-ink-faint hover:border-ink-faint/40"}`}
        >
          <div className={`p-2 md:p-3 rounded transition-colors ${showFormulaForm ? "bg-accent text-bg" : "bg-bg text-accent group-hover:bg-accent group-hover:text-bg"}`}>
            <Coins className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="text-center space-y-0.5 md:space-y-1">
            <span className="block font-mono text-[6px] md:text-[8px] font-bold uppercase tracking-[0.2em] opacity-35 text-accent">Economics</span>
            <span className="block font-display text-[8px] md:text-sm uppercase tracking-widest truncate w-full px-0.5">Pricing Model</span>
          </div>
        </button>

        <button 
          onClick={() => { setShowHistoryForm(!showHistoryForm); setShowSupplierForm(false); setShowFormulaForm(false); setShowExpensesForm(false); }}
          className={`flex flex-col items-center justify-center gap-2 md:gap-4 p-2.5 md:p-6 bg-surface border transition-all cursor-pointer group rounded ${showHistoryForm ? "border-accent" : "border-ink-faint hover:border-ink-faint/40"}`}
        >
          <div className={`p-2 md:p-3 rounded transition-colors ${showHistoryForm ? "bg-accent text-bg" : "bg-bg text-accent group-hover:bg-accent group-hover:text-bg"}`}>
            <History className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="text-center space-y-0.5 md:space-y-1">
            <span className="block font-mono text-[6px] md:text-[8px] font-bold uppercase tracking-[0.2em] opacity-35 text-accent">Archive</span>
            <span className="block font-display text-[8px] md:text-sm uppercase tracking-widest truncate w-full px-0.5">Check History</span>
          </div>
        </button>

        <button 
          onClick={() => { setShowFormulaForm(!showFormulaForm); setShowSupplierForm(false); setShowHistoryForm(false); setShowExpensesForm(false); }}
          className={`flex flex-col items-center justify-center gap-2 md:gap-4 p-2.5 md:p-6 bg-surface border transition-all cursor-pointer group rounded ${showFormulaForm ? "border-accent" : "border-ink-faint hover:border-ink-faint/40"}`}
        >
          <div className={`p-2 md:p-3 rounded transition-colors ${showFormulaForm ? "bg-accent text-bg" : "bg-bg text-accent group-hover:bg-accent group-hover:text-bg"}`}>
            <Layers className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="text-center space-y-0.5 md:space-y-1">
            <span className="block font-mono text-[6px] md:text-[8px] font-bold uppercase tracking-[0.2em] opacity-35 text-accent">Categories</span>
            <span className="block font-display text-[8px] md:text-sm uppercase tracking-widest truncate w-full px-0.5">Stock Items</span>
          </div>
        </button>

      </div>

      {/* Conditional Supplier Form */}
      {showSupplierForm && (
        <div className="bg-surface border border-accent/20 p-4 md:p-6 space-y-4 md:space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 relative rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent/40">New Entry</span>
              <h3 className="font-display text-lg md:text-xl uppercase tracking-tight">Establish Source</h3>
            </div>
            <button onClick={() => setShowSupplierForm(false)} className="opacity-10 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
          <form onSubmit={handleAddSupplierSubmit} className="flex flex-col gap-6">
            <input
              type="text"
              required
              autoFocus
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="SOURCE_IDENTIFIER"
              className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-xl font-bold focus:ring-0 uppercase placeholder:opacity-5 appearance-none rounded-none"
            />
            <div className="flex flex-col md:flex-row gap-6">
              <input
                type="text"
                required
                value={newSupplierUsername}
                onChange={(e) => setNewSupplierUsername(e.target.value)}
                placeholder="USERNAME"
                className="flex-1 bg-transparent border-b border-ink-faint p-0 font-mono text-base focus:ring-0 uppercase placeholder:opacity-5 appearance-none rounded-none"
              />
              <input
                type="text"
                required
                value={newSupplierPassword}
                onChange={(e) => setNewSupplierPassword(e.target.value)}
                placeholder="PASSWORD"
                className="flex-1 bg-transparent border-b border-ink-faint p-0 font-mono text-base focus:ring-0 uppercase placeholder:opacity-5 appearance-none rounded-none"
              />
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Supply Category</span>
              <select
                value={newSupplierCategory}
                onChange={(e) => setNewSupplierCategory(e.target.value)}
                className="w-full bg-surface border border-ink-faint px-4 py-3 text-xs cursor-pointer appearance-none uppercase font-mono font-bold tracking-tight rounded outline-none focus:ring-1 focus:ring-accent"
              >
                {SUPPLY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={addingSupplier}
              className="bg-accent text-bg px-8 md:px-12 py-3 md:py-4 font-mono text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 rounded w-full md:w-auto self-end"
            >
              {addingSupplier ? "PROCESSING..." : "REGISTER"}
            </button>
          </form>
        </div>
      )}

      {/* Conditional Formula Section */}
      {showFormulaForm && (
        <div className="bg-surface border border-accent/20 p-4 md:p-6 space-y-4 md:space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent/40">Configuration</span>
              <h3 className="font-display text-lg md:text-xl uppercase tracking-tight">Economic Parameters</h3>
            </div>
            <button onClick={() => setShowFormulaForm(false)} className="opacity-10 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
          <div className="bg-bg p-4 md:p-8 border border-ink-faint rounded">
            <RateCalculatorTab settings={settings} onSaveSettings={onSaveSettings} />
          </div>
        </div>
      )}

      {/* Conditional Expenses Section */}
      {showExpensesForm && (
        <div className="bg-surface border border-accent/20 p-4 md:p-6 space-y-4 md:space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent/40">Configuration</span>
              <h3 className="font-display text-lg md:text-xl uppercase tracking-tight">Daily Expenses (Kharcha)</h3>
            </div>
            <button onClick={() => setShowExpensesForm(false)} className="opacity-10 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
          <div className="bg-bg p-4 md:p-8 border border-ink-faint rounded">
            <ExpensesTab 
              expenses={expenses} 
              onAddExpense={onAddExpense} 
              onUpdateExpense={onUpdateExpense} 
              onDeleteExpense={onDeleteExpense} 
            />
          </div>
        </div>
      )}

      {/* Conditional History Section */}
      {showHistoryForm && (
        <HistorySection 
          orders={orders}
          supplyLogs={supplyLogs}
          payments={payments}
          expenses={expenses}
          suppliers={suppliers}
          onClose={() => setShowHistoryForm(false)}
        />
      )}

      <div className="space-y-4">
        <form onSubmit={handleSave} className="space-y-6 md:space-y-10">
          {/* Shop Identity */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
            <div className="md:col-span-4 space-y-1 md:space-y-2">
              <span className="font-mono text-[8px] md:text-[9px] uppercase tracking-[0.2em] opacity-30">Identity</span>
              <h3 className="font-display text-lg md:text-xl uppercase tracking-widest">Brand Mark</h3>
              <p className="font-mono text-[9px] md:text-[10px] opacity-30 leading-relaxed italic">Identifier for headers and auditing.</p>
            </div>
            <div className="md:col-span-8">
              <input
                id="setting-shop-name"
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="BRAND_NAME"
                className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-xl md:text-3xl font-bold focus:ring-0 uppercase placeholder:opacity-5 appearance-none rounded-none"
              />
            </div>
          </div>

          {/* Access Control */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
            <div className="md:col-span-4 space-y-1 md:space-y-2">
              <span className="font-mono text-[8px] md:text-[9px] uppercase tracking-[0.2em] opacity-30">Security</span>
              <h3 className="font-display text-base md:text-lg uppercase tracking-widest">Access</h3>
              <p className="font-mono text-[9px] md:text-[10px] opacity-30 leading-relaxed italic">Visibility toggle.</p>
            </div>
            <div className="md:col-span-8 space-y-4">
              <div className="flex items-center justify-between gap-8 py-3 border-b border-ink-faint">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] font-bold opacity-50 uppercase tracking-widest">Portal Synchronization</span>
                  <p className="font-mono text-[10px] opacity-20 italic">Enable/disable external entries.</p>
                </div>
                <label htmlFor="supplier-access-toggle" className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    id="supplier-access-toggle"
                    type="checkbox"
                    checked={supplierAccessEnabled}
                    onChange={(e) => setSupplierAccessEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-ink-faint peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-bg after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-ink after:border-ink-faint after:border after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-bg"></div>
                </label>
              </div>

              {supplierAccessEnabled && (
                <div className="grid grid-cols-2 gap-4 md:gap-6 animate-fade-in">
                  <div className="space-y-3">
                    <span className="font-mono text-[7px] md:text-[8px] uppercase tracking-widest opacity-30">Username</span>
                    <input
                      id="setting-supplier-username"
                      type="text"
                      required
                      value={supplierUsername}
                      onChange={(e) => setSupplierUsername(e.target.value)}
                      placeholder="USER_ID"
                      className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-sm md:text-xl font-bold focus:ring-0 uppercase placeholder:opacity-5 appearance-none rounded-none truncate"
                    />
                  </div>
                  <div className="space-y-3">
                    <span className="font-mono text-[7px] md:text-[8px] uppercase tracking-widest opacity-30">Password</span>
                    <div className="relative">
                      <input
                        id="setting-supplier-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={supplierPassword}
                        onChange={(e) => setSupplierPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-sm md:text-xl font-bold focus:ring-0 uppercase placeholder:opacity-5 tracking-[0.2em] appearance-none rounded-none truncate"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 opacity-20 hover:opacity-100 transition-opacity"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}


            </div>
          </div>

          {/* Navigation Menu Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 py-8 border-t border-ink-faint/30">
            <div className="md:col-span-4 space-y-3">
              <div className="flex items-center gap-3 text-accent">
                <Layers className="w-5 h-5" />
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold">Workspace</span>
              </div>
              <h3 className="font-display text-xl uppercase tracking-widest">Menu Manager</h3>
              <p className="font-mono text-[10px] opacity-40 leading-relaxed max-w-xs">
                Personalize your workspace. Drag and drop isn't here, but you can use arrow buttons to set the order of buttons in your menus.
              </p>
            </div>

            <div className="md:col-span-8 space-y-12">
              {/* Desktop Sidebar Config */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-indigo-400">Desktop Sidebar</span>
                    <span className="font-mono text-[8px] opacity-30 uppercase">Order & Visibility</span>
                  </div>
                </div>
                
                <Reorder.Group 
                  axis="y" 
                  values={sidebarNavItems} 
                  onReorder={setSidebarNavItems}
                  className="space-y-2"
                >
                  {sidebarNavItems.map((id, index) => {
                    const item = [
                      { id: "dashboard", label: "Dashboard" },
                      { id: "pos", label: "POS / Sales" },
                      { id: "supplies", label: "Inventory" },
                      { id: "expenses", label: "Expenses" },
                      { id: "payments", label: "Ledger" },
                      { id: "settings", label: "Settings" }
                    ].find(n => n.id === id);
                    if (!item) return null;

                    return (
                      <Reorder.Item 
                        key={id}
                        value={id}
                        className="flex items-center justify-between p-3 bg-surface border border-ink-faint rounded-xl group transition-all hover:border-indigo-500/30 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-indigo-400/20 group-hover:text-indigo-400/40" />
                          <span className="font-mono text-[10px] text-indigo-400/40 w-4">0{index + 1}</span>
                          <span className="font-mono text-[10px] uppercase tracking-wider font-bold">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              const newItems = [...sidebarNavItems];
                              [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
                              setSidebarNavItems(newItems);
                            }}
                            className="p-1.5 hover:bg-indigo-500/10 rounded-lg text-indigo-400 disabled:opacity-10 transition-colors"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === sidebarNavItems.length - 1}
                            onClick={() => {
                              const newItems = [...sidebarNavItems];
                              [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
                              setSidebarNavItems(newItems);
                            }}
                            className="p-1.5 hover:bg-indigo-500/10 rounded-lg text-indigo-400 disabled:opacity-10 transition-colors"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </div>

              {/* Mobile Navbar Config */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-pink-400">Mobile Bottom Bar</span>
                    <span className="font-mono text-[8px] opacity-30 uppercase">Selection & Sequence</span>
                  </div>
                  <span className="font-mono text-[9px] text-pink-500/50 font-bold uppercase tracking-widest">
                    {mobileNavItems.length} / 5 Selected
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Selected Items with Order */}
                  <Reorder.Group 
                    axis="y" 
                    values={mobileNavItems} 
                    onReorder={setMobileNavItems}
                    className="space-y-2"
                  >
                    {mobileNavItems.map((id, index) => {
                      const item = [
                        { id: "dashboard", label: "Dashboard" },
                        { id: "pos", label: "POS" },
                        { id: "supplies", label: "Inventory" },
                        { id: "expenses", label: "Expenses" },
                        { id: "payments", label: "Ledger" },
                        { id: "settings", label: "Settings" }
                      ].find(n => n.id === id);
                      if (!item) return null;

                      return (
                        <Reorder.Item 
                          key={id}
                          value={id}
                          className="flex items-center justify-between p-3 bg-pink-500/5 border border-pink-500/20 rounded-xl cursor-grab active:cursor-grabbing group"
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className="w-4 h-4 text-pink-500/20 group-hover:text-pink-500/40" />
                            <span className="font-mono text-[10px] text-pink-400/40 w-4">0{index + 1}</span>
                            <span className="font-mono text-[10px] uppercase tracking-wider font-black text-pink-300">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const newItems = [...mobileNavItems];
                                [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
                                setMobileNavItems(newItems);
                              }}
                              className="p-1.5 hover:bg-pink-500/10 rounded-lg text-pink-400 disabled:opacity-10"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === mobileNavItems.length - 1}
                              onClick={() => {
                                const newItems = [...mobileNavItems];
                                [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
                                setMobileNavItems(newItems);
                              }}
                              className="p-1.5 hover:bg-pink-500/10 rounded-lg text-pink-400 disabled:opacity-10"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setMobileNavItems(mobileNavItems.filter(i => i !== id))}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400 ml-2"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>

                  {/* Add More Items */}
                  <div className="pt-2 border-t border-ink-faint/30">
                    <span className="block font-mono text-[8px] uppercase tracking-widest opacity-30 mb-3">Available Tools</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "dashboard", label: "Dashboard" },
                        { id: "pos", label: "POS" },
                        { id: "supplies", label: "Inventory" },
                        { id: "expenses", label: "Expenses" },
                        { id: "payments", label: "Ledger" },
                        { id: "settings", label: "Settings" }
                      ].filter(item => !mobileNavItems.includes(item.id)).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (mobileNavItems.length < 5) {
                              setMobileNavItems([...mobileNavItems, item.id]);
                            }
                          }}
                          className="px-3 py-1.5 border border-ink-faint rounded-lg font-mono text-[9px] uppercase tracking-wider opacity-60 hover:opacity-100 hover:border-pink-500/50 hover:bg-pink-500/5 transition-all"
                        >
                          + {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>



          {/* Action Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-ink-faint">
            <button
              type="button"
              onClick={onNavigateToSupplierPortal}
              className="group flex items-center gap-4 opacity-30 hover:opacity-100 transition-all font-mono text-[10px] font-bold uppercase tracking-widest"
            >
              <ExternalLink className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              Preview External Portal
            </button>

            <div className="flex items-center gap-6 w-full md:w-auto">
              {message && (
                <span className="font-mono text-[9px] font-bold text-emerald-custom uppercase tracking-widest animate-pulse">
                  {message}
                </span>
              )}
              
              <button
                type="submit"
                disabled={saving}
                className="w-full md:w-auto px-8 py-3 bg-accent text-bg font-mono text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all rounded shadow-xl shadow-accent/10"
              >
                {saving ? "COMMITTING..." : "COMMIT CHANGES"}
              </button>
            </div>
          </div>
        </form>

        {/* Danger Zone: Reset Database */}
        <div className="border border-red-500/20 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowResetSection(!showResetSection)}
            className="w-full flex items-center justify-between p-4 md:p-6 bg-red-950/20 hover:bg-red-950/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-red-400">Danger Zone</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-red-400/60 transition-transform ${showResetSection ? 'rotate-180' : ''}`} />
          </button>
          {showResetSection && (
            <div className="p-4 md:p-6 space-y-4 border-t border-red-500/20">
              <p className="font-mono text-[10px] text-red-300/60 uppercase tracking-wider leading-relaxed">
                Is se <b className="text-red-200">saara data delete ho jaye ga</b> — inventory (kg, raqam), supplier payments, daily expenses, aur POS orders. Sirf <b className="text-red-200">formula settings</b> aur <b className="text-red-200">suppliers</b> bach jayein ge. Yeh action <b className="text-red-200">wapas nahi ho sakta</b>.
              </p>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <input
                  type="password"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="ENTER OWNER PASSWORD TO CONFIRM"
                  className="flex-1 w-full bg-surface border border-red-500/30 px-4 py-3 font-mono text-[10px] uppercase tracking-widest rounded outline-none focus:ring-1 focus:ring-red-500"
                />
                <button
                  type="button"
                  disabled={resetting || !resetPasswordInput.trim()}
                  onClick={async () => {
                    const ownerPass = settings.supplierPassword || "786";
                    if (resetPasswordInput.trim() !== ownerPass) {
                      alert("Incorrect password. Use the owner password from Settings.");
                      return;
                    }
                    if (!confirm("Are you sure you want to delete ALL data? This cannot be undone!")) return;
                    setResetting(true);
                    try {
                      await onResetAllData();
                      alert("All data has been reset successfully.");
                      setResetPasswordInput("");
                      setShowResetSection(false);
                    } catch (err) {
                      alert("Failed to reset data. Check console for details.");
                    } finally {
                      setResetting(false);
                    }
                  }}
                  className="shrink-0 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded font-mono text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-30"
                >
                  {resetting ? "DELETING..." : "DELETE ALL DATA"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Supplier List Section */}
        <div className="space-y-8 md:space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-ink-faint pb-6 md:pb-10">
            <div className="space-y-1">
              <span className="font-mono text-[8px] md:text-[9px] uppercase tracking-[0.2em] opacity-30">Registry</span>
              <h3 className="font-display text-base md:text-xl uppercase tracking-widest">Sources</h3>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
            {suppliers.length === 0 ? (
              <div className="col-span-full py-12 text-center border border-dashed border-ink-faint rounded-lg">
                <p className="font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-20 italic">Empty</p>
              </div>
            ) : (
              suppliers.map((s) => (
                <div key={s.id} className="bg-surface border border-ink-faint p-3 md:p-6 space-y-3 md:space-y-4 transition-all group relative overflow-hidden rounded">
                  <div className="absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-2" style={{ backgroundColor: s.color }} />
                  
                  {editingSupplierId === s.id ? (
                    <form onSubmit={handleUpdateSupplierSubmit} className="space-y-4 animate-fade-in">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-[10px] font-bold focus:ring-0 uppercase rounded-none"
                        placeholder="NAME"
                      />
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-[10px] focus:ring-0 uppercase rounded-none"
                        placeholder="USERNAME"
                      />
                      <input
                        type="text"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-[10px] focus:ring-0 uppercase rounded-none"
                        placeholder="PASSWORD"
                      />
                      <select
                        value={editSupplierCategory}
                        onChange={(e) => setEditSupplierCategory(e.target.value)}
                        className="w-full bg-surface border border-ink-faint px-3 py-2 text-[10px] cursor-pointer appearance-none uppercase font-mono font-bold tracking-tight rounded outline-none focus:ring-1 focus:ring-accent"
                      >
                        {SUPPLY_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between gap-4">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-6 h-6 rounded-full border-0 p-0 appearance-none bg-transparent cursor-pointer"
                        />
                        <div className="flex gap-4">
                          <button type="button" onClick={cancelEditing} className="opacity-20 hover:opacity-100">×</button>
                          <button type="submit" className="font-mono text-[8px] font-bold uppercase text-accent border-b border-accent pb-0.5">OK</button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-[10px] md:text-sm uppercase tracking-widest truncate">{s.name}</span>
                      <div className="flex items-center gap-3 md:gap-6 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(s)}
                          className="opacity-20 hover:text-accent hover:opacity-100 transition-all"
                        >
                          <Palette className="w-3 md:w-3.5 h-3 md:h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete ${s.name}?`)) {
                              onDeleteSupplier(s.id);
                            }
                          }}
                          className="opacity-20 hover:text-accent hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 md:w-3.5 h-3 md:h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
