"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";

interface RefundRecord {
  id: string;
  refundId: string;
  orderId: string;
  customerId: string;
  amount: number;
  status: string;
  reason: string;
  createdAt: string;
  processedAt?: string;
  customer?: { name: string; email: string };
  order?: { productName: string };
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function fetchRefunds() {
      try {
        const res = await fetch("/api/admin/refunds");
        const data = await res.json();
        if (!ignore && res.ok) {
          setRefunds(data.refunds || []);
        }
      } catch (err) {
        console.error("Failed to fetch refunds:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchRefunds();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-indigo-400" /> Processed Refunds Registry
        </h1>
        <p className="text-xs text-slate-400">
          Complete database ledger of mock refunds issued and refused by the system.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Refund ID</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Order</th>
                <th className="px-4 py-3.5">Amount</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Recorded Reason</th>
                <th className="px-4 py-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading refund ledger...
                  </td>
                </tr>
              ) : refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No refunds recorded yet. Process an eligible refund in /chat to populate the ledger!
                  </td>
                </tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/50 transition">
                    <td className="px-4 py-3 font-mono text-indigo-300 font-semibold">{r.refundId}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">{r.customer?.name || r.customerId}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{r.customerId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-200">{r.orderId}</div>
                      <div className="text-[10px] text-slate-500">{r.order?.productName}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400 font-mono">${r.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          r.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : r.status === "DENIED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : r.status === "PROCESSING"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{r.reason}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
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
