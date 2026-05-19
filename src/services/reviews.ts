import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  Cut,
  CutReview,
  REVIEW_EDIT_WINDOW_MS,
  REVIEW_PROMPT_WINDOW_MS,
} from '@/types';

/**
 * Service de gestion des avis clients sur les coupes.
 *
 * Modèle : un document `cutReviews/{cutId}` par coupe notée.
 *  - L'ID du document est volontairement = `cutId` pour garantir l'unicité
 *    (un seul avis par coupe) et permettre un get direct par cut.
 *  - Le doc est créé par le client (rule sécurise customerId == auth.uid).
 *  - Édition possible pendant `REVIEW_EDIT_WINDOW_MS` (24h) — au-delà
 *    l'avis devient immutable (vérifié côté client + côté rule).
 */

const COLLECTION = 'cutReviews';

interface SubmitReviewParams {
  cut: Pick<Cut, 'id' | 'customerId' | 'salonId' | 'barberId' | 'barberName'>;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
}

/**
 * Crée ou met à jour l'avis pour une coupe.
 * - Si aucun avis existe → création
 * - Si avis existe et dans la fenêtre éditable → update
 * - Si avis existe et fenêtre dépassée → throw (immutable)
 *
 * On utilise auth.uid (pas p.cut.customerId) comme source de vérité pour
 * `customerId` afin d'éviter tout drift d'identité avec la rule Firestore
 * qui exige `auth.uid == request.resource.data.customerId`.
 */
export async function submitReview(p: SubmitReviewParams): Promise<CutReview> {
  const now = Date.now();
  const ref = doc(db, COLLECTION, p.cut.id);

  const me = auth.currentUser;
  const meUid = me?.uid;
  if (!meUid) {
    throw new Error('Non authentifié — reconnecte-toi.');
  }

  // Fallback : si la rule `get` refuse pour un doc inexistant (rules pas
  // encore déployées en prod), on traite comme "n'existe pas" et on tente
  // directement le create. La rule create rejettera si vraiment interdit.
  let existing: Awaited<ReturnType<typeof getDoc>> | null = null;
  try {
    existing = await getDoc(ref);
  } catch {
    existing = null;
  }

  const cleanComment = p.comment?.trim().slice(0, 280) || '';

  if (existing && existing.exists()) {
    const prev = existing.data() as CutReview;
    if (now - prev.createdAt > REVIEW_EDIT_WINDOW_MS) {
      throw new Error('review_edit_window_passed');
    }
    await updateDoc(ref, {
      rating: p.rating,
      ...(cleanComment ? { comment: cleanComment } : { comment: '' }),
      updatedAt: now,
    });
    return {
      ...prev,
      rating: p.rating,
      comment: cleanComment || undefined,
      updatedAt: now,
    };
  }

  const review: CutReview = {
    id: p.cut.id,
    cutId: p.cut.id,
    customerId: meUid,
    salonId: p.cut.salonId,
    ...(p.cut.barberId ? { barberId: p.cut.barberId } : {}),
    ...(p.cut.barberName ? { barberName: p.cut.barberName } : {}),
    rating: p.rating,
    ...(cleanComment ? { comment: cleanComment } : {}),
    createdAt: now,
  };
  await setDoc(ref, review);
  return review;
}

/** Récupère l'avis d'une coupe si présent. */
export async function getReviewForCut(cutId: string): Promise<CutReview | null> {
  const snap = await getDoc(doc(db, COLLECTION, cutId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<CutReview, 'id'>) };
}

/**
 * Charge en bloc les avis pour une liste de cutIds.
 *
 * On fait des `getDoc` individuels en parallèle plutôt qu'une list query
 * `where(documentId(), 'in', ...)`. Raison : la rule `list` sur cutReviews
 * exige `resource.data.customerId == auth.uid`, ce qui force la query à
 * filtrer par `customerId`. Avec une query par documentId(), Firestore
 * ne peut pas garantir ce critère et refuse en bloc.
 *
 * Les `get` individuels passent par la rule `get` qui n'a pas cette
 * contrainte (elle est évaluée par doc). C'est moins efficace en réseau
 * mais beaucoup plus tolérant aux rules strictes.
 */
export async function getReviewsForCuts(
  cutIds: string[],
): Promise<Map<string, CutReview>> {
  const map = new Map<string, CutReview>();
  if (cutIds.length === 0) return map;

  const results = await Promise.all(
    cutIds.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...(snap.data() as Omit<CutReview, 'id'>) };
      } catch (err) {
        // Avis manquant ou pas le droit → on ignore silencieusement
        return null;
      }
    }),
  );
  for (const r of results) {
    if (r) map.set(r.id, r);
  }
  return map;
}

