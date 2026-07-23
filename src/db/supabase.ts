import { supabase } from "../lib/supabase";
import { SupplyLog, SupplierPayment, FormulaSettings, Order, Expense, Supplier, DailyRate } from "../types";
import { DEFAULT_FORMULA_SETTINGS } from "../constants";

// ---------------- SYNC STATUS TRACKING ----------------
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';
let currentSyncStatus: SyncStatus = 'idle';
const syncListeners: ((status: SyncStatus) => void)[] = [];

export function subscribeSyncStatus(callback: (status: SyncStatus) => void) {
  syncListeners.push(callback);
  callback(currentSyncStatus);
  return () => {
    const index = syncListeners.indexOf(callback);
    if (index > -1) syncListeners.splice(index, 1);
  };
}

function setSyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
  syncListeners.forEach(cb => cb(status));
  // Keep success/error status for a few seconds before going back to idle
  if (status === 'success' || status === 'error') {
    setTimeout(() => {
      if (currentSyncStatus === status) {
        setSyncStatus('idle');
      }
    }, 4000);
  }
}

// ---------------- LOCAL STORAGE FALLBACKS ----------------
const LOCAL_STORAGE_KEYS = {
  SETTINGS: "tikka_settings",
  SUPPLY_LOGS: "tikka_supply_logs",
  PAYMENTS: "tikka_payments",
  EXPENSES: "tikka_expenses",
  ORDERS: "tikka_orders",
  SUPPLIERS: "tikka_suppliers",
};

function getLocalData<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    console.error("Local storage read error for key " + key, e);
    return defaultValue;
  }
}

function saveLocalData<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Local storage write error for key " + key, e);
  }
}

// ---------------- EVENT EMITTER FOR OPTIMISTIC UI ----------------
type DataListeners = {
  settings: ((data: FormulaSettings) => void)[];
  supply_logs: ((data: SupplyLog[]) => void)[];
  payments: ((data: SupplierPayment[]) => void)[];
  expenses: ((data: Expense[]) => void)[];
  orders: ((data: Order[]) => void)[];
  suppliers: ((data: Supplier[]) => void)[];
};

const dataListeners: DataListeners = {
  settings: [],
  supply_logs: [],
  payments: [],
  expenses: [],
  orders: [],
  suppliers: [],
};

function notifyDataSubscribers(table: keyof DataListeners, data: any) {
  dataListeners[table].forEach(cb => cb(data));
}

// ---------------- DB METHODS ----------------

// 1. Settings DB Methods
export async function getFormulaSettings(): Promise<FormulaSettings> {
  try {
    const { data, error } = await supabase
      .from('formula_settings')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        await saveFormulaSettings(DEFAULT_FORMULA_SETTINGS);
        return DEFAULT_FORMULA_SETTINGS;
      }
      console.error("Supabase settings read error detail:", error.message, error.details, error.hint);
      throw error;
    }
    
    // Map DB snake_case back to app camelCase
    const d = data as any;
    const settings = {
      shopName: d.shop_name || DEFAULT_FORMULA_SETTINGS.shopName,
      baseRawRate: d.base_raw_rate !== undefined ? Number(d.base_raw_rate) : DEFAULT_FORMULA_SETTINGS.baseRawRate,
      items: d.items || DEFAULT_FORMULA_SETTINGS.items,
      supplierUsername: d.supplier_username || DEFAULT_FORMULA_SETTINGS.supplierUsername,
      supplierPassword: d.supplier_password || DEFAULT_FORMULA_SETTINGS.supplierPassword,
      supplierAccessEnabled: d.supplier_access_enabled ?? DEFAULT_FORMULA_SETTINGS.supplierAccessEnabled,
      gitRepositoryUrl: d.git_repository_url || DEFAULT_FORMULA_SETTINGS.gitRepositoryUrl,
      mobileNavItems: d.mobile_nav_items || undefined,
      sidebarNavItems: d.sidebar_nav_items || undefined
    };
    saveLocalData(LOCAL_STORAGE_KEYS.SETTINGS, settings);
    notifyDataSubscribers('settings', settings);
    return settings;
  } catch (e: any) {
    console.warn("Supabase settings read failed:", e.message || e);
    return getLocalData<FormulaSettings>(LOCAL_STORAGE_KEYS.SETTINGS, DEFAULT_FORMULA_SETTINGS);
  }
}

