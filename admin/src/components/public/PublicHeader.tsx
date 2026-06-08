"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Header global des pages publiques de trimya.com.
 * Sticky en haut, fond sombre semi-transparent, logo + nav + CTAs.
 */

interface NavLink {
  href: string;
  label: string;
}

const NAV: NavLink[] = [
  { href: "/clients", label: "Pour les clients" },
  { href: "/salons", label: "Pour les salons" },
  { href: "/proprietaires", label: "Chaînes" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-mark.png"
            alt="Trimya"
            width={32}
            height={32}
            priority
            className="h-8 w-8 object-contain"
          />
          <span className="text-base font-bold tracking-tight">Trimya</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-text-muted hover:bg-surface hover:text-text",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/contact"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-black transition-colors hover:bg-primary-dark"
          >
            Démarrer
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text md:hidden"
        >
          {open ? (
            <X className="h-5 w-5" strokeWidth={2.2} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={2.2} />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open ? (
        <div className="border-t border-border/60 bg-bg md:hidden">
          <nav className="space-y-1 px-4 py-4">
            {NAV.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-base font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:bg-surface hover:text-text",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="mt-3 flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-black"
            >
              Démarrer
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
