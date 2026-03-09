"use client";

import Sidebar from "@/components/nav/Sidebar";
import TopBar from "@/components/nav/TopBar";
import { TeamProvider } from "@/components/providers/TeamProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeamProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <TopBar />

          {/* Page content */}
          <main className="flex-1 overflow-auto p-4">{children}</main>
        </div>
      </div>
    </TeamProvider>
  );
}
