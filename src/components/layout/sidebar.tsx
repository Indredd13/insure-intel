"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  Shield,
  Car,
  FileText,
  ArrowLeftRight,
  Brain,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/carriers", label: "Carrier Universe", icon: Building2, disabled: false },
  { href: "/market-cycle", label: "Market Cycle", icon: TrendingUp, disabled: false },
  { href: "/reinsurance", label: "Reinsurance", icon: Shield, disabled: false },
  { href: "/auto-dealers", label: "Auto Dealers", icon: Car, disabled: false },
  { href: "/filings", label: "SEC Filings", icon: FileText, disabled: false },
  { href: "/compare", label: "Compare", icon: ArrowLeftRight, disabled: false },
  { href: "/predictive", label: "Predictive", icon: Brain, disabled: false },
  { href: "/settings", label: "Settings", icon: Settings, disabled: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Shield className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-foreground">InsureIntel</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  item.disabled && "pointer-events-none opacity-40",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.disabled && (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            InsureIntel v0.2.0
          </p>
          <p className="text-xs text-muted-foreground">
            Insurance Intelligence Platform
          </p>
        </div>
      </div>
    </aside>
  );
}
