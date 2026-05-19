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
        // h-screen + overflow-hidden ensures the outer page does not scroll;
        // only the <main> area scrolls vertically while the sidebar stays put.
        <div className="flex h-screen overflow-hidden">
          <Sidebar user={user} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-8 md:px-10">
            {children}
          </main>
        </div>
      )}
    </AuthGate>
  );
}
