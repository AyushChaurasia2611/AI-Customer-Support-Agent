"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LayoutDashboard, History, DollarSign, Users, ShoppingBag, ShieldCheck } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Customer Chat", href: "/chat", icon: Bot },
    { label: "Admin Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Agent Sessions", href: "/admin/sessions", icon: History },
    { label: "Refunds", href: "/admin/refunds", icon: DollarSign },
    { label: "Customers", href: "/admin/customers", icon: Users },
    { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
    { label: "Refund Policy", href: "/admin/policy", icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/chat" className="flex items-center gap-2.5 transition hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">ApexSupport</span>
            <span className="ml-1.5 rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              AI Agent
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Policy Engine Online
          </div>
        </div>
      </div>
      
      {/* Mobile nav bar */}
      <div className="flex md:hidden overflow-x-auto border-t border-slate-900 px-4 py-2 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                isActive ? "bg-indigo-600 text-white" : "text-slate-400 bg-slate-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
