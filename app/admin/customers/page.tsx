"use client";

import { useEffect, useState } from "react";
import { Users, Mail, Phone } from "lucide-react";

interface CustomerRecord {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  orders: Array<{ orderId: string; productName: string; amount: number; status: string }>;
  refunds: Array<{ refundId: string; amount: number; status: string }>;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function fetchCustomers() {
      try {
        const res = await fetch("/api/admin/customers");
        const data = await res.json();
        if (!ignore && res.ok) {
          setCustomers(data.customers || []);
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchCustomers();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-400" /> CRM Customer Profiles (15 Seeded Scenarios)
        </h1>
        <p className="text-xs text-slate-400">
          Realistic customer test profiles configured to evaluate policy edge cases.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="col-span-full py-12 text-center text-sm text-slate-500">Loading customer profiles...</p>
        ) : customers.length === 0 ? (
          <p className="col-span-full py-12 text-center text-sm text-slate-500">No customers found.</p>
        ) : (
          customers.map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl backdrop-blur-md"
            >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                <div>
                  <h3 className="font-bold text-white text-sm">{c.name}</h3>
                  <span className="font-mono text-[11px] text-indigo-400">{c.customerId}</span>
                </div>
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] text-slate-400 font-mono">
                  {c.orders.length} Order(s)
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span className="truncate">{c.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  <span>{c.phone}</span>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-900 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Order History:</span>
                <div className="mt-1.5 space-y-1">
                  {c.orders.map((o) => (
                    <div key={o.orderId} className="flex items-center justify-between rounded-lg bg-slate-900/60 p-2 text-xs">
                      <div>
                        <span className="font-mono font-semibold text-slate-200">{o.orderId}</span>
                        <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{o.productName}</div>
                      </div>
                      <span className="font-semibold text-indigo-300 font-mono">${o.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {c.refunds.length > 0 && (
              <div className="mt-3 border-t border-slate-900 pt-2 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Refund Records:</span>
                <span className="font-mono text-emerald-400 font-semibold">{c.refunds.length} Refund(s)</span>
              </div>
            )}
          </div>
        ))
        )}
      </div>
    </div>
  );
}
