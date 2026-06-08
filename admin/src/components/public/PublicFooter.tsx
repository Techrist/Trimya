import Link from "next/link";
import Image from "next/image";
import { Mail, MessageCircle, Globe } from "lucide-react";

/**
 * Footer global trimya.com — liens produit, légal, contact, social.
 */
export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand + tagline */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo-mark.png"
                alt="Trimya"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <span className="text-base font-bold">Trimya</span>
            </Link>
            <p className="mt-3 text-sm text-text-muted">
              La fidélité, à la vitesse d&apos;une coupe.
            </p>
            <p className="mt-1 text-xs text-text-dim">Yaoundé, Cameroun</p>
          </div>

          {/* Produit */}
          <Section
            title="Produit"
            links={[
              { href: "/clients", label: "Pour les clients" },
              { href: "/salons", label: "Pour les salons" },
              { href: "/proprietaires", label: "Pour les chaînes" },
              { href: "/tarifs", label: "Tarifs" },
            ]}
          />

          {/* Entreprise */}
          <Section
            title="Entreprise"
            links={[
              { href: "/contact", label: "Contact commercial" },
              { href: "mailto:contact@trimya.com", label: "contact@trimya.com" },
              { href: "https://wa.me/237692979345", label: "WhatsApp" },
            ]}
          />

          {/* Légal */}
          <Section
            title="Légal"
            links={[
              { href: "/privacy", label: "Politique de confidentialité" },
              { href: "/cgu", label: "CGU Client" },
              { href: "/cgu-pro", label: "CGU Pro" },
            ]}
          />
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-xs text-text-dim sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} Trimya. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/237692979345"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-text"
              aria-label="WhatsApp"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              <span>+237 692 979 345</span>
            </a>
            <a
              href="mailto:contact@trimya.com"
              className="inline-flex items-center gap-1.5 hover:text-text"
              aria-label="Email"
            >
              <Mail className="h-4 w-4" strokeWidth={2} />
              <span>contact@trimya.com</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

interface SectionProps {
  title: string;
  links: { href: string; label: string }[];
}

function Section({ title, links }: SectionProps) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => {
          const external = l.href.startsWith("http") || l.href.startsWith("mailto");
          if (external) {
            return (
              <li key={l.href}>
                <a
                  href={l.href}
                  target={l.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="text-sm text-text-muted hover:text-text"
                >
                  {l.label}
                </a>
              </li>
            );
          }
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-sm text-text-muted hover:text-text"
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
