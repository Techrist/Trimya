/**
 * Documents légaux : adresses et version en vigueur.
 *
 * `LEGAL_VERSION` est enregistrée avec chaque consentement recueilli dans
 * l'app (création de compte) pour pouvoir prouver ce que la personne a
 * accepté et quand. À garder identique à `LEGAL_VERSION` côté admin
 * (admin/src/lib/legal.ts) et à la date « Mis à jour le » des pages légales
 * du site. À changer à chaque modification substantielle de ces documents.
 */
export const LEGAL_VERSION = '2026-11-25';

export const LEGAL_URLS = {
  privacy: 'https://www.trimya.app/privacy',
  cguClient: 'https://www.trimya.app/cgu',
  cguPro: 'https://www.trimya.app/cgu-pro',
} as const;
