"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

interface OrderRecord {
  id: string;
  orderId: string;
  customerId: string;
  productName: string;
  productCategory: string;
  amount: number;
  currency: string;
  purchaseDate: string;
  deliveryDate?: string;
  status: string;
  condition: string;
  finalSale: boolean;
  clearance: boolean;
  fraudFlag: boolean;
  customer?: { name: string; email: string };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function fetchOrders() {
      try {
        const res = await fetch("/api/admin/orders");
        const data = await res.json();
        if (!ignore && res.ok) {
          setOrders(data.orders || []);
        }
      } catch (err) {
        console.error("Failed to fetch orders:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchOrders();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-indigo-400" /> Order Database & Policy Flags
        </h1>
        <p className="text-xs text-slate-400">
          Complete database view of purchase dates, delivery status, condition, and security flags.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Order ID</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Product</th>
                <th className="px-4 py-3.5">Amount</th>
                <th className="px-4 py-3.5">Delivery Date</th>
                <th className="px-4 py-3.5">Condition</th>
                <th className="px-4 py-3.5">Policy Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-900/50 transition">
                  <td className="px-4 py-3 font-mono text-indigo-300 font-semibold">{o.orderId}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-200">{o.customer?.name || o.customerId}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{o.customerId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-200 font-medium">{o.productName}</div>
                    <div className="text-[10px] text-slate-500">{o.productCategory}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-indigo-300 font-mono">${o.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : <span className="text-amber-400 font-semibold">NOT DELIVERED</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        o.condition === "UNUSED"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : o.condition === "DAMAGED"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {o.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {o.finalSale && (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 border border-rose-500/30">
                          FINAL SALE
                        </span>
                      )}
                      {o.clearance && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30">
                          CLEARANCE
                        </span>
                      )}
                      {o.fraudFlag && (
                        <span className="rounded bg-red-600/30 px-1.5 py-0.5 text-[9px] font-bold text-red-300 border border-red-500/40 animate-pulse">
                          FRAUD FLAGGED
                        </span>
                      )}
                      {!o.finalSale && !o.clearance && !o.fraudFlag && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">STANDARD</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
