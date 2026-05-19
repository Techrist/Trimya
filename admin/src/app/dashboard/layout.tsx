"use client";

import { AuthGate } from "@/components/AuthGate";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      {(user) => (
        // En desktop : sidebar fixée + main scrollable.
        // En mobile : top bar sticky (gérée dans <Sidebar>) + main pleine largeur scrollable.
        <div className="flex h-screen flex-col overflow-hidden md:flex-row">
          <Sidebar user={user} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 md:px-10 md:py-8">
            {children}
          </main>
        </div>
      )}
    </AuthGate>
  );
}
