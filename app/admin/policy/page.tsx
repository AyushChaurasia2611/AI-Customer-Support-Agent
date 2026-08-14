"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, FileText, CheckCircle2 } from "lucide-react";

export default function AdminPolicyPage() {
  const [policyText, setPolicyText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/policy")
      .then((res) => res.json())
      .then((data) => setPolicyText(data.content || "Policy file not found."))
      .catch(() => setPolicyText("Failed to load the refund policy file."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-400" /> Deterministic E-Commerce Refund Policy
        </h1>
        <p className="text-xs text-slate-400">
          Enforced strictly by the backend policy engine (<span className="font-mono text-indigo-300">lib/policy-engine.ts</span>).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">data/refund-policy.md</h2>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Enforced by Server
          </span>
        </div>

        <div className="max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-mono">
          {isLoading ? "Loading policy..." : policyText}
        </div>
      </div>
    </div>
  );
}
