"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Send,
  LogOut,
  Users,
  Activity,
  CalendarDays,
  MessageCircle,
  ArrowRightLeft,
  Crown,
  Building2,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { type User } from "firebase/auth";
import { logout } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/dashboard/salons", label: "Salons", icon: Store },
  { href: "/dashboard/owners", label: "Propriétaires", icon: Building2 },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/activity", label: "Activité", icon: Activity },
  { href: "/dashboard/reservations", label: "Réservations", icon: CalendarDays },
  { href: "/dashboard/messaging", label: "Messagerie", icon: MessageCircle },
  { href: "/dashboard/migrations", label: "Migrations", icon: ArrowRightLeft },
  { href: "/dashboard/plans", label: "Plans", icon: Crown },
  { href: "/dashboard/push", label: "Notifications", icon: Send },
];

export function Sidebar({ user }: { user: User }) {
  return (
    <>
      {/* Desktop sidebar : fixée à gauche, visible md+ */}
      <DesktopSidebar user={user} />
      {/* Mobile : top bar avec hamburger + drawer overlay */}
      <MobileNav user={user} />
    </>
  );
}

// ─── Desktop ────────────────────────────────────────────────

function DesktopSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <BrandHeader />
      <NavList pathname={pathname} />
      <Footer user={user} />
    </aside>
  );
}

// ─── Mobile ─────────────────────────────────────────────────

function MobileNav({ user }: { user: User }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Auto-close du drawer au changement de route (navigation utilisateur).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Empêche le body de scroller quand le drawer est ouvert.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Page courante pour l'afficher dans la top bar mobile.
  const currentNav = NAV.find((n) =>
    n.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(n.href),
  );

  return (
    <>
      {/* Top bar mobile, sticky en haut */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated hover:text-text"
        >
          <Menu className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <div className="flex items-center gap-2">
          <Image
            src="/logo-mark.png"
            alt="Trimya"
            width={28}
            height={28}
            priority
            className="h-7 w-7 object-contain"
          />
          <span className="text-sm font-bold">Trimya</span>
        </div>
        <span className="ml-auto text-xs text-text-muted">
          {currentNav?.label ?? "Admin"}
        </span>
      </header>

      {/* Backdrop + drawer */}
      {open ? (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-2xl md:hidden",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo-mark.png"
                  alt="Trimya"
                  width={48}
                  height={48}
                  priority
                  className="h-12 w-12 object-contain"
                />
                <div>
                  <div className="text-base font-bold leading-none">Trimya</div>
                  <div className="mt-1 text-xs text-text-muted">Admin</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated hover:text-text"
              >
                <X className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>
            <NavList pathname={pathname} />
            <Footer user={user} />
          </aside>
        </>
      ) : null}
    </>
  );
}

// ─── Sous-composants partagés ───────────────────────────────

function BrandHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-4">
      <Image
        src="/logo-mark.png"
        alt="Trimya"
        width={56}
        height={56}
        priority
        className="h-14 w-14 object-contain"
      />
      <div>
        <div className="text-base font-bold leading-none">Trimya</div>
        <div className="mt-1 text-xs text-text-muted">Admin</div>
      </div>
    </div>
  );
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {NAV.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:bg-surface-elevated hover:text-text",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ user }: { user: User }) {
  return (
    <div className="border-t border-border p-3">
      <div className="px-2 pb-2 text-xs text-text-dim truncate">{user.email}</div>
      <button
        onClick={() => logout()}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-danger"
      >
        <LogOut className="h-4 w-4" strokeWidth={2.2} />
        Se déconnecter
      </button>
    </div>
  );
}
