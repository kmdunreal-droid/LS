import React, { useState } from "react";
import { Order, SupplyLog, SupplierPayment, Expense, Supplier } from "../types";
import { CalendarDays, ShoppingCart, Package, TrendingDown, RefreshCw, X } from "lucide-react";

interface HistorySectionProps {
  orders: Order[];
  supplyLogs: SupplyLog[];
  payments: SupplierPayment[];
  expenses: Expense[];
  suppliers: Supplier[];
  onClose: () => void;
}

export default function HistorySection({
  orders,
  supplyLogs,
  payments,
  expenses,
  suppliers,
  onClose
}: HistorySectionProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Filter all records by selected date
  const dayOrders = orders.filter((o) => o.date === selectedDate);
  const daySupplies = supplyLogs.filter((s) => s.date === selectedDate);
  const dayPayments = payments.filter((p) => p.date === selectedDate);
  const dayExpenses = expenses.filter((e) => e.date === selectedDate);

  // Compute totals
  const totalSales = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalSuppliesCost = daySupplies.reduce((sum, s) => sum + s.totalCost, 0);
  const totalPayments = dayPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalExpensesCost = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

  const netProfit = totalSales - (totalSuppliesCost + totalExpensesCost);

  return (
    <div className="bg-surface border border-accent/20 p-6 md:p-10 space-y-6 md:space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 relative rounded-lg">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent/40">Archive</span>
          <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight">Daily History</h3>
        </div>
        <button onClick={onClose} className="opacity-10 hover:opacity-100 transition-opacity">
          <X className="w-5 h-5 md:w-6 md:h-6" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="space-y-2 flex-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-30">Select Date</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">
              <CalendarDays className="w-4 h-4" />
            </span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-bg border border-ink-faint rounded pl-10 pr-4 py-3 font-mono text-sm focus:ring-1 focus:ring-accent outline-none appearance-none"
            />
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="bg-bg border border-ink-faint rounded p-4 flex flex-col justify-center">
            <span className="font-mono text-[8px] uppercase tracking-widest opacity-30">Total Sales</span>
            <span className="font-mono text-lg font-bold">Rs. {totalSales.toLocaleString()}</span>
          </div>
          <div className="bg-bg border border-ink-faint rounded p-4 flex flex-col justify-center">
            <span className="font-mono text-[8px] uppercase tracking-widest opacity-30">Net Profit</span>
            <span className="font-mono text-lg font-bold text-accent">Rs. {netProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Sales Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-ink-faint pb-2">
            <ShoppingCart className="w-4 h-4 opacity-50" />
            <span className="font-mono text-[10px] uppercase tracking-widest">Sales Orders</span>
            <span className="ml-auto font-mono text-[10px] opacity-30">{dayOrders.length} records</span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {dayOrders.length === 0 ? (
              <p className="font-mono text-[10px] opacity-30 italic text-center py-4">No sales on this date</p>
            ) : (
              dayOrders.map(order => (
                <div key={order.id} className="bg-bg border border-ink-faint p-3 rounded flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="font-mono text-[9px] font-bold uppercase block">{order.customerName}</span>
                    <span className="font-mono text-[8px] opacity-40 uppercase block">{order.items.length} items</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-ink">Rs. {order.totalAmount.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supplies Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-ink-faint pb-2">
            <Package className="w-4 h-4 opacity-50" />
            <span className="font-mono text-[10px] uppercase tracking-widest">Supply Arrivals</span>
            <span className="ml-auto font-mono text-[10px] opacity-30">{daySupplies.length} records</span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {daySupplies.length === 0 ? (
              <p className="font-mono text-[10px] opacity-30 italic text-center py-4">No supplies on this date</p>
            ) : (
              daySupplies.map(supply => {
                const supplier = suppliers.find(s => s.id === supply.supplierId);
                return (
                  <div key={supply.id} className="bg-bg border border-ink-faint p-3 rounded flex justify-between items-center">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] font-bold uppercase text-accent block">{supplier?.name || "Unknown"}</span>
                      <span className="font-mono text-[8px] opacity-40 uppercase block">{supply.weightKg}kg @ Rs.{supply.supplyRatePerKg}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-ink">Rs. {supply.totalCost.toLocaleString()}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Payments Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-ink-faint pb-2">
            <RefreshCw className="w-4 h-4 opacity-50" />
            <span className="font-mono text-[10px] uppercase tracking-widest">Supplier Payments</span>
            <span className="ml-auto font-mono text-[10px] opacity-30">{dayPayments.length} records</span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {dayPayments.length === 0 ? (
              <p className="font-mono text-[10px] opacity-30 italic text-center py-4">No payments on this date</p>
            ) : (
              dayPayments.map(payment => {
                const supplier = suppliers.find(s => s.id === payment.supplierId);
                return (
                  <div key={payment.id} className="bg-bg border border-ink-faint p-3 rounded flex justify-between items-center">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] font-bold uppercase text-emerald-custom block">{supplier?.name || "Unknown"}</span>
                      <span className="font-mono text-[8px] opacity-40 uppercase block truncate max-w-[150px]">{payment.notes || "Payment"}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-ink">Rs. {payment.amountPaid.toLocaleString()}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Expenses Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-ink-faint pb-2">
            <TrendingDown className="w-4 h-4 opacity-50" />
            <span className="font-mono text-[10px] uppercase tracking-widest">Expenses</span>
            <span className="ml-auto font-mono text-[10px] opacity-30">{dayExpenses.length} records</span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {dayExpenses.length === 0 ? (
              <p className="font-mono text-[10px] opacity-30 italic text-center py-4">No expenses on this date</p>
            ) : (
              dayExpenses.map(expense => (
                <div key={expense.id} className="bg-bg border border-ink-faint p-3 rounded flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="font-mono text-[9px] font-bold uppercase text-red-500 block">{expense.category}</span>
                    <span className="font-mono text-[8px] opacity-40 uppercase block truncate max-w-[150px]">{expense.notes || "Expense"}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-ink">Rs. {expense.amount.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
