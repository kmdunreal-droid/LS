import React, { useState, useEffect } from "react";
import { 
  getFormulaSettings, 
  saveFormulaSettings,
  subscribeSupplyLogs, 
  addSupplyLog, 
  deleteSupplyLog,
  subscribePayments, 
  addPayment, 
  deletePayment,
  subscribeExpenses, 
  addExpense, 
  deleteExpense,
  subscribeOrders, 
  addOrder, 
  deleteOrder,
  updateOrderStatus,
  subscribeSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  updateSupplyLog,
  updatePayment,
  updateExpense,
  resetAllData,
  isSupabaseActive,
  subscribeSyncStatus,
  SyncStatus
} from "./db/supabase";
import { FormulaSettings, SupplyLog, SupplierPayment, Expense, Order, Supplier } from "./types";
import { DEFAULT_FORMULA_SETTINGS } from "./constants";
import DashboardTab from "./components/DashboardTab";
import RateCalculatorTab from "./components/RateCalculatorTab";
import POSTab from "./components/POSTab";
import SuppliesTab from "./components/SuppliesTab";
import PaymentsTab from "./components/PaymentsTab";
import ExpensesTab from "./components/ExpensesTab";
import SettingsTab from "./components/SettingsTab";
import AuthGate, { AuthProvider, useAuth } from "./components/AuthGate";
import SupplierPortal from "./components/SupplierPortal";



import { 
  Flame, 
  LayoutDashboard, 
  Coins, 
  ShoppingCart, 
  Weight, 
  CreditCard, 
  Settings, 
  CheckCircle,
  Menu,
  X,
  LogOut,
  AlertCircle,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Wifi,
  WifiOff,
  CloudCheck,
  CloudOff
} from "lucide-react";

