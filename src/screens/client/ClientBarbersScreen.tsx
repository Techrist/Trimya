import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Scissors, Star, MessageSquare } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { BarberAvatar } from '@/components/BarberAvatar';
import { storage } from '@/services/storage';
import { subscribeCustomer } from '@/services/customers';
import { subscribeBarbers } from '@/services/barbers';
import { getSalon } from '@/services/salons';
import {
  getBarberRatingsForSalon,
  type BarberRatingAggregate,
} from '@/services/reviews';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Barber, Customer, Salon } from '@/types';

/**
 * Vue client : "Les coiffeurs de mon salon".
 *
 * Affiche tous les coiffeurs ACTIFS du salon d'origine du client, avec
 * leur note moyenne et leur nombre d'avis. Côté privacy :
 *  - Pas de drapeau rouge / signal "à surveiller" (info interne au salon)
 *  - Pas d'affichage du détail des avis individuels (juste l'agrégat)
 *  - Pas d'accès aux coiffeurs des autres salons
 *
 * Les rules Firestore garantissent côté serveur que :
 *  - Seuls les barbiers du salonId == customer.salonId sont lisibles
 *  - L'agrégat cutReviews est listable mais filtré par salonId également
 */
export function ClientBarbersScreen() {
  const nav = useNavigation<any>();
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [ratings, setRatings] = useState<Map<string, BarberRatingAggregate>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubCustomer: (() => void) | undefined;
    let unsubBarbers: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) {
        setLoading(false);
        return;
      }
      unsubCustomer = subscribeCustomer(id, async (c) => {
        setCustomer(c);
        if (!c?.salonId) {
          setLoading(false);
          return;
        }
        // Re-souscrit aux barbiers si le salonId change (rare mais propre).
        unsubBarbers?.();
        unsubBarbers = subscribeBarbers(
          c.salonId,
          (list) => {
            setBarbers(list);
            setLoading(false);
          },
          { activeOnly: true },
        );
        // One-shot : salon (pour le nom) + agrégat des notes.
        getSalon(c.salonId).then(setSalon).catch(() => setSalon(null));
        getBarberRatingsForSalon(c.salonId)
          .then(setRatings)
          .catch(() => setRatings(new Map()));
      });
    })();
    return () => {
      unsubCustomer?.();
      unsubBarbers?.();
    };
  }, []);

  // Tri : par note moyenne décroissante, puis par nombre d'avis décroissant,
  // puis alphabétiquement. Les coiffeurs sans avis tombent en fin de liste.
  const sortedBarbers = useMemo(() => {
    const withRatings = barbers.map((b) => ({
      barber: b,
      rating: ratings.get(b.id) ?? null,
    }));
    return withRatings.sort((a, b) => {
      const aHas = a.rating !== null;
      const bHas = b.rating !== null;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (a.rating && b.rating) {
        if (b.rating.averageRating !== a.rating.averageRating) {
          return b.rating.averageRating - a.rating.averageRating;
        }
        return b.rating.reviewCount - a.rating.reviewCount;
      }
      return a.barber.name.localeCompare(b.barber.name);
    });
  }, [barbers, ratings]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('client.barbers.title')}</Text>
          {salon ? (
            <Text style={styles.subtitle}>{salon.name}</Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !customer?.salonId ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            {t('client.barbers.noSalonTitle')}
          </Text>
          <Text style={styles.emptyText}>
            {t('client.barbers.noSalonText')}
          </Text>
        </View>
      ) : sortedBarbers.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Scissors color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>
            {t('client.barbers.empty.title')}
          </Text>
          <Text style={styles.emptyText}>
            {t('client.barbers.empty.text')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedBarbers}
          keyExtractor={(it) => it.barber.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <Text style={styles.intro}>{t('client.barbers.intro')}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                nav.navigate('ClientBarberDetail', { barberId: item.barber.id })
              }
            >
              <BarberRow barber={item.barber} rating={item.rating} t={t} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function BarberRow({
  barber,
  rating,
  t,
}: {
  barber: Barber;
  rating: BarberRatingAggregate | null;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  return (
    <Card>
      <View style={styles.row}>
        <BarberAvatar barber={barber} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{barber.name}</Text>
          {rating ? (
            <>
              <View style={styles.ratingRow}>
                <View style={styles.starsWrap}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const filled = n <= Math.round(rating.averageRating);
                    return (
                      <Star
                        key={n}
                        color={filled ? colors.accent : colors.border}
                        fill={filled ? colors.accent : 'transparent'}
                        size={14}
                        strokeWidth={2}
                      />
                    );
                  })}
                </View>
                <Text style={styles.ratingNumber}>
                  {rating.averageRating.toFixed(1)}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <MessageSquare
                  color={colors.textDim}
                  size={12}
                  strokeWidth={2}
                />
                <Text style={styles.meta}>
                  {t(
                    rating.reviewCount > 1
                      ? 'client.barbers.reviewsCountPlural'
                      : 'client.barbers.reviewsCount',
                    { count: rating.reviewCount },
                  )}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.noReviews}>
              {t('client.barbers.noReviewsYet')}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  intro: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  starsWrap: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingNumber: {
    ...typography.bodyBold,
    color: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  noReviews: {
    ...typography.caption,
    color: colors.textDim,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
