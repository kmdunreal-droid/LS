import React, { useState, useEffect } from "react";
import { FormulaSettings, Order, OrderItem, ItemFormula } from "../types";
import { ShoppingCart, User, Plus, Minus, Trash2, CheckCircle2, AlertCircle, TrendingUp, Sparkles, RefreshCw, Scale, Weight, Info } from "lucide-react";
import { evaluate } from "mathjs";

interface POSTabProps {
  settings: FormulaSettings;
  orders: Order[];
  onAddOrder: (order: Omit<Order, "id">) => Promise<string>;
  onUpdateStatus: (id: string, status: "Paid" | "Unpaid") => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  onSaveSettings?: (newSettings: FormulaSettings) => Promise<void>;
}

export default function POSTab({ settings, orders, onAddOrder, onUpdateStatus, onDeleteOrder, onSaveSettings }: POSTabProps) {
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderStatus, setOrderStatus] = useState<"Paid" | "Unpaid">("Paid");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [customBaseRate, setCustomBaseRate] = useState<number>(settings.baseRawRate);

  // Weight Calculator states
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [calcMode, setCalcMode] = useState<"cart" | "custom">("cart");
  const [customItemKey, setCustomItemKey] = useState<string>(Object.keys(settings.items || {})[0] || "boneless");
  const [customWeightInput, setCustomWeightInput] = useState<number>(5);

  // Individual Item Config Modal states
  const [selectedCalcItem, setSelectedCalcItem] = useState<any | null>(null);
  const [modalWeight, setModalWeight] = useState<number>(1.0);

  // Long press formula editor states
  const [editingFormulaItem, setEditingFormulaItem] = useState<any | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemExpression, setEditItemExpression] = useState("");
  const [savingFormula, setSavingFormula] = useState(false);
  const [longPressActionItem, setLongPressActionItem] = useState<any | null>(null);
  const [deletingFormula, setDeletingFormula] = useState(false);
  const pressTimeoutRef = React.useRef<any>(null);
  const pressStartTimeRef = React.useRef<number>(0);
  const isLongPressRef = React.useRef<boolean>(false);
  const isShortTapRef = React.useRef<boolean>(false);

  const handleButtonPressStart = (item: any) => {
    isLongPressRef.current = false;
    isShortTapRef.current = false;
    pressStartTimeRef.current = Date.now();
    if (pressTimeoutRef.current) clearTimeout(pressTimeoutRef.current);
    
    // Long press (3s) → formula edit/delete modal
    pressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setLongPressActionItem(item);
    }, 3000);

    // Short hold (300ms) → open weight modal
    setTimeout(() => {
      if (!isLongPressRef.current && !isShortTapRef.current) {
        isShortTapRef.current = true;
      }
    }, 300);
  };

  const handleButtonPressEnd = (e: React.MouseEvent | React.TouchEvent, item: any) => {
    const elapsed = Date.now() - pressStartTimeRef.current;
    
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
      pressTimeoutRef.current = null;
    }
    
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
    } else if (elapsed >= 300) {
      // Pressed for at least 300ms → open weight modal
      setSelectedCalcItem(item);
      setModalWeight(1.0);
    }
    // Less than 300ms → ignore (accidental tap)
  };

  const handleButtonPressCancel = () => {
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
      pressTimeoutRef.current = null;
    }
  };

  const handleDeleteFormulaItem = async (itemKey: string) => {
    if (!onSaveSettings) {
      alert("Saving is not available in guest mode.");
      return;
    }
    if (confirm(`Kya aap waqai "${settings.items[itemKey]?.name || itemKey}" formula aur menu item ko delete karna chahte hain?`)) {
      setDeletingFormula(true);
      try {
        const updatedItems = { ...settings.items };
        delete updatedItems[itemKey];
        await onSaveSettings({
          ...settings,
          items: updatedItems,
        });
        setLongPressActionItem(null);
      } catch (err) {
        console.error(err);
        alert("Delete karne mein masla pesh aya.");
      } finally {
        setDeletingFormula(false);
      }
    }
  };

  // Sync state if settings.baseRawRate changes from parent
  useEffect(() => {
    setCustomBaseRate(settings.baseRawRate);
  }, [settings.baseRawRate]);

  const calculatePrice = (formula: ItemFormula) => {
    try {
      if (formula.expression) {
        const cleanExpression = formula.expression.toLowerCase().replace(/supply/g, customBaseRate.toString());
        return Math.round(Number(evaluate(cleanExpression)));
      } else if (formula.multiplier !== undefined && formula.markup !== undefined) {
        return Math.round((customBaseRate * formula.multiplier) + formula.markup);
      }
      return 0;
    } catch (err) {
      console.error("Price Eval error:", err);
      return 0;
    }
  };

  const menuItems = Object.keys(settings.items || {}).map((key) => {
    const item = settings.items[key];
    return {
      key,
      name: item?.name || key,
      formula: item as ItemFormula,
    };
  });

  const addToCart = (itemKey: string, name: string, price: number, customQty: number = 0.5) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.itemKey === itemKey);
      if (existing) {
        return prev.map((item) => {
          if (item.itemKey === itemKey) {
            const newQty = parseFloat((item.quantity + customQty).toFixed(2));
            return { ...item, quantity: newQty, total: Math.round(newQty * price) };
          }
          return item;
        });
      }
      const roundedQty = parseFloat(customQty.toFixed(2));
      return [...prev, { itemKey, name, price, quantity: roundedQty, total: Math.round(roundedQty * price) }];
    });
  };

  const updateQuantity = (itemKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.itemKey === itemKey) {
            const newQty = parseFloat((item.quantity + delta).toFixed(2));
            return { ...item, quantity: newQty, total: Math.round(newQty * item.price) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (itemKey: string) => {
    setCart((prev) => prev.filter((item) => item.itemKey !== itemKey));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setSaving(true);
    try {
      const todayString = new Date().toISOString().split("T")[0];
      const newOrder: Omit<Order, "id"> = {
        date: todayString,
        timestamp: Date.now(),
        customerName: customerName.trim() || "Grahak (Walk-in Customer)",
        items: cart,
        totalAmount: cartTotal,
        status: orderStatus,
      };

      await onAddOrder(newOrder);
      
      // Clear Cart
      setCart([]);
      setCustomerName("");
      setOrderStatus("Paid");
      setSuccessMsg("Order kamyabi se save ho gaya! 🎉");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      console.error(e);
      alert("An error occurred while saving the order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="pos-tab" className="space-y-8 md:space-y-12 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-b border-ink-faint pb-8">
        <div className="flex items-center gap-6">
          <div className="p-3 bg-accent/5 text-accent rounded">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="block font-mono text-[7px] font-bold opacity-30 uppercase tracking-widest leading-tight">Sales</span>
            <h2 className="font-display text-lg uppercase tracking-tight">Point of Sale</h2>
          </div>
        </div>
      </div>

      {/* Quick POS Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12">
        {/* Left Side: Grill Menu */}
        <div className="lg:col-span-7 space-y-6 md:space-y-10">
          <div className="space-y-4 md:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-faint pb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 shrink-0">Grill Menu Selection</span>
              <span className="font-mono text-[8px] md:text-[9px] text-accent/80 bg-accent/5 px-2 py-0.5 rounded italic flex items-center gap-1 self-start sm:self-auto">
                💡 Tip: Kisi bhi item ko 3 second dba kar rakhain us ka formula edit karne ke liye.
              </span>
            </div>



            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-4">
              {menuItems.map((item, idx) => {
                const currentPrice = calculatePrice(item.formula);
                
                // Color mapping for a highly colorful experience
                const colorPalettes = [
                  { bg: "", border: "border-ink-faint hover:border-ink/30", glow: "", labelText: "text-ink/70", accentText: "text-ink/50" },
                  { bg: "", border: "border-ink-faint hover:border-ink/30", glow: "", labelText: "text-ink/70", accentText: "text-ink/50" },
                  { bg: "", border: "border-ink-faint hover:border-ink/30", glow: "", labelText: "text-ink/70", accentText: "text-ink/50" },
                  { bg: "", border: "border-ink-faint hover:border-ink/30", glow: "", labelText: "text-ink/70", accentText: "text-ink/50" },
                  { bg: "", border: "border-ink-faint hover:border-ink/30", glow: "", labelText: "text-ink/70", accentText: "text-ink/50" }
                ];
                
                const theme = colorPalettes[idx % colorPalettes.length];

                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseDown={() => handleButtonPressStart(item)}
                    onMouseUp={(e) => handleButtonPressEnd(e, item)}
                    onMouseLeave={handleButtonPressCancel}
                    onTouchStart={() => handleButtonPressStart(item)}
                    onTouchEnd={(e) => handleButtonPressEnd(e, item)}
                    className={`bg-surface border ${theme.border} p-4 md:p-6 text-left transition-all duration-300 flex flex-col justify-between h-28 md:h-36 rounded-2xl group cursor-pointer select-none active:scale-[0.96]`}
                    style={{ WebkitTouchCallout: "none", userSelect: "none" }}
                  >
                    <span className={`font-mono text-[8px] md:text-[9px] font-black uppercase tracking-widest ${theme.labelText} opacity-80 group-hover:opacity-100 transition-all`}>
                      {item.key.replace(/_/g, " ")}
                    </span>
                    <div className="space-y-1.5">
                      <span className="block font-display text-sm md:text-lg uppercase leading-tight tracking-tight text-white group-hover:scale-[1.02] transition-transform origin-left">
                        {item.name}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className={`font-mono text-[9px] md:text-[10px] uppercase font-bold ${theme.accentText}`}>Rs.</span>
                        <span className="font-mono text-lg md:text-2xl font-black leading-none text-white">{currentPrice}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Order Receipt Cart */}
        <div className="lg:col-span-5">
          <div className="bg-surface border border-ink-faint p-6 md:p-8 sticky top-12 space-y-6 md:space-y-10 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 font-bold">Active Order Sheet</span>
              <button
                type="button"
                onClick={() => setIsWeightModalOpen(true)}
                className="font-mono text-[10px] font-black uppercase tracking-widest text-ink/70 border-b-2 border-ink-faint pb-0.5 hover:text-ink transition-colors cursor-pointer"
              >
                Calculator 🧮
              </button>
            </div>

            {successMsg && (
              <div className="bg-emerald-custom/10 border border-emerald-custom/20 text-emerald-custom p-4 rounded text-[10px] font-mono font-bold uppercase tracking-widest text-center">
                {successMsg}
              </div>
            )}

            {cart.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center mx-auto opacity-20">
                  <ShoppingCart className="w-6 h-6 stroke-1" />
                </div>
                <div className="space-y-1">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-30 italic">Order is empty</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePlaceOrder} className="space-y-10">
                {/* Cart Items List */}
                <div className="space-y-6">
                  {cart.map((item) => (
                    <div
                      key={item.itemKey}
                      className="flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest leading-none block">
                          {item.name}
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-base font-bold leading-none">{item.quantity}<span className="text-[10px] ml-1 opacity-30 font-normal uppercase">KG</span></span>
                          <span className="font-mono text-[10px] opacity-30 uppercase">@ {item.price}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.itemKey, -0.25)}
                            className="p-1 opacity-40 hover:opacity-100 hover:text-accent transition-all"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => addToCart(item.itemKey, item.name, item.price, 0.25)}
                            className="p-1 opacity-40 hover:opacity-100 hover:text-accent transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.itemKey)}
                          className="p-1 opacity-20 hover:opacity-100 hover:text-accent transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer Details */}
                <div className="space-y-6 pt-6 border-t border-ink-faint">
                  <div className="space-y-2">
                    <span className="font-mono text-[8px] uppercase tracking-widest opacity-30">Customer Details</span>
                    <input
                      type="text"
                      placeholder="NAME_OR_TABLE_ID"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-transparent border-none p-0 font-mono text-sm font-bold focus:ring-0 uppercase placeholder:opacity-20"
                    />
                  </div>

                  {/* Payment Status Toggle */}
                  <div className="space-y-3">
                    <span className="font-mono text-[8px] uppercase tracking-widest opacity-30">Status Selection</span>
                    <div className="flex gap-8">
                      <button
                        type="button"
                        onClick={() => setOrderStatus("Paid")}
                        className={`font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${
                          orderStatus === "Paid" ? "text-accent border-b border-accent" : "opacity-30 hover:opacity-100"
                        }`}
                      >
                        Paid (Cash)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderStatus("Unpaid")}
                        className={`font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${
                          orderStatus === "Unpaid" ? "text-accent border-b border-accent" : "opacity-30 hover:opacity-100"
                        }`}
                      >
                        Unpaid (Udhaar)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Total & Submit */}
                <div className="space-y-6 pt-6 border-t border-ink-faint">
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[8px] uppercase tracking-widest opacity-30">Grand Total</span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] opacity-30 uppercase">Rs.</span>
                      <span className="font-mono text-4xl font-bold tracking-tighter">
                        {cartTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-accent text-bg hover:brightness-110 active:scale-[0.98] py-5 font-mono text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded-xl cursor-pointer"
                  >
                    {saving ? "Processing..." : "Confirm & Save Order ⚡"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders List */}
      {/* Recent Orders List */}
      <div className="space-y-10">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 shrink-0">Daily Transaction Log</span>
          <div className="h-px bg-ink-faint flex-1" />
        </div>

        {orders.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-ink-faint rounded-lg">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">No orders recorded</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-ink-faint text-[8px] font-mono font-bold opacity-30 uppercase tracking-widest">
                    <th className="py-4 px-3">Time</th>
                    <th className="py-4 px-3">Customer</th>
                    <th className="py-4 px-3">Item Details</th>
                    <th className="py-4 px-3">Amount</th>
                    <th className="py-4 px-3 text-center">Status</th>
                    <th className="py-4 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-faint">
                  {orders.slice(0, 15).map((order) => (
                    <tr key={order.id} className="hover:bg-surface transition-colors group">
                      <td className="py-4 px-3 font-mono text-[10px] font-bold opacity-30 uppercase">
                        {new Date(order.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-4 px-3 text-sm font-bold uppercase tracking-tight">
                        {order.customerName}
                      </td>
                      <td className="py-4 px-3 font-mono text-[10px] opacity-40 uppercase tracking-wide">
                        {order.items.map((it) => `${it.name} (${it.quantity}Kg)`).join(", ")}
                      </td>
                      <td className="py-4 px-3 font-mono text-base font-bold">
                        Rs. {order.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-4 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(order.id, order.status === "Paid" ? "Unpaid" : "Paid")}
                          className={`font-mono text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded border transition-all ${
                            order.status === "Paid"
                              ? "text-emerald-custom border-emerald-custom/10 bg-emerald-custom/5"
                                                             : "text-accent border-accent/10 bg-accent/5"
                          }`}
                        >
                          {order.status}
                        </button>
                      </td>
                      <td className="py-4 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this order?")) {
                              onDeleteOrder(order.id);
                            }
                          }}
                          className="opacity-20 hover:opacity-100 hover:text-accent transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {orders.slice(0, 15).map((order) => (
                <div key={order.id} className="bg-surface border border-ink-faint p-6 rounded-lg space-y-4 relative">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] font-bold opacity-30 uppercase">
                        {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <h4 className="font-display text-lg uppercase tracking-tight">{order.customerName}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(order.id, order.status === "Paid" ? "Unpaid" : "Paid")}
                      className={`font-mono text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded border transition-all ${
                        order.status === "Paid"
                          ? "text-emerald-custom border-emerald-custom/10 bg-emerald-custom/5"
                          : "text-accent border-accent/10 bg-accent/5"
                      }`}
                    >
                      {order.status}
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="font-mono text-[10px] opacity-40 uppercase tracking-wide leading-relaxed">
                      {order.items.map((it) => `${it.name} (${it.quantity}Kg)`).join(", ")}
                    </div>
                    <div className="flex justify-between items-center border-t border-ink-faint pt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-[10px] opacity-30 uppercase">Rs.</span>
                        <span className="font-mono text-xl font-bold">{order.totalAmount.toLocaleString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this order?")) {
                            onDeleteOrder(order.id);
                          }
                        }}
                        className="text-accent opacity-30 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Weight Calculator Modal */}
      {isWeightModalOpen && (
        <div className="fixed inset-0 bg-bg/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-ink-faint p-6 md:p-12 w-full max-w-2xl relative space-y-8 md:space-y-12 rounded-lg my-auto">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent leading-none">Weight Correction</span>
                <h4 className="font-display text-2xl md:text-3xl uppercase tracking-tight">
                  Weight Calculator
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsWeightModalOpen(false)}
                className="opacity-40 hover:opacity-100 transition-all p-2"
              >
                <Plus className="w-6 h-6 md:w-8 md:h-8 rotate-45" />
              </button>
            </div>

            {/* Tabs / Modes */}
            <div className="flex gap-6 md:gap-10 border-b border-ink-faint overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setCalcMode("cart")}
                className={`font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all pb-4 -mb-[1px] ${
                  calcMode === "cart" ? "text-accent border-b-2 border-accent" : "opacity-30 hover:opacity-100"
                }`}
              >
                Order Items ({cart.length})
              </button>
              <button
                type="button"
                onClick={() => setCalcMode("custom")}
                className={`font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all pb-4 -mb-[1px] ${
                  calcMode === "custom" ? "text-accent border-b-2 border-accent" : "opacity-30 hover:opacity-100"
                }`}
              >
                Custom Entry
              </button>
            </div>

            {/* Mode A: From Cart */}
            {calcMode === "cart" && (
              <div className="space-y-8">
                {cart.length === 0 ? (
                  <div className="py-20 text-center font-mono text-[10px] font-bold uppercase tracking-widest opacity-20 italic">
                    No items in active sheet
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-ink-faint">
                      {cart.map((item) => {
                        const itemFormula = settings.items[item.itemKey];
                        let multiplier = 1.0;
                        if (itemFormula?.multiplier !== undefined) {
                          multiplier = itemFormula.multiplier;
                        } else if (itemFormula?.expression) {
                          // Try to extract multiplier from expression like "supply * 1.5"
                          try {
                            // This is a bit of a hack to estimate raw weight from dynamic expression.
                            // We use the derivative or just evaluate with supply=1 and subtract markup?
                            // Actually, let's just evaluate the expression part that matches supply * X
                            const match = itemFormula.expression.match(/supply\s*\*\s*([\d\.]+)/i);
                            if (match) multiplier = parseFloat(match[1]);
                          } catch (e) {}
                        }
                        const estimatedRawWeight = item.quantity * multiplier;

                        return (
                          <div key={item.itemKey} className="py-4 flex justify-between items-center">
                            <div className="space-y-1">
                              <span className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-50 leading-none block">{item.name}</span>
                              <span className="font-mono text-[10px] opacity-20 italic">
                                {item.quantity}Kg cooked × {multiplier} multiplier
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block font-mono text-2xl font-bold leading-none">{estimatedRawWeight.toFixed(2)}<span className="text-[10px] ml-1 opacity-30 uppercase font-normal">KG</span></span>
                              <span className="font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">Required Raw</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-bg p-8 space-y-4 rounded border border-ink-faint">
                      <div className="flex justify-between items-baseline">
                        <span className="font-mono text-[8px] font-bold text-accent uppercase tracking-widest">Total Raw Requirement</span>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-4xl font-bold tracking-tighter">
                            {cart.reduce((sum, item) => {
                              const itemFormula = settings.items[item.itemKey];
                              let multiplier = 1.0;
                              if (itemFormula?.multiplier !== undefined) {
                                multiplier = itemFormula.multiplier;
                              } else if (itemFormula?.expression) {
                                try {
                                  const match = itemFormula.expression.match(/supply\s*\*\s*([\d\.]+)/i);
                                  if (match) multiplier = parseFloat(match[1]);
                                } catch (e) {}
                              }
                              return sum + (item.quantity * multiplier);
                            }, 0).toFixed(2)}
                          </span>
                          <span className="font-mono text-[10px] opacity-30 uppercase">KG</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mode B: Custom / Manual Calculator */}
            {calcMode === "custom" && (
              <div className="grid grid-cols-2 gap-6 md:gap-12">
                <div className="space-y-4 md:space-y-6">
                  <div className="space-y-1 md:space-y-2">
                    <span className="font-mono text-[7px] md:text-[8px] uppercase tracking-widest opacity-30">Item Type</span>
                    <select
                      value={customItemKey}
                      onChange={(e) => setCustomItemKey(e.target.value)}
                      className="w-full bg-transparent border-b border-ink-faint p-0 font-display text-[10px] md:text-lg uppercase focus:ring-0 appearance-none rounded-none"
                    >
                      {menuItems.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:space-y-2">
                    <span className="font-mono text-[7px] md:text-[8px] uppercase tracking-widest opacity-30">Cooked Wt.</span>
                    <input
                      type="number"
                      step="0.01"
                      value={customWeightInput || ""}
                      onChange={(e) => setCustomWeightInput(Number(e.target.value))}
                      className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-xl md:text-3xl font-bold focus:ring-0 placeholder:opacity-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="bg-accent/5 p-4 md:p-8 border border-accent/10 space-y-2 md:space-y-4 rounded">
                  <span className="block font-mono text-[7px] md:text-[8px] font-bold text-accent uppercase tracking-widest">Projection</span>
                  <div className="space-y-0.5 md:space-y-1">
                    <span className="block font-mono text-2xl md:text-5xl font-bold text-accent leading-none tracking-tighter">
                      {(customWeightInput * (() => {
                        const it = settings.items[customItemKey];
                        if (it?.multiplier !== undefined) return it.multiplier;
                        if (it?.expression) {
                          const match = it.expression.match(/supply\s*\*\s*([\d\.]+)/i);
                          if (match) return parseFloat(match[1]);
                        }
                        return 1;
                      })()).toFixed(2)}
                    </span>
                    <span className="block font-mono text-[7px] md:text-[10px] font-bold text-accent/40 uppercase tracking-widest italic leading-tight">KG (Raw)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Individual Item Weight Entry Modal */}
      {selectedCalcItem && (() => {
        const itemFormula = settings.items[selectedCalcItem.key];
        let multiplier = 1.0;
        if (itemFormula?.multiplier !== undefined) {
          multiplier = itemFormula.multiplier;
        } else if (itemFormula?.expression) {
          const match = itemFormula.expression.match(/supply\s*\*\s*([\d\.]+)/i);
          if (match) multiplier = parseFloat(match[1]);
        }
        
        const pricePerKg = calculatePrice(itemFormula);
        const calculatedTotalPrice = Math.round(modalWeight * pricePerKg);
        const rawChickenNeeded = Math.round(modalWeight * multiplier * 100) / 100;
        const presets = [0.25, 0.5, 1.0, 1.5, 2.0, 2.5, 5.0];

        return (
          <div className="fixed inset-0 bg-bg/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
            <div className="bg-surface border border-ink-faint p-6 md:p-12 w-full max-w-xl relative space-y-8 md:space-y-12 rounded-lg my-auto">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent leading-none">{selectedCalcItem.key.replace(/_/g, " ")}</span>
                  <h4 className="font-display text-2xl md:text-4xl uppercase tracking-tight leading-tight">
                    {selectedCalcItem.name}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCalcItem(null)}
                  className="opacity-40 hover:opacity-100 transition-all p-2"
                >
                  <Plus className="w-6 h-6 md:w-8 md:h-8 rotate-45" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-end">
                <div className="space-y-6 md:space-y-8">
                  <div className="space-y-2">
                    <span className="font-mono text-[8px] uppercase tracking-widest opacity-30">Weight Selection (Kg)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={modalWeight || ""}
                      onChange={(e) => setModalWeight(Number(e.target.value))}
                      className="w-full bg-transparent border-b border-ink-faint p-0 font-mono text-4xl md:text-5xl font-bold text-accent focus:ring-0 placeholder:opacity-10"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {presets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setModalWeight(p)}
                        className={`font-mono text-[9px] font-bold uppercase tracking-widest py-2 rounded border transition-all ${
                          modalWeight === p ? "bg-accent text-bg border-accent" : "opacity-30 border-ink-faint hover:opacity-100"
                        }`}
                      >
                        {p}Kg
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-bg p-6 md:p-8 space-y-6 rounded border border-ink-faint">
                  <div className="space-y-4">
                    <div className="flex justify-between items-baseline">
                      <span className="font-mono text-[8px] font-bold text-accent uppercase tracking-widest">Total Bill</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-[9px] opacity-30 uppercase">Rs.</span>
                        <span className="font-mono text-2xl md:text-3xl font-bold leading-none tracking-tighter">
                          {calculatedTotalPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-baseline border-t border-ink-faint pt-4">
                      <span className="font-mono text-[8px] uppercase tracking-widest opacity-30">Raw Chicken</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-lg md:text-xl font-bold tracking-tighter">
                          {rawChickenNeeded}
                        </span>
                        <span className="font-mono text-[9px] opacity-30 uppercase">KG</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={modalWeight <= 0}
                    onClick={() => {
                      addToCart(selectedCalcItem.key, selectedCalcItem.name, pricePerKg, modalWeight);
                      setSelectedCalcItem(null);
                    }}
                    className="w-full bg-accent text-bg py-4 rounded font-mono text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Add to Sheet
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Formula Modal */}
      {editingFormulaItem && (
        <div className="fixed inset-0 bg-bg/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-accent/30 rounded-2xl p-6 max-w-md w-full space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-3 border-b border-ink-faint pb-4">
              <div className="p-2.5 bg-accent/10 text-accent rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-sm md:text-base uppercase tracking-tight text-accent">
                  Formula Edit Karain
                </h3>
                <p className="font-mono text-[9px] opacity-40 uppercase tracking-widest">
                  Item Code: {editingFormulaItem.key}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[8px] opacity-40 mb-1 uppercase tracking-widest">
                  Item / Grill Name
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
                <input
                  type="text"
                  required
                  value={editItemExpression}
                  onChange={(e) => setEditItemExpression(e.target.value)}
                  className="w-full bg-bg border border-ink-faint rounded-xl px-4 py-2.5 font-mono text-xs font-bold text-accent focus:ring-1 focus:ring-accent outline-none appearance-none"
                  placeholder="e.g. supply * 1.5 + 50"
                />
                <p className="font-mono text-[8px] opacity-30 mt-1 italic">
                  E.g., supply * 1.9 ya phir (supply + 14) * 1.5
                </p>
              </div>

              {/* Preview with current raw rate */}
              <div className="bg-bg/40 border border-ink-faint rounded-xl p-4 font-mono text-xs space-y-1.5">
                <span className="text-[8px] opacity-30 uppercase tracking-widest block font-bold">Naya Rate Preview</span>
                <div className="flex justify-between items-center">
                  <span className="opacity-50">Base Supply Rate:</span>
                  <span className="font-bold">Rs. {customBaseRate}</span>
                </div>
                <div className="flex justify-between items-center border-t border-dashed border-ink-faint pt-2 mt-2">
                  <span className="opacity-50">Calculated Sale Price:</span>
                  <span className="font-bold text-accent text-sm">
                    {(() => {
                      try {
                        const clean = editItemExpression.toLowerCase().replace(/supply/g, customBaseRate.toString());
                        const res = evaluate(clean);
                        return isNaN(Number(res)) ? "Error" : `Rs. ${Math.round(Number(res))}`;
                      } catch (e) {
                        return "Invalid Formula";
                      }
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!editItemName.trim()) {
                    alert("Naam likhein!");
                    return;
                  }
                  if (!editItemExpression.trim()) {
                    alert("Formula expression likhein!");
                    return;
                  }
                  try {
                    // Test evaluate
                    evaluate(editItemExpression.toLowerCase().replace(/supply/g, "100"));
                  } catch (e) {
                    alert("Formula sahi nahi hai. Bara-e-maherbani check karein.");
                    return;
                  }

                  if (onSaveSettings) {
                    setSavingFormula(true);
                    try {
                      const updatedItems = {
                        ...settings.items,
                        [editingFormulaItem.key]: {
                          ...settings.items[editingFormulaItem.key],
                          name: editItemName.trim(),
                          expression: editItemExpression.trim(),
                        },
                      };
                      await onSaveSettings({
                        ...settings,
                        items: updatedItems,
                      });
                      setEditingFormulaItem(null);
                    } catch (err) {
                      console.error(err);
                      alert("Formula save karne mein masla pesh aya.");
                    } finally {
                      setSavingFormula(false);
                    }
                  } else {
                    alert("Saving is not available in guest mode.");
                  }
                }}
                disabled={savingFormula}
                className="flex-1 bg-accent text-bg py-3 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                {savingFormula ? "Saving..." : "Save Formula"}
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

      {/* Formula Item Held Action Options Modal */}
      {longPressActionItem && (
        <div className="fixed inset-0 bg-bg/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-accent/20 rounded-2xl p-6 max-w-sm w-full space-y-6 relative">
            <div className="space-y-2 text-center">
              <span className="font-mono text-[9px] text-accent font-bold uppercase tracking-[0.2em] block">
                Grill Menu Option
              </span>
              <h3 className="font-display text-base md:text-lg text-ink font-bold">
                {longPressActionItem.name}
              </h3>
              <p className="font-mono text-[10px] opacity-40">
                Formula: {longPressActionItem.formula?.expression || `supply * ${longPressActionItem.formula?.multiplier || 1} + ${longPressActionItem.formula?.markup || 0}`}
              </p>
            </div>

            <div className="space-y-3">
              {/* EDIT OPTION */}
              <button
                type="button"
                onClick={() => {
                  setEditingFormulaItem(longPressActionItem);
                  setEditItemName(longPressActionItem.name);
                  setEditItemExpression(longPressActionItem.formula?.expression || `supply * ${longPressActionItem.formula?.multiplier || 1} + ${longPressActionItem.formula?.markup || 0}`);
                  setLongPressActionItem(null);
                }}
                className="w-full bg-accent/10 border border-accent/20 hover:bg-accent hover:text-bg text-accent transition-all duration-200 py-3.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Formula Edit Karain
              </button>

              {/* DELETE OPTION */}
              <button
                type="button"
                onClick={() => handleDeleteFormulaItem(longPressActionItem.key)}
                disabled={deletingFormula}
                className="w-full bg-surface border border-ink-faint hover:bg-accent hover:text-bg text-ink/70 transition-all duration-200 py-3.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {deletingFormula ? "Deleting..." : "Item Delete Karain"}
              </button>

              {/* CANCEL */}
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
    </div>
  );
}