export function AppContent() {
  const { user, isGuest, isSupplier, isOwner, logout } = useAuth();
  const userName = isOwner ? "Owner" : (isSupplier ? "Supplier Mode" : (isGuest ? "Guest User" : (user?.displayName || user?.email?.split("@")[0] || "Staff")));
  const userPhoto = !isSupplier && !isGuest && user?.photoURL ? user.photoURL : null;

  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSupplierPortalActive, setIsSupplierPortalActive] = useState<boolean>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [deleteNotification, setDeleteNotification] = useState<{
    show: boolean;
    itemType: string;
    itemName?: string;
    amount?: string;
  } | null>(null);

  // States for DB synced data
  const [settings, setSettings] = useState<FormulaSettings>(DEFAULT_FORMULA_SETTINGS);
  const [supplyLogs, setSupplyLogs] = useState<SupplyLog[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Indicators
  const [isDbLive, setIsDbLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // Initialize data and listeners
  useEffect(() => {
    // Load from localStorage first (instant), then try Supabase in background
    try {
      const localSettings = localStorage.getItem("tikka_settings");
      if (localSettings) {
        setSettings(JSON.parse(localSettings));
      }
    } catch {}
    setLoading(false); // Always hide loading immediately

    // Try Supabase in background (won't block UI)
    getFormulaSettings().then((res) => {
      setSettings(res);
    }).catch(() => {});

    // Check Supabase status
    setIsDbLive(isSupabaseActive());

    // Sync status listener
    const unsubscribeSync = subscribeSyncStatus((status) => setSyncStatus(status));

    // 2. Real-time Subscribers
    let unsubscribeSupplies = () => {};
    let unsubscribePayments = () => {};
    let unsubscribeExpenses = () => {};
    let unsubscribeOrders = () => {};
    let unsubscribeSuppliers = () => {};
    try {
      unsubscribeSupplies = subscribeSupplyLogs((logs) => setSupplyLogs(logs));
      unsubscribePayments = subscribePayments((p) => setPayments(p));
      unsubscribeExpenses = subscribeExpenses((e) => setExpenses(e));
      unsubscribeOrders = subscribeOrders((o) => setOrders(o));
      unsubscribeSuppliers = subscribeSuppliers((s) => setSuppliers(s));
    } catch (e) {
      console.warn("Supabase subscriptions failed (offline mode):", e);
    }

    return () => {
      unsubscribeSync();
      unsubscribeSupplies();
      unsubscribePayments();
      unsubscribeExpenses();
      unsubscribeOrders();
      unsubscribeSuppliers();
    };
  }, []);

  // Sync / Action Handlers
  const handleSaveSettings = async (newSettings: FormulaSettings) => {
    try {
      await saveFormulaSettings(newSettings);
      setSettings(newSettings);
      setDbError(null);
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleAddSupplyLog = async (log: Omit<SupplyLog, "id">) => {
    try {
      const res = await addSupplyLog(log);
      setDbError(null);
      return res;
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleUpdateSupplyLog = async (id: string, log: Partial<SupplyLog>) => {
    try {
      await updateSupplyLog(id, log);
      setDbError(null);
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleDeleteSupplyLog = async (id: string) => {
    const ownerPass = settings.supplierPassword || "786";
    const entered = prompt("Enter owner password to confirm deletion:");
    if (!entered || entered !== ownerPass) return;
    try {
      const log = supplyLogs.find(l => l.id === id);
      const detailString = log ? `${log.category || 'Raw Chicken Supply'} (${log.weightKg} kg - Rs. ${log.totalCost.toLocaleString()})` : "Supply Entry";
      await deleteSupplyLog(id);
      setDbError(null);
      setDeleteNotification({
        show: true,
        itemType: "Delivery Log / Supply (Mal Bheja)",
        itemName: detailString,
        amount: log ? `Rs. ${log.totalCost.toLocaleString()}` : undefined
      });
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleAddPayment = async (pay: Omit<SupplierPayment, "id">) => {
    try {
      const res = await addPayment(pay);
      setDbError(null);
      return res;
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleUpdatePayment = async (id: string, payment: Partial<SupplierPayment>) => {
    try {
      await updatePayment(id, payment);
      setDbError(null);
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleDeletePayment = async (id: string) => {
    const ownerPass = settings.supplierPassword || "786";
    const entered = prompt("Enter owner password to confirm deletion:");
    if (!entered || entered !== ownerPass) return;
    try {
      const pay = payments.find(p => p.id === id);
      const detailString = pay ? `Payment Entry (${pay.notes || 'No notes'})` : "Payment Entry";
      await deletePayment(id);
      setDbError(null);
      setDeleteNotification({
        show: true,
        itemType: "Payment Received (Raqam Mili)",
        itemName: detailString,
        amount: pay ? `Rs. ${pay.amountPaid.toLocaleString()}` : undefined
      });
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleAddExpense = async (exp: Omit<Expense, "id">) => {
    try {
      const res = await addExpense(exp);
      setDbError(null);
      return res;
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleUpdateExpense = async (id: string, expense: Partial<Expense>) => {
    try {
      await updateExpense(id, expense);
      setDbError(null);
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const ownerPass = settings.supplierPassword || "786";
    const entered = prompt("Enter owner password to confirm deletion:");
    if (!entered || entered !== ownerPass) return;
    try {
      const exp = expenses.find(e => e.id === id);
      const detailString = exp ? `${exp.category} (${exp.notes || 'No notes'})` : "Expense Entry";
      await deleteExpense(id);
      setDbError(null);
      setDeleteNotification({
        show: true,
        itemType: "Daily Expense (Kharcha)",
        itemName: detailString,
        amount: exp ? `Rs. ${exp.amount.toLocaleString()}` : undefined
      });
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleAddOrder = async (order: Omit<Order, "id">) => {
    try {
      const res = await addOrder(order);
      setDbError(null);
      return res;
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleDeleteOrder = async (id: string) => {
    const ownerPass = settings.supplierPassword || "786";
    const entered = prompt("Enter owner password to confirm deletion:");
    if (!entered || entered !== ownerPass) return;
    try {
      const order = orders.find(o => o.id === id);
      const detailString = order ? `Order #${order.id.slice(0, 5)}... (${order.items.length} items)` : "Order Entry";
      await deleteOrder(id);
      setDbError(null);
      setDeleteNotification({
        show: true,
        itemType: "POS Sale Order (Grahak Order)",
        itemName: detailString,
        amount: order ? `Rs. ${order.totalAmount.toLocaleString()}` : undefined
      });
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleUpdateOrderStatus = async (id: string, status: "Paid" | "Unpaid") => {
    try {
      await updateOrderStatus(id, status);
      setDbError(null);
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleAddSupplier = async (supplier: Omit<Supplier, "id">) => {
    try {
      const res = await addSupplier(supplier);
      setDbError(null);
      return res;
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleUpdateSupplier = async (id: string, supplier: Partial<Supplier>) => {
    try {
      await updateSupplier(id, supplier);
      setDbError(null);
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    const ownerPass = settings.supplierPassword || "786";
    const entered = prompt("Enter owner password to confirm deletion:");
    if (!entered || entered !== ownerPass) return;
    try {
      const supp = suppliers.find(s => s.id === id);
      const detailString = supp ? `${supp.name}` : "Supplier";
      await deleteSupplier(id);
      setDbError(null);
      setDeleteNotification({
        show: true,
        itemType: "Supplier Account (Faraham-Kar)",
        itemName: detailString,
      });
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  const handleResetAllData = async () => {
    try {
      await resetAllData();
      setDbError(null);
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || String(err));
      throw err;
    }
  };

  // Derived values
  const selectedSupplierObj = suppliers.find(s => s.id === selectedSupplierId);
  const selectedSupplierName = selectedSupplierObj?.name || "All Suppliers";

  // Stats Calculations
  const todayString = new Date().toISOString().split("T")[0];
  const todayOrders = orders.filter((o) => o.date === todayString);
  const todaySales = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const totalSuppliesValue = supplyLogs.reduce((sum, log) => sum + log.totalCost, 0);
  const totalAmountPaid = payments.reduce((sum, pay) => sum + pay.amountPaid, 0);
  const outstandingSupplierBalance = totalSuppliesValue - totalAmountPaid;

  const todaySupplies = supplyLogs.filter((s) => s.date === todayString);
  const todaySuppliesCost = todaySupplies.reduce((sum, s) => sum + s.totalCost, 0);
  const todayExpenses = expenses.filter((e) => e.date === todayString);
  const todayExpensesCost = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const todayTotalCosts = todaySuppliesCost + todayExpensesCost;
  const todayNetProfit = todaySales - todayTotalCosts;

  // Render Page Content depending on active tab
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-4 border-t-accent border-ink-faint rounded-full animate-spin"></div>
          <span className="text-ink/50 font-bold text-sm">Real-time Data Syncing...</span>
        </div>
      );
    }

    const filteredSupplyLogs = selectedSupplierId === "" || selectedSupplierId === "All"
      ? supplyLogs
      : supplyLogs.filter(s => s.supplierId === selectedSupplierId);

    const filteredPayments = selectedSupplierId === "" || selectedSupplierId === "All"
      ? payments
      : payments.filter(p => p.supplierId === selectedSupplierId);

    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardTab
            settings={settings}
            orders={orders}
            supplyLogs={supplyLogs}
            payments={payments}
            expenses={expenses}
            suppliers={suppliers}
            selectedSupplierId={selectedSupplierId}
            onSupplierSelect={setSelectedSupplierId}
            onSaveSettings={handleSaveSettings}
            onNavigateToSales={() => setActiveTab("pos")}
          />
        );
      case "pos":
        return (
          <POSTab
            settings={settings}
            orders={orders.filter(o => o.date === todayString)}
            onAddOrder={handleAddOrder}
            onUpdateStatus={handleUpdateOrderStatus}
            onDeleteOrder={handleDeleteOrder}
            onSaveSettings={handleSaveSettings}
          />
        );
      case "calculator":
        return (
          <RateCalculatorTab
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        );
      case "supplies":
        return (
          <SuppliesTab
            settings={settings}
            supplyLogs={filteredSupplyLogs}
            suppliers={suppliers}
            selectedSupplierId={selectedSupplierId}
            onAddLog={handleAddSupplyLog}
            onUpdateLog={handleUpdateSupplyLog}
            onDeleteLog={handleDeleteSupplyLog}
            onSaveSettings={handleSaveSettings}
            onNavigateToSales={() => setActiveTab("pos")}
          />
        );
      case "payments":
        return (
          <PaymentsTab
            payments={filteredPayments}
            supplyLogs={filteredSupplyLogs}
            suppliers={suppliers}
            onAddPayment={handleAddPayment}
            onUpdatePayment={handleUpdatePayment}
            onDeletePayment={handleDeletePayment}
          />
        );
      case "expenses":
        return (
          <ExpensesTab 
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        );
      case "settings":
        return (
          <SettingsTab
            settings={settings}
            suppliers={suppliers}
            orders={orders}
            supplyLogs={supplyLogs}
            payments={payments}
            expenses={expenses}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onSaveSettings={handleSaveSettings}
            onNavigateToSupplierPortal={() => setIsSupplierPortalActive(true)}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            onResetAllData={handleResetAllData}
          />
        );
      default:
        return null;
    }
  };

  const navColors: Record<string, {
    activeClass: string;
    inactiveClass: string;
    iconColor: string;
    activeText: string;
    mobileActiveBg: string;
    mobileRing: string;
    mobileIconClass: string;
  }> = {
    dashboard: {
      activeClass: "bg-accent text-bg font-bold opacity-100",
      inactiveClass: "text-ink/40 hover:text-ink hover:bg-ink-faint hover:scale-103 opacity-70 hover:opacity-100",
      iconColor: "text-ink/70",
      activeText: "text-ink",
      mobileActiveBg: "bg-accent/20 text-ink",
      mobileRing: "ring-1 ring-accent/20",
      mobileIconClass: "text-ink stroke-[2.5px] scale-110",
    },
    supplies: {
      activeClass: "bg-accent text-bg font-bold opacity-100",
      inactiveClass: "text-ink/40 hover:text-ink hover:bg-ink-faint hover:scale-103 opacity-70 hover:opacity-100",
      iconColor: "text-ink/70",
      activeText: "text-ink",
      mobileActiveBg: "bg-accent/20 text-ink",
      mobileRing: "ring-1 ring-accent/20",
      mobileIconClass: "text-ink stroke-[2.5px] scale-110",
    },
    payments: {
      activeClass: "bg-accent text-bg font-bold opacity-100",
      inactiveClass: "text-ink/40 hover:text-ink hover:bg-ink-faint hover:scale-103 opacity-70 hover:opacity-100",
      iconColor: "text-ink/70",
      activeText: "text-ink",
      mobileActiveBg: "bg-accent/20 text-ink",
      mobileRing: "ring-1 ring-accent/20",
      mobileIconClass: "text-ink stroke-[2.5px] scale-110",
    },
    pos: {
      activeClass: "bg-accent text-bg font-bold opacity-100",
      inactiveClass: "text-ink/40 hover:text-ink hover:bg-ink-faint hover:scale-103 opacity-70 hover:opacity-100",
      iconColor: "text-ink/70",
      activeText: "text-ink",
      mobileActiveBg: "bg-accent/20 text-ink",
      mobileRing: "ring-1 ring-accent/20",
      mobileIconClass: "text-ink stroke-[2.5px] scale-110",
    },
    expenses: {
      activeClass: "bg-accent text-bg font-bold opacity-100",
      inactiveClass: "text-ink/40 hover:text-ink hover:bg-ink-faint hover:scale-103 opacity-70 hover:opacity-100",
      iconColor: "text-ink/70",
      activeText: "text-ink",
      mobileActiveBg: "bg-accent/20 text-ink",
      mobileRing: "ring-1 ring-accent/20",
      mobileIconClass: "text-ink stroke-[2.5px] scale-110",
    },
    settings: {
      activeClass: "bg-accent text-bg font-bold opacity-100",
      inactiveClass: "text-ink/40 hover:text-ink hover:bg-ink-faint hover:scale-103 opacity-70 hover:opacity-100",
      iconColor: "text-ink/70",
      activeText: "text-ink",
      mobileActiveBg: "bg-accent/20 text-ink",
      mobileRing: "ring-1 ring-accent/20",
      mobileIconClass: "text-ink stroke-[2.5px] scale-110",
    },
    calculator: {
      activeClass: "bg-accent text-bg font-bold opacity-100",
      inactiveClass: "text-ink/40 hover:text-ink hover:bg-ink-faint hover:scale-103 opacity-70 hover:opacity-100",
      iconColor: "text-ink/70",
      activeText: "text-ink",
      mobileActiveBg: "bg-accent/20 text-ink",
      mobileRing: "ring-1 ring-accent/20",
      mobileIconClass: "text-ink stroke-[2.5px] scale-110",
    }
  };

  const navItems = [
    { id: "pos", label: "POS / سیلز اسکرین", icon: ShoppingCart },
    { id: "dashboard", label: "Dashboard / اوورویو", icon: LayoutDashboard },
    { id: "supplies", label: "Inventory / اسٹاک", icon: Weight },
    { id: "expenses", label: "Daily Expenses / خرچہ", icon: Coins },
    { id: "payments", label: "Supplier Ledger / لیجر", icon: CreditCard },
    { id: "settings", label: "Settings / سیٹنگز", icon: Settings },
  ];

  if (deleteNotification && deleteNotification.show) {
    return (
      <div className="fixed inset-0 bg-bg z-[9999] flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto animate-fade-in text-ink font-sans">
        {/* Abstract design element background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute top-10 left-10 hidden md:block font-mono text-[9px] text-ink/30 uppercase tracking-[0.2em]">
          Akbar Tikka Shop Manager &bull; Secure Protocol
        </div>
        
        <div className="max-w-md w-full text-center space-y-12 relative z-10">
          {/* Animated Glowing Trash/Check icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl scale-125" />
              <div className="relative p-8 bg-accent/10 border border-ink-faint text-ink rounded-2xl">
                <Trash2 className="w-12 h-12 stroke-[2px]" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <span className="inline-block font-mono text-[10px] font-bold text-ink uppercase tracking-[0.25em] bg-accent/10 border border-ink-faint px-3.5 py-1.5 rounded-full">
              Deleted / خارج کر دیا گیا
            </span>
            <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-ink">
              Purged From System
            </h1>
            <p className="font-mono text-[10px] text-ink/50 uppercase tracking-wider">
              آئٹم کامیابی کے ساتھ سسٹم سے ڈیلیٹ کر دیا گیا ہے
            </p>
          </div>

          {/* Details Table */}
          <div className="bg-surface border border-ink-faint rounded-2xl p-6 text-left space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -mr-8 -mt-8" />
            
            <div className="space-y-1.5 border-b border-ink-faint pb-4">
              <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Entry Type</span>
              <span className="block font-sans text-base font-bold text-ink">{deleteNotification.itemType}</span>
            </div>

            <div className="space-y-1.5 border-b border-ink-faint pb-4">
              <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Description / Details</span>
              <span className="block font-mono text-[11px] text-ink/80 leading-relaxed break-words">{deleteNotification.itemName}</span>
            </div>

            {deleteNotification.amount && (
              <div className="space-y-1.5 border-b border-ink-faint pb-4">
                <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Purged Value</span>
                <span className="block font-mono text-xl font-bold text-ink/70 tracking-tighter">{deleteNotification.amount}</span>
              </div>
            )}

            <div className="space-y-1">
              <span className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Action Timestamp</span>
              <span className="block font-mono text-[10px] text-ink/50 uppercase tracking-widest">
                {new Date().toLocaleTimeString()} &bull; {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Return Button */}
          <button
            onClick={() => setDeleteNotification(null)}
            className="w-full bg-accent text-bg font-mono font-bold py-4.5 rounded-xl text-xs uppercase tracking-[0.2em] hover:brightness-110 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Dismiss & Return / واپس جائیں
          </button>
        </div>
      </div>
    );
  }

  if (isSupplier || isSupplierPortalActive) {
    return (
      <SupplierPortal
        settings={settings}
        supplyLogs={supplyLogs}
        suppliers={suppliers}
        payments={payments}
        onAddLog={handleAddSupplyLog}
        onUpdateLog={handleUpdateSupplyLog}
        onDeleteLog={handleDeleteSupplyLog}
        onAddPayment={handleAddPayment}
        onUpdatePayment={handleUpdatePayment}
        onDeletePayment={handleDeletePayment}
        onSaveSettings={handleSaveSettings}
        onExit={async () => {
          if (isSupplier) {
            localStorage.setItem("tikka_auth_pref_tab", "supplier");
            await logout();
          } else {
            setIsSupplierPortalActive(false);
          }
        }}
        isLockedOnly={isSupplier}
      />
    );
  }

  return (
    <div id="app-container" className="min-h-screen bg-bg text-ink flex flex-col font-sans pb-20 md:pb-0">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] bg-bg/95 backdrop-blur-xl animate-fade-in flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-ink-faint">
            <div className="flex flex-col">
              <span className="font-display text-2xl uppercase tracking-tight text-ink font-black leading-none">
                Akbar Tikka
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50 font-bold">System Menu</span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-3 bg-surface border border-ink-faint rounded-2xl text-ink active:scale-90 transition-transform"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="space-y-3">
              <span className="block font-mono text-[10px] font-bold text-ink/70 uppercase tracking-[0.2em] mb-4">Core Management</span>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const colors = navColors[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                      isActive 
                        ? `${colors?.mobileActiveBg || 'bg-accent/20'} ${colors?.mobileRing || 'border-accent/50'} font-bold` 
                        : "bg-surface/50 border-ink-faint opacity-70"
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${isActive ? (colors?.mobileActiveBg || 'bg-accent/20') : 'bg-bg'}`}>
                      <Icon className={`w-6 h-6 ${isActive ? (colors?.mobileIconClass || 'text-accent') : 'text-ink/40'}`} />
                    </div>
                    <span className="font-mono text-sm uppercase tracking-wider">{item.label}</span>
                    {isActive && <CheckCircle className="w-4 h-4 ml-auto text-ink" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-6 border-t border-ink-faint">
              <button 
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-accent/10 border border-ink-faint text-ink/70 font-mono text-sm uppercase tracking-widest"
              >
                <div className="p-3 bg-accent/20 rounded-xl">
                  <LogOut className="w-6 h-6" />
                </div>
                Logout / لاگ آؤٹ
              </button>
            </div>
          </div>

          <div className="p-6 bg-surface/30 border-t border-ink-faint">
             <div className="flex items-center gap-4 p-4 bg-surface rounded-2xl">
                <div className="w-10 h-10 rounded-full border-2 border-accent overflow-hidden shrink-0 shadow-lg">
                  {userPhoto ? (
                    <img src={userPhoto} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-accent text-white font-bold text-sm">
                       {userName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="user-info min-w-0">
                  <span className="block text-sm font-black truncate text-white">{userName}</span>
                  <span className="block text-[10px] text-ink/70 font-bold uppercase tracking-widest leading-tight">Administrator</span>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Mobile Top Brand Bar */}
      <div className="md:hidden bg-bg border-b border-ink-faint py-4 px-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-bg/80">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 bg-surface border border-ink-faint rounded-lg text-ink active:scale-90 transition-all"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex flex-col">
            <span className="font-display text-xl uppercase tracking-tight text-ink font-black leading-none">
              Akbar Tikka
            </span>
            <span className="font-mono text-[8px] uppercase tracking-widest text-ink/50 font-bold">Manager</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {todayOrders.length > 0 ? (
            <button 
              onClick={() => setActiveTab("pos")}
              className={`p-2 rounded-xl border transition-all ${
                activeTab === "pos" 
                  ? "bg-accent/20 border-accent/50 text-ink" 
                  : "border-ink-faint bg-accent/10 text-ink/70"
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
          ) : (
            <div className="flex flex-col items-end">
              <span className="font-mono text-[7px] uppercase text-ink/30 font-bold leading-none mb-0.5">Source</span>
              <span className="font-mono text-[9px] font-black text-ink/70 leading-none truncate max-w-[100px]">{selectedSupplierName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Side Navigation - Wide & Branded */}
        <aside className="hidden md:flex w-[260px] flex-col py-8 px-6 bg-gradient-to-b from-surface/95 via-[#0c0c18] to-surface/95 border-r border-ink-faint shrink-0 z-50 overflow-y-auto">
          <div className="brand flex flex-col gap-2 mb-10">
            <span className="brand-name font-display text-2xl leading-[0.9] uppercase tracking-[-0.04em] text-ink font-black">
              Akbar Tikka
            </span>
            <span className="brand-meta font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50 font-bold">Supplies & Cash Manager</span>
          </div>
          
          <nav className="flex flex-col gap-2.5 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/70 font-bold mb-2">System Controls</div>
            
            {(settings.sidebarNavItems?.length ? (settings.sidebarNavItems.includes("pos") ? settings.sidebarNavItems : ["pos", ...settings.sidebarNavItems]) : ["dashboard", "pos", "supplies", "expenses", "payments", "calculator"]).map((id) => {
              const item = navItems.find(n => n.id === id);
              if (!item) return null;
              
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const colors = navColors[item.id] || {
                activeClass: "bg-accent text-bg font-bold opacity-100",
                inactiveClass: "opacity-60 hover:opacity-100 hover:bg-ink-faint"
              };
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 px-4.5 py-3 rounded-xl font-mono text-xs transition-all duration-300 transform cursor-pointer text-left ${
                    isActive ? colors.activeClass : colors.inactiveClass
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110 stroke-[2.5px]' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-8 border-t border-ink-faint space-y-6">
            <div className="p-4 bg-surface border border-ink-faint rounded-xl text-[11px] opacity-90 text-ink/70">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink/70 font-bold mb-1">🔥 App Update</div>
              Active cloud database with real-time syncing is online.
            </div>

            <div className="flex items-center gap-4 p-4 bg-surface border border-ink-faint rounded-xl">
              <div className="w-8 h-8 rounded-full border-2 border-accent overflow-hidden shrink-0">
                {userPhoto ? (
                  <img src={userPhoto} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent text-white font-bold text-xs">
                     {userName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="user-info min-w-0">
                <span className="block text-xs font-black truncate leading-tight text-white">{userName}</span>
                <span className="block text-[10px] text-ink/70 font-bold uppercase tracking-widest truncate leading-tight">{isOwner ? 'System Owner' : (isSupplier ? 'Supplier' : 'System Owner')}</span>
              </div>
            </div>

            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-4 py-2.5 w-full font-mono text-[10px] uppercase tracking-widest transition-all duration-300 transform cursor-pointer ${
                activeTab === 'settings' 
                  ? "text-purple-400 scale-105 font-bold" 
                  : "opacity-50 hover:opacity-100 hover:text-purple-400"
              }`}
            >
              <Settings className={`w-4 h-4 transition-transform duration-300 ${activeTab === 'settings' ? 'scale-110 stroke-[2.5px] rotate-45' : ''}`} />
              Settings
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden">
          {/* Header */}
          <header className="hidden md:flex bg-bg border-b border-ink-faint py-6 px-12 items-center justify-between z-40">
            <div className="flex gap-12">
              {activeTab === "pos" && (
                <button 
                  onClick={() => setActiveTab("pos")}
                  className="flex flex-col group cursor-pointer hover:bg-rose-500/5 px-4 py-2 -ml-4 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50 group-hover:text-rose-400 group-hover:opacity-100 transition-colors">Today's Sales</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="font-mono text-lg font-bold group-hover:text-rose-300 transition-colors">Rs. {todaySales.toLocaleString()}</span>
                </button>
              )}
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50 mb-1">Status</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isDbLive ? "bg-emerald-custom" : "bg-accent"}`}></span>
                  <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${isDbLive ? "text-emerald-custom" : "text-accent"}`}>
                    {isDbLive ? "Supabase Live" : "Local Mode"}
                  </span>
                </div>
              </div>

              {/* Sync Status Indicator */}
              <div className="flex flex-col border-l border-ink-faint pl-12">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50 mb-1">Cloud Sync</span>
                <div className="flex items-center gap-2">
                  {syncStatus === 'syncing' ? (
                    <>
                      <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-blue-400">Syncing...</span>
                    </>
                  ) : syncStatus === 'success' ? (
                    <>
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-emerald-400">Synced</span>
                    </>
                  ) : syncStatus === 'error' ? (
                    <>
                      <CloudOff className="w-3 h-3 text-red-400" />
                      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-red-400">Sync Error</span>
                    </>
                  ) : (
                    <>
                      {isDbLive ? (
                        <Wifi className="w-3 h-3 text-indigo-400 opacity-60" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-amber-400 opacity-60" />
                      )}
                      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-indigo-400 opacity-60">
                        {isDbLive ? "Connected" : "Offline"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                id="logout-button-header"
                onClick={logout}
                className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-50 hover:opacity-100 transition-all flex items-center gap-2 px-4 py-2 border border-ink-faint rounded-xl hover:bg-ink-faint cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </header>

          {/* Content View Area */}
          <main className="flex-1 overflow-y-auto w-full mx-auto p-3 md:p-6">
            {dbError && (
              <div id="db-error-banner" className="bg-surface border border-accent/20 rounded p-6 md:p-10 text-ink flex flex-col md:flex-row gap-6 md:gap-10 items-start shadow-2xl mb-8 md:mb-12 animate-fade-in relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <div className="p-4 bg-accent/5 text-accent rounded border border-accent/20 shrink-0 mt-0.5">
                  <AlertCircle className="w-8 h-8" />
                </div>
                
                <div className="space-y-6 md:space-y-8 flex-1 relative z-10">
                  <div className="space-y-1">
                    <h3 className="font-display text-xl uppercase tracking-tighter text-accent">
                      Supabase Connection Issue
                    </h3>
                    <p className="font-mono text-[10px] uppercase tracking-widest opacity-40">
                      Your database configuration is incomplete. Persistence is currently disabled.
                    </p>
                  </div>

                  <div className="bg-bg border border-ink-faint rounded p-4 font-mono text-[11px] text-accent/80 overflow-x-auto select-all max-h-32">
                    {dbError}
                  </div>

                  <div className="bg-bg border border-ink-faint rounded p-6 md:p-8 space-y-4 md:space-y-6">
                    <p className="font-mono font-bold text-accent uppercase tracking-widest text-[10px]">
                      Required Environment Variables
                    </p>
                    
                    <ul className="space-y-4 font-mono text-[11px] opacity-60">
                      <li className="flex gap-4">
                        <span className="w-5 h-5 rounded border border-accent text-accent flex items-center justify-center text-[10px] shrink-0 font-bold">1</span>
                        <span><b>VITE_SUPABASE_URL</b>: Your Supabase Project URL.</span>
                      </li>
                      <li className="flex gap-4">
                        <span className="w-5 h-5 rounded border border-accent text-accent flex items-center justify-center text-[10px] shrink-0 font-bold">2</span>
                        <span><b>VITE_SUPABASE_ANON_KEY</b>: Your Supabase Anonymous Key.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <button 
                  onClick={() => setDbError(null)}
                  className="absolute top-4 right-4 p-2 text-ink/20 hover:text-ink transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {renderTabContent()}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#060611]/95 border-t border-indigo-500/15 flex justify-around items-center p-2 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {(settings.mobileNavItems?.length ? settings.mobileNavItems : ["dashboard", "pos", "payments", "supplies"]).map((id) => {
          const item = navItems.find(n => n.id === id);
          if (!item) return null;
          
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          const activeBtnStyles: Record<string, string> = {
            dashboard: "border-blue-500 text-blue-300",
            supplies: "border-orange-500 text-orange-300",
            pos: "border-rose-500 text-rose-300 glow-rose",
            payments: "border-emerald-500 text-emerald-300",
            expenses: "border-yellow-500 text-yellow-300",
            settings: "border-purple-500 text-purple-300",
          };

          const shortLabels: Record<string, string> = {
            dashboard: "Home",
            pos: "POS",
            expenses: "Kharcha",
            supplies: "Inventory",
            payments: "Ledger",
            settings: "Settings"
          };

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-xl border transition-all duration-300 cursor-pointer select-none active:scale-[0.92] flex-1 min-w-0 ${
                isActive 
                  ? `${activeBtnStyles[item.id] || "border-accent text-accent"} font-bold scale-[1.03] shadow-lg border-2` 
                  : "border-transparent text-ink/40 hover:text-ink/70"
              }`}
            >
              <Icon className={`w-5 h-5 transition-all ${isActive ? 'stroke-[2.5px] scale-110' : 'opacity-75'}`} />
              <span className="text-[9px] font-mono font-black uppercase tracking-wider truncate w-full text-center">
                {shortLabels[item.id] || item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <AppContent />
      </AuthGate>
    </AuthProvider>
  );
}
