export interface Supplier {
  id: string;
  name: string;
  color: string; // color code for supplier
  username?: string;
  password?: string;
  category?: string;
  createdAt: number;
}

export interface SupplyLog {
  id: string;
  supplierId?: string; // ID of the supplier
  date: string; // YYYY-MM-DD
  weightKg: number;
  supplyRatePerKg: number;
  totalCost: number; // weightKg * supplyRatePerKg
  notes: string;
  category?: string; // category of chicken, e.g. Whole Chicken, Chest/Boneless, etc.
}

export interface SupplierPayment {
  id: string;
  supplierId?: string; // ID of the supplier
  date: string; // YYYY-MM-DD
  amountPaid: number;
  notes: string;
}

export interface ItemFormula {
  name: string;
  multiplier?: number; // legacy
  markup?: number; // legacy
  expression?: string; // New: e.g. "supply * 1.5 + 50"
}

export interface FormulaSettings {
  shopName?: string;
  baseRawRate: number; // base supplier chicken rate per kg
  items: Record<string, ItemFormula>;
  supplierUsername?: string;
  supplierPassword?: string;
  supplierAccessEnabled?: boolean;
  gitRepositoryUrl?: string;
  mobileNavItems?: string[]; // IDs of nav items for mobile bottom bar
  sidebarNavItems?: string[]; // IDs of nav items for desktop sidebar
}

export interface OrderItem {
  itemKey: string;
  name: string;
  price: number;
  quantity: number; // plates, skewers, pieces, or kg depending on setup
  total: number;
}

export interface Order {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  customerName?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'Paid' | 'Unpaid';
}

export interface DailyRate {
  date: string;
  rate: number;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: string; // e.g. coal, spices, rent, staff, other
  amount: number;
  notes: string;
}
