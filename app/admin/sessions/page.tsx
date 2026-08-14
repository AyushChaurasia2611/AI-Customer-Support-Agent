"use client";

import { useEffect, useState } from "react";
import { History, Search, Eye, X, Terminal } from "lucide-react";

interface SessionItem {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderId: string;
  productName: string;
  orderAmount: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  eventCount: number;
}

interface SessionDetail {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  customer?: { customerId: string; name: string; email: string };
  order?: { orderId: string; productName: string; amount: number };
  events: Array<{
    id: string;
    type: string;
    toolName?: string;
    status?: string;
    message: string;
    metadata?: string;
    createdAt: string;
  }>;
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function fetchSessions() {
      try {
        const res = await fetch("/api/admin/sessions");
        const data = await res.json();
        if (!ignore && res.ok) {
          setSessions(data.sessions || []);
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchSessions();
    return () => {
      ignore = true;
    };
  }, []);

  const openSessionDetail = async (id: string) => {
    setSelectedSessionId(id);
    setSessionDetail(null);
    try {
      const res = await fetch(`/api/admin/sessions/${id}`);
      const data = await res.json();
      if (res.ok) {
        setSessionDetail(data.session);
      }
    } catch (err) {
      console.error("Failed to fetch session detail:", err);
    }
  };

  const filtered = sessions.filter(
    (s) =>
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (s.orderId && s.orderId.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-400" /> Agent Execution Sessions
          </h1>
          <p className="text-xs text-slate-400">
            Inspect individual AI customer support sessions, tool calls, and decision factors.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter sessions by customer or order..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Session ID</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Order</th>
                <th className="px-4 py-3.5">Events</th>
                <th className="px-4 py-3.5">Decision Status</th>
                <th className="px-4 py-3.5">Started At</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading session traces...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No matching agent sessions found. Start a conversation in /chat to generate session traces!
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/50 transition">
                    <td className="px-4 py-3 font-mono text-indigo-300 truncate max-w-[120px]">{s.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">{s.customerName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.customerId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-200">{s.orderId}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[160px]">{s.productName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{s.eventCount} trace logs</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          s.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : s.status === "DENIED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : s.status === "HUMAN_REVIEW"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{new Date(s.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openSessionDetail(s.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-indigo-400 hover:bg-slate-800 hover:text-indigo-300"
                      >
                        <Eye className="h-3.5 w-3.5" /> Inspect Trace
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Trace Drawer / Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="flex h-full w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-indigo-400" /> Session Execution Trace
                </h3>
                <p className="text-xs font-mono text-slate-400">{selectedSessionId}</p>
              </div>
              <button
                onClick={() => setSelectedSessionId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 font-mono text-xs">
              {!sessionDetail ? (
                <div className="py-12 text-center text-slate-500">Loading trace telemetry...</div>
              ) : sessionDetail.events.length === 0 ? (
                <div className="py-12 text-center text-slate-500">No events recorded for this session.</div>
              ) : (
                sessionDetail.events.map((evt) => (
                  <div
                    key={evt.id}
                    className="rounded-xl border border-slate-900 bg-slate-900/60 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-bold ${
                          evt.type === "TOOL_CALL"
                            ? "bg-blue-500/10 text-blue-400"
                            : evt.type === "TOOL_RESULT"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : evt.type === "REFUND_PROCESSED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : evt.type === "REFUND_DENIED"
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {evt.type} {evt.toolName ? `(${evt.toolName})` : ""}
                      </span>
                    </div>
                    <p className="text-slate-200 text-xs leading-relaxed break-words">{evt.message}</p>
                    {evt.metadata &&
                      (() => {
                        try {
                          return (
                            <pre className="mt-1.5 overflow-x-auto rounded bg-slate-950 p-2 text-[10px] text-slate-400 border border-slate-900">
                              {JSON.stringify(JSON.parse(evt.metadata), null, 2)}
                            </pre>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
