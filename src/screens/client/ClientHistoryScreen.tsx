import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Scissors, Gift, ChevronLeft, Star } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { ReviewSheet } from '@/components/ReviewSheet';
import { storage } from '@/services/storage';
import { subscribeRecentCuts } from '@/services/cuts';
import {
  getReviewsForCuts,
  submitReview,
  isCutEligibleForReview,
} from '@/services/reviews';
import { useT, getCurrentLocale, localeToBcp47 } from '@/i18n';
import { colors, spacing, typography, radius } from '@/theme';
import { Cut, CutReview, REVIEW_EDIT_WINDOW_MS } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientHistory'>;

export function ClientHistoryScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [reviews, setReviews] = useState<Map<string, CutReview>>(new Map());
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<Cut | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) {
        setLoading(false);
        return;
      }
      unsub = subscribeRecentCuts(id, async (list) => {
        setCuts(list);
        setLoading(false);
        // Charge en parallèle les avis correspondants
        const ids = list.filter((c) => c.barberId).map((c) => c.id);
        if (ids.length > 0) {
          const reviewMap = await getReviewsForCuts(ids);
          setReviews(reviewMap);
        } else {
          setReviews(new Map());
        }
      });
    })();
    return () => unsub?.();
  }, []);

  const handleSubmitReview = async (rating: 1 | 2 | 3 | 4 | 5, comment: string) => {
    if (!reviewTarget) return;
    setReviewSubmitting(true);
    try {
      const review = await submitReview({
        cut: reviewTarget,
        rating,
        comment: comment || undefined,
      });
      // Optimistic update : on injecte le nouvel avis dans la map locale
      setReviews((prev) => {
        const next = new Map(prev);
        next.set(reviewTarget.id, review);
        return next;
      });
      setReviewTarget(null);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || String(e));
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.topTitle}>{t('client.history.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.subtitleWrap}>
        <Text style={styles.subtitle}>{t('client.history.subtitle')}</Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : cuts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('client.history.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('client.history.empty.text')}</Text>
        </View>
      ) : (
        <FlatList
          data={cuts}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <HistoryItem
              cut={item}
              review={reviews.get(item.id) || null}
              onReview={() => setReviewTarget(item)}
              t={t}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}

      {reviewTarget ? (
        <ReviewSheet
          visible={!!reviewTarget}
          barberName={reviewTarget.barberName || ''}
          existing={reviews.get(reviewTarget.id) || null}
          loading={reviewSubmitting}
          onCancel={() => setReviewTarget(null)}
          onSubmit={handleSubmitReview}
        />
      ) : null}
    </Screen>
  );
}

function HistoryItem({
  cut,
  review,
  onReview,
  t,
}: {
  cut: Cut;
  review: CutReview | null;
  onReview: () => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  const date = new Date(cut.createdAt);
  const bcp47 = localeToBcp47(getCurrentLocale());
  const formatted = date.toLocaleDateString(bcp47, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString(bcp47, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const Icon = cut.wasReward ? Gift : Scissors;

  const canRate = !!cut.barberId && !review;
  const canEdit =
    !!review && Date.now() - review.createdAt < REVIEW_EDIT_WINDOW_MS;

  return (
    <Card>
      <View style={styles.item}>
        <View
          style={[
            styles.itemIcon,
            cut.wasReward && { borderColor: colors.accent },
          ]}
        >
          <Icon
            color={cut.wasReward ? colors.accent : colors.primary}
            size={20}
            strokeWidth={2}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>
            {cut.wasReward ? t('client.history.cut.reward') : t('client.history.cut.paid')}
          </Text>
          <Text style={styles.itemDate}>
            {formatted} • {time}
          </Text>
          {cut.barberName ? (
            <Text style={styles.itemBarber}>
              {t('client.history.byBarber', { name: cut.barberName })}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Bloc note */}
      {review ? (
        <View style={styles.reviewBlock}>
          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                color={n <= review.rating ? colors.accent : colors.border}
                fill={n <= review.rating ? colors.accent : 'transparent'}
                size={14}
                strokeWidth={2}
              />
            ))}
            {canEdit ? (
              <Pressable onPress={onReview} hitSlop={6} style={styles.reviewEditLink}>
                <Text style={styles.reviewEditText}>
                  {t('review.history.edit')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {review.comment ? (
            <Text style={styles.reviewComment} numberOfLines={3}>
              {review.comment}
            </Text>
          ) : null}
        </View>
      ) : canRate && isCutEligibleForReview(cut) ? (
        <Pressable onPress={onReview} style={styles.rateBtn}>
          <Star color={colors.accent} size={16} strokeWidth={2.4} />
          <Text style={styles.rateBtnText}>
            {t('review.history.rateCta')}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  subtitleWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl + spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  itemDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemBarber: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  reviewBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewEditLink: {
    marginLeft: 'auto',
  },
  reviewEditText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  reviewComment: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 235, 59, 0.08)',
  },
  rateBtnText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
