import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase';
import {
  OpeningHours,
  DayHours,
  SalonClosure,
  DAYS_OF_WEEK,
  Salon,
} from '@/types';

/**
 * Helpers pour gérer les horaires d'ouverture d'un salon :
 *  - persistance côté Firestore
 *  - calcul "le salon est-il ouvert maintenant / à telle date ?"
 *  - validation d'un créneau de réservation contre les horaires
 */

export async function setSalonOpeningHours(
  salonId: string,
  openingHours: OpeningHours,
): Promise<void> {
  await updateDoc(doc(db, 'salons', salonId), { openingHours });
}

export async function setSalonDayHours(
  salonId: string,
  day: keyof OpeningHours,
  hours: DayHours,
): Promise<void> {
  await updateDoc(doc(db, 'salons', salonId), {
    [`openingHours.${day}`]: hours,
  });
}

export async function addSalonClosure(
  salonId: string,
  closure: SalonClosure,
): Promise<void> {
  await updateDoc(doc(db, 'salons', salonId), {
    closures: arrayUnion(closure),
  });
}

export async function removeSalonClosure(
  salonId: string,
  closure: SalonClosure,
): Promise<void> {
  await updateDoc(doc(db, 'salons', salonId), {
    closures: arrayRemove(closure),
  });
}

// ─── Helpers de lecture/calcul ─────────────────────────────

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Convertit "HH:MM" en minutes depuis minuit (ex. "09:30" → 570). */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Convertit minutes depuis minuit en "HH:MM". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Renvoie les horaires applicables à une date donnée, en tenant compte
 * des fermetures exceptionnelles.
 */
export function getDayHoursForDate(
  salon: Pick<Salon, 'openingHours' | 'closures'>,
  date: Date,
): DayHours {
  // Fermeture exceptionnelle ? → fermé peu importe les horaires habituels.
  const ymd = formatDateYMD(date);
  const closure = (salon.closures ?? []).find((c) => c.date === ymd);
  if (closure) return { closed: true };

  // Sinon, on prend l'horaire du jour de la semaine.
  const dayKey = DAYS_OF_WEEK[date.getDay()];
  if (!salon.openingHours) {
    // Pas d'horaires configurés → on considère que le salon est ouvert
    // (comportement legacy pour ne pas casser les salons existants).
    return { closed: false, open: '00:00', close: '23:59' };
  }
  return salon.openingHours[dayKey];
}

/** Vrai si le salon est ouvert à la date/heure donnée. */
export function isSalonOpenAt(
  salon: Pick<Salon, 'openingHours' | 'closures'>,
  when: Date = new Date(),
): boolean {
  const hours = getDayHoursForDate(salon, when);
  if (hours.closed || !hours.open || !hours.close) return false;
  const minutes = when.getHours() * 60 + when.getMinutes();
  return (
    minutes >= timeToMinutes(hours.open) &&
    minutes <= timeToMinutes(hours.close)
  );
}

/** Vrai si le créneau est inclus dans une plage d'ouverture. */
export function isSlotWithinOpening(
  salon: Pick<Salon, 'openingHours' | 'closures'>,
  slotStart: Date,
  durationMinutes = 30,
): boolean {
  const hours = getDayHoursForDate(salon, slotStart);
  if (hours.closed || !hours.open || !hours.close) return false;
  const startMin = slotStart.getHours() * 60 + slotStart.getMinutes();
  const endMin = startMin + durationMinutes;
  return (
    startMin >= timeToMinutes(hours.open) &&
    endMin <= timeToMinutes(hours.close)
  );
}

/** Format français court d'un horaire pour affichage. */
export function formatDayHours(h: DayHours): string {
  if (h.closed || !h.open || !h.close) return 'Fermé';
  return `${h.open} – ${h.close}`;
}