export async function saveFormulaSettings(settings: FormulaSettings): Promise<void> {
  // 1. Save locally first
  saveLocalData(LOCAL_STORAGE_KEYS.SETTINGS, settings);
  notifyDataSubscribers('settings', settings);
  
  // 2. Set sync status
  setSyncStatus('syncing');

  try {
    // Map app camelCase to DB snake_case
    const upsertData = {
      id: 1,
      shop_name: settings.shopName,
      base_raw_rate: settings.baseRawRate,
      items: settings.items,
      supplier_username: settings.supplierUsername,
      supplier_password: settings.supplierPassword,
      supplier_access_enabled: settings.supplierAccessEnabled,
      git_repository_url: settings.gitRepositoryUrl,
      mobile_nav_items: settings.mobileNavItems || [],
      sidebar_nav_items: settings.sidebarNavItems || [],
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('formula_settings')
      .upsert(upsertData, { onConflict: 'id' });
    
    if (error) {
      console.error("Supabase settings upsert error detail:", error.message, error.details, error.hint);
      throw error;
    }
    setSyncStatus('success');
  } catch (e: any) {
    console.error("Supabase settings save failed:", e.message || e);
    setSyncStatus('error');
  }
}

// 2. Daily Rates DB Methods
const DAILY_RATES_KEY = "tikka_daily_rates";

export function subscribeDailyRates(onUpdate: (rates: Record<string, number>) => void): () => void {
  const fetchRates = async () => {
    const { data } = await supabase
      .from('daily_rates')
      .select('*')
      .order('date', { ascending: false });
    
    if (data) {
      const ratesMap: Record<string, number> = {};
      (data as any[]).forEach(d => { ratesMap[d.date] = Number(d.rate); });
      saveLocalData(DAILY_RATES_KEY, ratesMap);
      onUpdate(ratesMap);
    } else {
      const local = getLocalData<Record<string, number>>(DAILY_RATES_KEY, {});
      onUpdate(local);
    }
  };
  fetchRates();
  return () => {};
}

export async function getDailyRate(date: string): Promise<number | null> {
  const { data } = await supabase
    .from('daily_rates')
    .select('rate')
    .eq('date', date)
    .single();
  if (data) return Number(data.rate);
  return null;
}

export async function saveDailyRate(date: string, rate: number): Promise<void> {
  const localRates = getLocalData<Record<string, number>>(DAILY_RATES_KEY, {});
  localRates[date] = rate;
  saveLocalData(DAILY_RATES_KEY, localRates);
  notifyDataSubscribers('settings', { dailyRates: localRates } as any);

  setSyncStatus('syncing');
  try {
    const { error } = await supabase
      .from('daily_rates')
      .upsert({ date, rate }, { onConflict: 'date' });
    if (error) throw error;
    setSyncStatus('success');
  } catch (e: any) {
    console.error("Failed to save daily rate:", e.message || e);
    setSyncStatus('error');
  }
}

export function getLocalDailyRate(date: string): number | null {
  const rates = getLocalData<Record<string, number>>(DAILY_RATES_KEY, {});
  return rates[date] ?? null;
}

export function getAllLocalDailyRates(): Record<string, number> {
  return getLocalData<Record<string, number>>(DAILY_RATES_KEY, {});
}

// 3. Supply Logs DB Methods
export function subscribeSupplyLogs(onUpdate: (logs: SupplyLog[]) => void): () => void {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  // Register listener
  dataListeners.supply_logs.push(onUpdate);
  
  const fetchLogs = async () => {
    const { data } = await supabase
      .from('supply_logs')
      .select('*')
      .order('date', { ascending: false });
    
    if (data) {
      const mappedLogs: SupplyLog[] = (data as any[]).map(d => ({
        id: d.id,
        date: d.date,
        supplierId: d.supplier_id,
        category: d.category,
        weightKg: Number(d.weight_kg),
        supplyRatePerKg: d.supply_rate_per_kg ? Number(d.supply_rate_per_kg) : (Number(d.total_cost) / Number(d.weight_kg)),
        totalCost: Number(d.total_cost),
        notes: d.notes
      }));
      saveLocalData(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, mappedLogs);
      notifyDataSubscribers('supply_logs', mappedLogs);
    }
  };

  fetchLogs();

  const channel = supabase
    .channel(`ch_logs_${uniqueId}_${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_logs' }, () => {
      fetchLogs();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    const index = dataListeners.supply_logs.indexOf(onUpdate);
    if (index > -1) dataListeners.supply_logs.splice(index, 1);
  };
}

export async function addSupplyLog(log: Omit<SupplyLog, "id">): Promise<string> {
  const tempId = "local_" + Date.now();
  
  // 1. Save locally first (optimistic)
  const currentLogs = getLocalData<SupplyLog[]>(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, []);
  const newLog = { ...log, id: tempId };
  const updatedLogs = [newLog, ...currentLogs];
  saveLocalData(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, updatedLogs);
  notifyDataSubscribers('supply_logs', updatedLogs);
  
  setSyncStatus('syncing');

  try {
    const dbData = {
      date: log.date,
      supplier_id: log.supplierId || null,
      category: log.category,
      weight_kg: log.weightKg,
      supply_rate_per_kg: log.supplyRatePerKg,
      total_cost: log.totalCost,
      notes: log.notes
    };

    const { data, error } = await supabase
      .from('supply_logs')
      .insert([dbData])
      .select()
      .single();
    
    if (error) {
      console.error("Supabase addSupplyLog error:", error);
      throw error;
    }
    
    setSyncStatus('success');
    return data.id;
  } catch (e) {
    console.error("Supabase addSupplyLog failed", e);
    setSyncStatus('error');
    return tempId;
  }
}

export async function updateSupplyLog(id: string, log: Partial<SupplyLog>): Promise<void> {
  // 1. Local update
  const currentLogs = getLocalData<SupplyLog[]>(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, []);
  const updatedLogs = currentLogs.map(l => l.id === id ? { ...l, ...log } : l);
  saveLocalData(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, updatedLogs);
  notifyDataSubscribers('supply_logs', updatedLogs);

  setSyncStatus('syncing');

  try {
    const dbData: any = {};
    if (log.date) dbData.date = log.date;
    if (log.supplierId) dbData.supplier_id = log.supplierId;
    if (log.category) dbData.category = log.category;
    if (log.weightKg !== undefined) dbData.weight_kg = log.weightKg;
    if (log.supplyRatePerKg !== undefined) dbData.supply_rate_per_kg = log.supplyRatePerKg;
    if (log.totalCost !== undefined) dbData.total_cost = log.totalCost;
    if (log.notes !== undefined) dbData.notes = log.notes;

    const { error } = await supabase
      .from('supply_logs')
      .update(dbData)
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase updateSupplyLog failed", e);
    setSyncStatus('error');
  }
}

export async function deleteSupplyLog(id: string): Promise<void> {
  // 1. Local update
  const currentLogs = getLocalData<SupplyLog[]>(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, []);
  const filteredLogs = currentLogs.filter(l => l.id !== id);
  saveLocalData(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, filteredLogs);
  notifyDataSubscribers('supply_logs', filteredLogs);

  setSyncStatus('syncing');

  try {
    const { error } = await supabase
      .from('supply_logs')
      .delete()
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase deleteSupplyLog failed", e);
    setSyncStatus('error');
  }
}

// 4. Payments DB Methods
export function subscribePayments(onUpdate: (payments: SupplierPayment[]) => void): () => void {
  const uniqueId = Math.random().toString(36).substring(2, 9);

  dataListeners.payments.push(onUpdate);

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('supplier_payments')
      .select('*')
      .order('date', { ascending: false });
    
    if (data) {
      const mappedPayments: SupplierPayment[] = (data as any[]).map(d => ({
        id: d.id,
        date: d.date,
        supplierId: d.supplier_id,
        amountPaid: Number(d.amount_paid),
        notes: d.notes
      }));
      saveLocalData(LOCAL_STORAGE_KEYS.PAYMENTS, mappedPayments);
      notifyDataSubscribers('payments', mappedPayments);
    }
  };

  fetchPayments();

  const channel = supabase
    .channel(`ch_payments_${uniqueId}_${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_payments' }, () => {
      fetchPayments();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    const index = dataListeners.payments.indexOf(onUpdate);
    if (index > -1) dataListeners.payments.splice(index, 1);
  };
}

export async function addPayment(payment: Omit<SupplierPayment, "id">): Promise<string> {
  const tempId = "local_" + Date.now();
  
  const currentPayments = getLocalData<SupplierPayment[]>(LOCAL_STORAGE_KEYS.PAYMENTS, []);
  const newPayment = { ...payment, id: tempId };
  const updatedPayments = [newPayment, ...currentPayments];
  saveLocalData(LOCAL_STORAGE_KEYS.PAYMENTS, updatedPayments);
  notifyDataSubscribers('payments', updatedPayments);

  setSyncStatus('syncing');

  try {
    const dbData = {
      date: payment.date,
      supplier_id: payment.supplierId || null,
      amount_paid: payment.amountPaid,
      notes: payment.notes
    };

    const { data, error } = await supabase
      .from('supplier_payments')
      .insert([dbData])
      .select()
      .single();
    if (error) {
      console.error("Supabase addPayment error:", error);
      throw error;
    }
    setSyncStatus('success');
    return data.id;
  } catch (e) {
    console.error("Supabase addPayment failed", e);
    setSyncStatus('error');
    return tempId;
  }
}

export async function updatePayment(id: string, payment: Partial<SupplierPayment>): Promise<void> {
  // 1. Local
  const currentPayments = getLocalData<SupplierPayment[]>(LOCAL_STORAGE_KEYS.PAYMENTS, []);
  const updatedPayments = currentPayments.map(p => p.id === id ? { ...p, ...payment } : p);
  saveLocalData(LOCAL_STORAGE_KEYS.PAYMENTS, updatedPayments);
  notifyDataSubscribers('payments', updatedPayments);

  setSyncStatus('syncing');

  try {
    const dbData: any = {};
    if (payment.date) dbData.date = payment.date;
    if (payment.supplierId) dbData.supplier_id = payment.supplierId;
    if (payment.amountPaid !== undefined) dbData.amount_paid = payment.amountPaid;
    if (payment.notes !== undefined) dbData.notes = payment.notes;

    const { error } = await supabase
      .from('supplier_payments')
      .update(dbData)
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase updatePayment failed", e);
    setSyncStatus('error');
  }
}

export async function deletePayment(id: string): Promise<void> {
  // 1. Local
  const currentPayments = getLocalData<SupplierPayment[]>(LOCAL_STORAGE_KEYS.PAYMENTS, []);
  const filteredPayments = currentPayments.filter(p => p.id !== id);
  saveLocalData(LOCAL_STORAGE_KEYS.PAYMENTS, filteredPayments);
  notifyDataSubscribers('payments', filteredPayments);

  setSyncStatus('syncing');

  try {
    const { error } = await supabase
      .from('supplier_payments')
      .delete()
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase deletePayment failed", e);
    setSyncStatus('error');
  }
}

// 5. Expenses DB Methods
export function subscribeExpenses(onUpdate: (expenses: Expense[]) => void): () => void {
  const uniqueId = Math.random().toString(36).substring(2, 9);

  dataListeners.expenses.push(onUpdate);

  const fetchExpenses = async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    
    if (data) {
      const mappedExpenses: Expense[] = (data as any[]).map(d => ({
        id: d.id,
        date: d.date,
        category: d.category,
        amount: Number(d.amount),
        notes: d.notes
      }));
      saveLocalData(LOCAL_STORAGE_KEYS.EXPENSES, mappedExpenses);
      notifyDataSubscribers('expenses', mappedExpenses);
    }
  };

  fetchExpenses();

  const channel = supabase
    .channel(`ch_expenses_${uniqueId}_${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
      fetchExpenses();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    const index = dataListeners.expenses.indexOf(onUpdate);
    if (index > -1) dataListeners.expenses.splice(index, 1);
  };
}

export async function addExpense(expense: Omit<Expense, "id">): Promise<string> {
  const tempId = "local_" + Date.now();
  
  const currentExpenses = getLocalData<Expense[]>(LOCAL_STORAGE_KEYS.EXPENSES, []);
  const newExpense = { ...expense, id: tempId };
  const updatedExpenses = [newExpense, ...currentExpenses];
  saveLocalData(LOCAL_STORAGE_KEYS.EXPENSES, updatedExpenses);
  notifyDataSubscribers('expenses', updatedExpenses);

  setSyncStatus('syncing');

  try {
    const dbData = {
      date: expense.date,
      category: expense.category,
      amount: expense.amount,
      notes: expense.notes
    };

    const { data, error } = await supabase
      .from('expenses')
      .insert([dbData])
      .select()
      .single();
    if (error) {
      console.error("Supabase addExpense error:", error);
      throw error;
    }
    setSyncStatus('success');
    return data.id;
  } catch (e) {
    console.error("Supabase addExpense failed", e);
    setSyncStatus('error');
    return tempId;
  }
}

export async function updateExpense(id: string, expense: Partial<Expense>): Promise<void> {
  // 1. Local
  const currentExpenses = getLocalData<Expense[]>(LOCAL_STORAGE_KEYS.EXPENSES, []);
  const updatedExpenses = currentExpenses.map(e => e.id === id ? { ...e, ...expense } : e);
  saveLocalData(LOCAL_STORAGE_KEYS.EXPENSES, updatedExpenses);
  notifyDataSubscribers('expenses', updatedExpenses);

  setSyncStatus('syncing');

  try {
    const dbData: any = {};
    if (expense.date) dbData.date = expense.date;
    if (expense.category) dbData.category = expense.category;
    if (expense.amount !== undefined) dbData.amount = expense.amount;
    if (expense.notes !== undefined) dbData.notes = expense.notes;

    const { error } = await supabase
      .from('expenses')
      .update(dbData)
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase updateExpense failed", e);
    setSyncStatus('error');
  }
}

export async function deleteExpense(id: string): Promise<void> {
  // 1. Local
  const currentExpenses = getLocalData<Expense[]>(LOCAL_STORAGE_KEYS.EXPENSES, []);
  const filteredExpenses = currentExpenses.filter(e => e.id !== id);
  saveLocalData(LOCAL_STORAGE_KEYS.EXPENSES, filteredExpenses);
  notifyDataSubscribers('expenses', filteredExpenses);

  setSyncStatus('syncing');

  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase deleteExpense failed", e);
    setSyncStatus('error');
  }
}

// 6. Orders DB Methods
export function subscribeOrders(onUpdate: (orders: Order[]) => void): () => void {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  dataListeners.orders.push(onUpdate);
  
  const fetchOrders = async () => {
    // Attempt to fetch from normalized schema or fallback to JSON items
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('timestamp', { ascending: false });
    
    if (data) {
      const mappedOrders: Order[] = (data as any[]).map(d => ({
        id: d.id,
        timestamp: Number(d.timestamp),
        date: d.date,
        customerName: d.customer_name || "",
        // If order_items exist, use them. Otherwise, check if d.items is JSON
        items: d.order_items ? d.order_items.map((it: any) => ({
          itemKey: it.item_key || "",
          name: it.item_name,
          price: Number(it.price),
          quantity: Number(it.quantity),
          total: Number(it.subtotal || (it.price * it.quantity))
        })) : (d.items || []),
        totalAmount: Number(d.total_amount),
        status: d.status as any
      }));
      saveLocalData(LOCAL_STORAGE_KEYS.ORDERS, mappedOrders);
      notifyDataSubscribers('orders', mappedOrders);
    } else {
      // Fallback if the join fails (maybe table doesn't exist yet)
      const { data: simpleData } = await supabase
        .from('orders')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (simpleData) {
        const mappedOrders: Order[] = (simpleData as any[]).map(d => ({
          id: d.id,
          timestamp: Number(d.timestamp),
          date: d.date,
          customerName: d.customer_name || "",
          items: d.items || [],
          totalAmount: Number(d.total_amount),
          status: d.status as any
        }));
        saveLocalData(LOCAL_STORAGE_KEYS.ORDERS, mappedOrders);
        notifyDataSubscribers('orders', mappedOrders);
      }
    }
  };

  fetchOrders();

  const channel = supabase
    .channel(`ch_orders_${uniqueId}_${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      fetchOrders();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    const index = dataListeners.orders.indexOf(onUpdate);
    if (index > -1) dataListeners.orders.splice(index, 1);
  };
}

export async function addOrder(order: Omit<Order, "id">): Promise<string> {
  const tempId = "local_" + Date.now();
  
  const currentOrders = getLocalData<Order[]>(LOCAL_STORAGE_KEYS.ORDERS, []);
  const newOrder = { ...order, id: tempId } as Order;
  const updatedOrders = [newOrder, ...currentOrders];
  saveLocalData(LOCAL_STORAGE_KEYS.ORDERS, updatedOrders);
  notifyDataSubscribers('orders', updatedOrders);

  setSyncStatus('syncing');

  try {
    // 1. Insert the main order
    const dbData = {
      timestamp: order.timestamp,
      date: order.date,
      total_amount: order.totalAmount,
      status: order.status
    };

    const { data, error } = await supabase
      .from('orders')
      .insert([dbData])
      .select()
      .single();

    if (error) {
      console.error("Supabase addOrder error:", error);
      throw error;
    }

    const orderId = data.id;

    // 2. Insert items if table exists
    const orderItems = order.items.map(item => ({
      order_id: orderId,
      item_name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.total
    }));

    await supabase.from('order_items').insert(orderItems);

    setSyncStatus('success');
    return orderId;
  } catch (e) {
    console.error("Supabase addOrder failed", e);
    setSyncStatus('error');
    return tempId;
  }
}

export async function deleteOrder(id: string): Promise<void> {
  // 1. Local
  const currentOrders = getLocalData<Order[]>(LOCAL_STORAGE_KEYS.ORDERS, []);
  const filteredOrders = currentOrders.filter(o => o.id !== id);
  saveLocalData(LOCAL_STORAGE_KEYS.ORDERS, filteredOrders);
  notifyDataSubscribers('orders', filteredOrders);

  setSyncStatus('syncing');

  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase deleteOrder failed", e);
    setSyncStatus('error');
  }
}

export async function updateOrder(id: string, order: Partial<Order>): Promise<void> {
  const currentOrders = getLocalData<Order[]>(LOCAL_STORAGE_KEYS.ORDERS, []);
  const updatedOrders = currentOrders.map(o => o.id === id ? { ...o, ...order } : o);
  saveLocalData(LOCAL_STORAGE_KEYS.ORDERS, updatedOrders);
  notifyDataSubscribers('orders', updatedOrders);

  setSyncStatus('syncing');

  try {
    const dbData: any = {};
    if (order.items) {
      dbData.items = order.items;
      dbData.total_amount = order.totalAmount;
    }
    if (order.status) dbData.status = order.status;
    if (order.customerName !== undefined) dbData.customer_name = order.customerName;

    const { error } = await supabase
      .from('orders')
      .update(dbData)
      .eq('id', id);
    if (error) throw error;

    if (order.items) {
      await supabase.from('order_items').delete().eq('order_id', id);
      const orderItems = order.items.map(item => ({
        order_id: id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.total
      }));
      await supabase.from('order_items').insert(orderItems);
    }

    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase updateOrder failed", e);
    setSyncStatus('error');
  }
}

export async function updateOrderStatus(id: string, status: 'Paid' | 'Unpaid'): Promise<void> {
  // 1. Local
  const currentOrders = getLocalData<Order[]>(LOCAL_STORAGE_KEYS.ORDERS, []);
  const updatedOrders = currentOrders.map(o => o.id === id ? { ...o, status } : o);
  saveLocalData(LOCAL_STORAGE_KEYS.ORDERS, updatedOrders);
  notifyDataSubscribers('orders', updatedOrders);

  setSyncStatus('syncing');

  try {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase updateOrderStatus failed", e);
    setSyncStatus('error');
  }
}

// 7. Suppliers DB Methods
export function subscribeSuppliers(onUpdate: (suppliers: Supplier[]) => void): () => void {
  const uniqueId = Math.random().toString(36).substring(2, 9);

  dataListeners.suppliers.push(onUpdate);

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (data) {
      const mappedSuppliers: Supplier[] = (data as any[]).map(d => ({
        id: d.id,
        name: d.name,
        color: d.color,
        username: d.username,
        password: d.password,
        category: d.category,
        createdAt: d.created_at_long ? Number(d.created_at_long) : undefined
      }));
      saveLocalData(LOCAL_STORAGE_KEYS.SUPPLIERS, mappedSuppliers);
      notifyDataSubscribers('suppliers', mappedSuppliers);
    }
  };

  fetchSuppliers();

  const channel = supabase
    .channel(`ch_suppliers_${uniqueId}_${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => {
      fetchSuppliers();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    const index = dataListeners.suppliers.indexOf(onUpdate);
    if (index > -1) dataListeners.suppliers.splice(index, 1);
  };
}

export async function addSupplier(supplier: Omit<Supplier, "id">): Promise<string> {
  const tempId = "local_" + Date.now();
  
  const currentSuppliers = getLocalData<Supplier[]>(LOCAL_STORAGE_KEYS.SUPPLIERS, []);
  const newSupplier = { ...supplier, id: tempId };
  const updatedSuppliers = [...currentSuppliers, newSupplier];
  saveLocalData(LOCAL_STORAGE_KEYS.SUPPLIERS, updatedSuppliers);
  notifyDataSubscribers('suppliers', updatedSuppliers);

  setSyncStatus('syncing');

  try {
    const dbData: any = {
      name: supplier.name,
      color: supplier.color,
      username: supplier.username,
      password: supplier.password
    };
    if (supplier.category) dbData.category = supplier.category;

    const { data, error } = await supabase
      .from('suppliers')
      .insert([dbData])
      .select()
      .single();
    if (error) {
      console.error("Supabase addSupplier error:", error);
      throw error;
    }
    setSyncStatus('success');
    return data.id;
  } catch (e) {
    console.error("Supabase addSupplier failed", e);
    setSyncStatus('error');
    return tempId;
  }
}

export async function updateSupplier(id: string, supplier: Partial<Supplier>): Promise<void> {
  // 1. Local
  const currentSuppliers = getLocalData<Supplier[]>(LOCAL_STORAGE_KEYS.SUPPLIERS, []);
  const updatedSuppliers = currentSuppliers.map(s => s.id === id ? { ...s, ...supplier } : s);
  saveLocalData(LOCAL_STORAGE_KEYS.SUPPLIERS, updatedSuppliers);
  notifyDataSubscribers('suppliers', updatedSuppliers);

  setSyncStatus('syncing');

  try {
    const dbData: any = {};
    if (supplier.name) dbData.name = supplier.name;
    if (supplier.color) dbData.color = supplier.color;
    if (supplier.username) dbData.username = supplier.username;
    if (supplier.password) dbData.password = supplier.password;
    if (supplier.category) dbData.category = supplier.category;
    if (supplier.createdAt !== undefined) dbData.created_at_long = supplier.createdAt;

    const { error } = await supabase
      .from('suppliers')
      .update(dbData)
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase updateSupplier failed", e);
    setSyncStatus('error');
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  // 1. Delete related supply logs (local)
  const currentLogs = getLocalData<SupplyLog[]>(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, []);
  const filteredLogs = currentLogs.filter(l => l.supplierId !== id);
  saveLocalData(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, filteredLogs);
  notifyDataSubscribers('supply_logs', filteredLogs);

  // 2. Delete related payments (local)
  const currentPayments = getLocalData<SupplierPayment[]>(LOCAL_STORAGE_KEYS.PAYMENTS, []);
  const filteredPayments = currentPayments.filter(p => p.supplierId !== id);
  saveLocalData(LOCAL_STORAGE_KEYS.PAYMENTS, filteredPayments);
  notifyDataSubscribers('payments', filteredPayments);

  // 3. Delete supplier (local)
  const currentSuppliers = getLocalData<Supplier[]>(LOCAL_STORAGE_KEYS.SUPPLIERS, []);
  const filteredSuppliers = currentSuppliers.filter(s => s.id !== id);
  saveLocalData(LOCAL_STORAGE_KEYS.SUPPLIERS, filteredSuppliers);
  notifyDataSubscribers('suppliers', filteredSuppliers);

  setSyncStatus('syncing');

  try {
    // 4. Delete related supply logs (supabase)
    const { error: logsError } = await supabase
      .from('supply_logs')
      .delete()
      .eq('supplier_id', id);
    if (logsError) throw logsError;

    // 5. Delete related payments (supabase)
    const { error: paysError } = await supabase
      .from('supplier_payments')
      .delete()
      .eq('supplier_id', id);
    if (paysError) throw paysError;

    // 6. Delete supplier (supabase)
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase deleteSupplier failed", e);
    setSyncStatus('error');
  }
}

// 8. Reset All Data (keeps formula_settings and suppliers)
export async function resetAllData(): Promise<void> {
  const tables = ['supply_logs', 'supplier_payments', 'expenses', 'orders', 'order_items'];

  // 1. Clear local storage
  saveLocalData(LOCAL_STORAGE_KEYS.SUPPLY_LOGS, []);
  saveLocalData(LOCAL_STORAGE_KEYS.PAYMENTS, []);
  saveLocalData(LOCAL_STORAGE_KEYS.EXPENSES, []);
  saveLocalData(LOCAL_STORAGE_KEYS.ORDERS, []);
  notifyDataSubscribers('supply_logs', []);
  notifyDataSubscribers('payments', []);
  notifyDataSubscribers('expenses', []);
  notifyDataSubscribers('orders', []);

  setSyncStatus('syncing');

  try {
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== 'PGRST116') throw error;
    }
    setSyncStatus('success');
  } catch (e) {
    console.error("Supabase resetAllData failed", e);
    setSyncStatus('error');
    throw e;
  }
}

// Indicators
export function isSupabaseActive(): boolean {
  return !!supabase;
}
