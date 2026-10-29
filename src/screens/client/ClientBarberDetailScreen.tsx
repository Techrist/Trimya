import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Star, Home, MessageSquare } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { BarberAvatar } from '@/components/BarberAvatar';
import { LinearGradient } from 'expo-linear-gradient';
import { getBarber } from '@/services/barbers';
import { getBarberRatingsForSalon, type BarberRatingAggregate } from '@/services/reviews';
import { storage } from '@/services/storage';
import { getCustomer } from '@/services/customers';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Barber, Customer } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientBarberDetail'>;
type Rt = RouteProp<RootStackParamList, 'ClientBarberDetail'>;

/**
 * Vue détaillée d'un coiffeur du salon du client. Affiche les infos
 * publiques (avatar, nom, note, nombre d'avis) et propose le CTA
 * « Commander à domicile » qui ouvre le formulaire de demande.
 */
export function ClientBarberDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { barberId } = route.params;
  const { t } = useT();
  const [barber, setBarber] = useState<Barber | null>(null);
  const [rating, setRating] = useState<BarberRatingAggregate | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const customerId = await storage.getCustomerId();
        if (customerId) {
          const c = await getCustomer(customerId);
          setCustomer(c);
        }
        const b = await getBarber(barberId);
        setBarber(b);
        if (b) {
          const map = await getBarberRatingsForSalon(b.salonId);
          setRating(map.get(b.id) ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [barberId]);

  if (loading) {
    return (
      <Screen centered>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!barber) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>
          {t('client.barberDetail.notFound')}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false} scroll>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('client.barberDetail.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Carte profil coiffeur */}
        <View style={styles.profileSection}>
          <BarberAvatar barber={barber} size={120} />
          <Text style={styles.barberName}>{barber.name}</Text>
          {rating ? (
            <View style={styles.ratingRow}>
              <View style={styles.starsWrap}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= Math.round(rating.averageRating);
                  return (
                    <Star
                      key={n}
                      color={filled ? colors.accent : colors.border}
                      fill={filled ? colors.accent : 'transparent'}
                      size={18}
                      strokeWidth={2}
                    />
                  );
                })}
              </View>
              <Text style={styles.ratingNumber}>
                {rating.averageRating.toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>
                {t(
                  rating.reviewCount > 1
                    ? 'client.barberDetail.reviewsCountPlural'
                    : 'client.barberDetail.reviewsCount',
                  { count: rating.reviewCount },
                )}
              </Text>
            </View>
          ) : (
            <Text style={styles.noReviews}>
              {t('client.barberDetail.noReviewsYet')}
            </Text>
          )}
        </View>

        {/* CTA principal : commander à domicile */}
        <Pressable
          onPress={() =>
            nav.navigate('ClientHomeRequest', {
              barberId: barber.id,
              barberName: barber.name,
            })
          }
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Home color={colors.black} size={24} strokeWidth={2.4} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>
                {t('client.barberDetail.homeServiceCta')}
              </Text>
              <Text style={styles.ctaSub}>
                {t('client.barberDetail.homeServiceSub', {
                  name: barber.name,
                })}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Info card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MessageSquare
              color={colors.textMuted}
              size={18}
              strokeWidth={2}
            />
            <Text style={styles.infoText}>
              {t('client.barberDetail.howItWorks')}
            </Text>
          </View>
        </Card>
      </View>
    </Screen>
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  barberName: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  starsWrap: {
    flexDirection: 'row',
    gap: 3,
  },
  ratingNumber: {
    ...typography.h3,
    color: colors.accent,
  },
  ratingCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  noReviews: {
    ...typography.body,
    color: colors.textDim,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  ctaTitle: {
    ...typography.button,
    color: colors.black,
  },
  ctaSub: {
    ...typography.caption,
    color: '#1a1a1a',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: colors.surface,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
