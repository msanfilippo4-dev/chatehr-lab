"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  FlaskConical,
  Trophy,
  Medal,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace", label: "Workspace", icon: MessageSquare },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/benchmark", label: "Benchmark", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: Medal },
  { href: "/observability", label: "Observability", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

const instructorItem = {
  href: "/instructor",
  label: "Instructor",
  icon: GraduationCap,
};

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex h-full flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
        collapsed ? "w-[60px]" : "w-[240px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-gray-200 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fordham-maroon to-fordham-dark shadow-sm">
          <span className="text-sm font-bold text-white">C</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="t-small font-bold tracking-tight truncate">
              ChartEHR
            </p>
            <p className="t-micro t-tertiary truncate">HINF 6117</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all ${
                    isActive
                      ? "bg-fordham-maroon/10 text-fordham-maroon font-medium"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 ${
                      isActive ? "text-fordham-maroon" : ""
                    }`}
                  />
                  {!collapsed && (
                    <span className="t-small truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Divider */}
        <div className="my-3 border-t border-gray-100" />

        {/* Instructor link */}
        <ul>
          <li>
            <Link
              href={instructorItem.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all ${
                pathname === instructorItem.href
                  ? "bg-fordham-maroon/10 text-fordham-maroon font-medium"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
              title={collapsed ? instructorItem.label : undefined}
            >
              <instructorItem.icon
                size={18}
                className={`shrink-0 ${
                  pathname === instructorItem.href ? "text-fordham-maroon" : ""
                }`}
              />
              {!collapsed && (
                <span className="t-small truncate">
                  {instructorItem.label}
                </span>
              )}
            </Link>
          </li>
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-200 px-2 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>
      </div>
    </aside>
  );
}
