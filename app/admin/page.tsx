"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Activity,
  History,
  ArrowUpRight,
  RefreshCw,
  Terminal,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface StatsData {
  totalCustomers: number;
  totalOrders: number;
  totalSessions: number;
  approvedRefunds: number;
  deniedRefunds: number;
  humanReviewSessions: number;
  totalRefundAmount: number;
}

interface StreamEvent {
  id: string;
  sessionId: string;
  customerName?: string;
  type: string;
  toolName?: string;
  status?: string;
  message: string;
  createdAt: string;
}

interface RecentSession {
  id: string;
  customerId: string;
  customerName: string;
  orderId: string;
  productName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  eventCount: number;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [events, setEvents] = useState<StreamEvent[]>([]);

  // Merge incoming events (newest first) while keeping unique ids:
  // stats snapshot and SSE polls can deliver the same AgentEvent rows.
  const mergeUniqueEvents = (prev: StreamEvent[], incoming: StreamEvent[]) => {
    const seen = new Set(incoming.map((e) => e.id));
    return [...incoming, ...prev.filter((e) => !seen.has(e.id))].slice(0, 50);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setRecentSessions(data.recentSessions || []);
        if (data.recentEvents) {
          setEvents((prev) => mergeUniqueEvents(prev, data.recentEvents));
        }
      }
    } catch (err) {
      console.error("Failed to fetch admin stats:", err);
    }
  };

  useEffect(() => {
    let ignore = false;

    async function loadInitialStats() {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        if (!ignore && res.ok) {
          setStats(data.stats);
          setRecentSessions(data.recentSessions || []);
          if (data.recentEvents) {
            setEvents((prev) => mergeUniqueEvents(prev, data.recentEvents));
          }
        }
      } catch (err) {
        console.error("Failed to fetch admin stats:", err);
      }
    }

    loadInitialStats();

    // Subscribe to SSE stream for real-time live events
    const eventSource = new EventSource("/api/events/stream");

    eventSource.addEventListener("event", (e) => {
      try {
        const newEvt: StreamEvent = JSON.parse(e.data);
        setEvents((prev) => mergeUniqueEvents(prev, [newEvt]));
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    });

    return () => {
      ignore = true;
      eventSource.close();
    };
  }, []);

  const pieData = [
    { name: "Approved", value: stats?.approvedRefunds || 0, color: "#10b981" },
    { name: "Denied", value: stats?.deniedRefunds || 0, color: "#f43f5e" },
    { name: "Human Review", value: stats?.humanReviewSessions || 0, color: "#f59e0b" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Agent Telemetry & Admin Command Center</h1>
          <p className="text-xs text-slate-400">
            Real-time telemetry, tool invocation traces, and deterministic refund policy audit trail.
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 self-start rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Customers</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{stats?.totalCustomers ?? "—"}</p>
          <span className="text-[10px] text-slate-500">15 CRM Profiles</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{stats?.totalOrders ?? "—"}</p>
          <span className="text-[10px] text-slate-500">Verified DB Records</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Approved Refunds</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{stats?.approvedRefunds ?? "—"}</p>
          <span className="text-[10px] text-emerald-500/80">Policy Eligible</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Denied Refunds</span>
            <XCircle className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-400">{stats?.deniedRefunds ?? "—"}</p>
          <span className="text-[10px] text-rose-500/80">Policy Ineligible</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Human Review</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-400">{stats?.humanReviewSessions ?? "—"}</p>
          <span className="text-[10px] text-amber-500/80">Edge Cases / Conflicts</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Refunded</span>
            <DollarSign className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-indigo-300">
            ${stats?.totalRefundAmount ? stats.totalRefundAmount.toFixed(2) : "0.00"}
          </p>
          <span className="text-[10px] text-slate-500">Processed USD</span>
        </div>
      </div>

      {/* Main Grid: Real-Time Telemetry Stream + Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Real-time Agent Execution Telemetry Panel */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl border border-slate-800 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Live Agent Telemetry & Event Stream</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-mono text-emerald-400">SSE Stream Active</span>
            </div>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto max-h-[480px] space-y-2.5 font-mono text-xs pr-1">
            {events.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No telemetry events logged yet. Open customer chat at <Link href="/chat" className="text-indigo-400 underline">/chat</Link> and trigger a refund request to see live tool execution traces!
              </div>
            ) : (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-xl border border-slate-900 bg-slate-900/60 p-3 transition hover:border-slate-800"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-500">
                      {new Date(evt.createdAt).toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-2">
                      {evt.toolName && (
                        <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300 border border-indigo-500/20">
                          TOOL: {evt.toolName}
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          evt.type === "TOOL_CALL"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : evt.type === "TOOL_RESULT"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : evt.type === "REFUND_PROCESSED"
                            ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                            : evt.type === "REFUND_DENIED"
                            ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40"
                            : evt.type === "HUMAN_REVIEW"
                            ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {evt.type}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed break-words font-mono">
                    {evt.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Analytics Distribution Chart */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-md">
            <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-400" /> Decision Breakdown
            </h2>
            <p className="text-xs text-slate-400 mb-4">Distribution of AI policy decisions.</p>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.75rem", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex justify-around text-xs border-t border-slate-900 pt-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-300">Approved ({stats?.approvedRefunds ?? 0})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-300">Denied ({stats?.deniedRefunds ?? 0})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-300">Review ({stats?.humanReviewSessions ?? 0})</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-md flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-400" /> Recent Sessions
              </h2>
              <Link href="/admin/sessions" className="text-xs text-indigo-400 hover:underline flex items-center gap-0.5">
                View All <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2 text-xs">
              {recentSessions.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No recent sessions.</p>
              ) : (
                recentSessions.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-slate-900 bg-slate-900/50 p-2.5"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{s.customerName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{s.orderId} • {s.productName}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : s.status === "DENIED"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