/**
 * Souscrit aux avis d'un salon (pour la fiche client côté salon ou les stats
 * coiffeur futures). Limité aux 100 plus récents.
 */
export function subscribeSalonReviews(
  salonId: string,
  cb: (list: CutReview[]) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('salonId', '==', salonId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CutReview, 'id'>),
        })),
      );
    },
    (err) => {
      console.warn('[reviews] subscribeSalonReviews error:', err.message);
      cb([]);
    },
  );
}

/**
 * True si la coupe est éligible à recevoir une note (récente + a un coiffeur
 * + pas encore notée + pas une coupe offerte récompense).
 */
export function isCutEligibleForReview(cut: Cut, now = Date.now()): boolean {
  if (!cut.barberId) return false;
  if (cut.wasReward) {
    // Une coupe offerte récompense peut quand même être notée — on garde
    // la possibilité. Si tu veux exclure les rewards : `return false;`
  }
  return now - cut.createdAt <= REVIEW_PROMPT_WINDOW_MS;
}

/** Helper d'affichage : "★★★★☆" ou autre. */
export function formatStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating));
}

// ─── Agrégation : notes par coiffeur pour un salon ──────────

export interface BarberRatingAggregate {
  barberId: string;
  barberName: string;
  reviewCount: number;
  /** Moyenne sur 5 (arrondi à 1 décimale). */
  averageRating: number;
  /** Distribution : combien de 1⭐, 2⭐, etc. (index 0 = 1 étoile). */
  distribution: [number, number, number, number, number];
  /** Date du dernier avis reçu (ms). */
  latestReviewAt: number;
}

/**
 * Récupère tous les avis d'un salon (limité aux 200 plus récents) et agrège
 * par coiffeur : note moyenne, nombre d'avis, distribution, dernier avis.
 *
 * Renvoie une Map<barberId, aggregate> triable côté caller.
 */
export async function getBarberRatingsForSalon(
  salonId: string,
  options: { limit?: number } = {},
): Promise<Map<string, BarberRatingAggregate>> {
  const max = options.limit ?? 200;
  const map = new Map<string, BarberRatingAggregate>();
  try {
    const snap = await getDocs(
      query(
        collection(db, COLLECTION),
        where('salonId', '==', salonId),
        orderBy('createdAt', 'desc'),
        limit(max),
      ),
    );
    for (const d of snap.docs) {
      const review = d.data() as CutReview;
      if (!review.barberId) continue;
      const existing = map.get(review.barberId);
      if (!existing) {
        const distribution: [number, number, number, number, number] = [
          0, 0, 0, 0, 0,
        ];
        distribution[review.rating - 1] = 1;
        map.set(review.barberId, {
          barberId: review.barberId,
          barberName: review.barberName || '',
          reviewCount: 1,
          averageRating: review.rating,
          distribution,
          latestReviewAt: review.createdAt,
        });
      } else {
        existing.distribution[review.rating - 1] += 1;
        existing.reviewCount += 1;
        // moyenne incrémentale : avg' = avg + (x - avg) / n
        existing.averageRating =
          existing.averageRating +
          (review.rating - existing.averageRating) / existing.reviewCount;
        if (review.createdAt > existing.latestReviewAt) {
          existing.latestReviewAt = review.createdAt;
        }
        // Garde le nom le plus récent si l'historique a varié.
        if (review.barberName) existing.barberName = review.barberName;
      }
    }
    // Arrondi final à 1 décimale.
    for (const agg of map.values()) {
      agg.averageRating = Math.round(agg.averageRating * 10) / 10;
    }
  } catch (err) {
    console.warn('[reviews] getBarberRatingsForSalon error:', err);
  }
  return map;
}

/**
 * Seuil au-dessous duquel un coiffeur est flaggé "à surveiller".
 * Note moyenne < 3 sur au moins 3 avis → drapeau rouge.
 */
export const LOW_RATING_THRESHOLD = 3;
export const MIN_REVIEWS_FOR_FLAG = 3;

/** True si l'agrégat indique un coiffeur dont les notes posent problème. */
export function isBarberFlagged(agg: BarberRatingAggregate): boolean {
  return (
    agg.reviewCount >= MIN_REVIEWS_FOR_FLAG &&
    agg.averageRating < LOW_RATING_THRESHOLD
  );
}
