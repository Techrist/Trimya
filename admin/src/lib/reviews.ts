import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase-client";
import type { CutReview } from "./types";

/**
 * Agrégation des notes par coiffeur pour un salon, version admin.
 * Mirror de `src/services/reviews.ts > getBarberRatingsForSalon` côté mobile.
 */

export interface BarberRatingAggregate {
  barberId: string;
  barberName: string;
  reviewCount: number;
  /** Moyenne sur 5 (arrondi à 1 décimale). */
  averageRating: number;
  distribution: [number, number, number, number, number];
  latestReviewAt: number;
}

/** Seuils de signalement (alignés avec mobile). */
export const LOW_RATING_THRESHOLD = 3;
export const MIN_REVIEWS_FOR_FLAG = 3;

export function isBarberFlagged(agg: BarberRatingAggregate): boolean {
  return (
    agg.reviewCount >= MIN_REVIEWS_FOR_FLAG &&
    agg.averageRating < LOW_RATING_THRESHOLD
  );
}

/**
 * Récupère et agrège tous les avis d'un salon (200 plus récents max).
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
        collection(db, "cutReviews"),
        where("salonId", "==", salonId),
        orderBy("createdAt", "desc"),
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
          barberName: review.barberName || "",
          reviewCount: 1,
          averageRating: review.rating,
          distribution,
          latestReviewAt: review.createdAt,
        });
      } else {
        existing.distribution[review.rating - 1] += 1;
        existing.reviewCount += 1;
        existing.averageRating =
          existing.averageRating +
          (review.rating - existing.averageRating) / existing.reviewCount;
        if (review.createdAt > existing.latestReviewAt) {
          existing.latestReviewAt = review.createdAt;
        }
        if (review.barberName) existing.barberName = review.barberName;
      }
    }
    for (const agg of map.values()) {
      agg.averageRating = Math.round(agg.averageRating * 10) / 10;
    }
  } catch (err) {
    console.warn("[admin/reviews] aggregate error:", err);
  }
  return map;
}

/**
 * Récupère les N avis les plus récents d'un salon (tous coiffeurs).
 */
export async function getRecentSalonReviews(
  salonId: string,
  max = 10,
): Promise<CutReview[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "cutReviews"),
        where("salonId", "==", salonId),
        orderBy("createdAt", "desc"),
        limit(max),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CutReview);
  } catch (err) {
    console.warn("[admin/reviews] recent error:", err);
    return [];
  }
}
