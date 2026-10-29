import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  Store,
  ArrowRightLeft,
  Building2,
  Check,
  X,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { BarberAvatar } from '@/components/BarberAvatar';
import { useApp } from '@/contexts/AppContext';
import { useOwner } from '@/hooks/useOwner';
import { subscribeBarbers, transferBarber } from '@/services/barbers';
import { useT } from '@/i18n';
import { humanizeError } from '@/lib/humanizeError';
import { colors, radius, spacing, typography } from '@/theme';
import { Barber, Salon } from '@/types';
import { isOwnerEnterpriseActive } from '@/lib/plans';
import { OwnerSalonsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<
  OwnerSalonsStackParamList,
  'OwnerBarberTransfer'
>;

/**
 * Écran owner-only : liste tous les coiffeurs de la chaîne groupés par salon,
 * avec une action "Transférer" qui ouvre un picker des autres salons.
 *
 * Gating :
 *  - Affiché uniquement en mode owner (route accessible depuis le stack
 *    OwnerSalons, lui-même conditionné par l'auth owner).
 *  - Plan Entreprise actif requis : sinon banner d'avertissement.
 *  - Au moins 2 salons : sinon banner "rien à transférer".
 */
export function OwnerBarberTransferScreen() {
  const nav = useNavigation<Nav>();
  const { ownerId } = useApp();
  const { owner, salons, loading: ownerLoading } = useOwner(ownerId);
  const { t } = useT();

  // Map<salonId, Barber[]> — chaque entrée alimentée par sa propre subscription.
  const [barbersBySalon, setBarbersBySalon] = useState<Record<string, Barber[]>>(
    {},
  );
  const [pickerFor, setPickerFor] = useState<{
    barber: Barber;
    fromSalon: Salon;
  } | null>(null);
  const [transferring, setTransferring] = useState(false);

  // Subscriptions parallèles : une par salon de l'owner.
  useEffect(() => {
    if (salons.length === 0) {
      setBarbersBySalon({});
      return;
    }
    const unsubs = salons.map((s) =>
      subscribeBarbers(s.id, (list) => {
        setBarbersBySalon((prev) => ({ ...prev, [s.id]: list }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [salons]);

  const enterprise = owner ? isOwnerEnterpriseActive(owner) : false;
  const canTransfer = enterprise && salons.length >= 2;

  const totalBarbers = useMemo(
    () =>
      Object.values(barbersBySalon).reduce((sum, list) => sum + list.length, 0),
    [barbersBySalon],
  );

  const handleTransfer = async (toSalonId: string) => {
    if (!pickerFor) return;
    setTransferring(true);
    try {
      await transferBarber({
        barberId: pickerFor.barber.id,
        fromSalonId: pickerFor.fromSalon.id,
        toSalonId,
      });
      const toSalon = salons.find((s) => s.id === toSalonId);
      Alert.alert(
        t('owner.barberTransfer.successTitle'),
        t('owner.barberTransfer.successText', {
          barber: pickerFor.barber.name,
          salon: toSalon?.name ?? '',
        }),
      );
      setPickerFor(null);
    } catch (e: any) {
      Alert.alert(t('common.error'), humanizeError(e, t));
    } finally {
      setTransferring(false);
    }
  };

  if (ownerLoading) {
    return (
      <Screen centered>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('owner.barberTransfer.title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('owner.barberTransfer.intro')}</Text>

        {!enterprise ? (
          <Card style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {t('owner.barberTransfer.lockedTitle')}
            </Text>
            <Text style={styles.bannerText}>
              {t('owner.barberTransfer.lockedText')}
            </Text>
          </Card>
        ) : salons.length < 2 ? (
          <Card style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {t('owner.barberTransfer.singleSalonTitle')}
            </Text>
            <Text style={styles.bannerText}>
              {t('owner.barberTransfer.singleSalonText')}
            </Text>
          </Card>
        ) : totalBarbers === 0 ? (
          <Card style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {t('owner.barberTransfer.emptyTitle')}
            </Text>
            <Text style={styles.bannerText}>
              {t('owner.barberTransfer.emptyText')}
            </Text>
          </Card>
        ) : (
          salons.map((s) => {
            const list = barbersBySalon[s.id] ?? [];
            return (
              <View key={s.id} style={styles.salonGroup}>
                <View style={styles.salonHeader}>
                  <View style={styles.salonIcon}>
                    <Store
                      color={colors.primary}
                      size={16}
                      strokeWidth={2.2}
                    />
                  </View>
                  <Text style={styles.salonName}>{s.name}</Text>
                  <Text style={styles.salonCount}>
                    {t(
                      list.length > 1
                        ? 'owner.barberTransfer.countPlural'
                        : 'owner.barberTransfer.count',
                      { count: list.length },
                    )}
                  </Text>
                </View>

                {list.length === 0 ? (
                  <Card>
                    <Text style={styles.salonEmpty}>
                      {t('owner.barberTransfer.salonEmpty')}
                    </Text>
                  </Card>
                ) : (
                  list.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() =>
                        canTransfer
                          ? setPickerFor({ barber: b, fromSalon: s })
                          : null
                      }
                      disabled={!canTransfer}
                    >
                      <Card style={styles.barberCard}>
                        <BarberAvatar barber={b} size={44} />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.barberName,
                              !b.active && styles.barberInactive,
                            ]}
                          >
                            {b.name}
                          </Text>
                          <Text style={styles.barberStatus}>
                            {b.active
                              ? t('salon.barbers.status.active')
                              : t('salon.barbers.status.inactive')}
                          </Text>
                        </View>
                        <View style={styles.transferBtn}>
                          <ArrowRightLeft
                            color={colors.primary}
                            size={18}
                            strokeWidth={2.2}
                          />
                          <Text style={styles.transferBtnText}>
                            {t('owner.barberTransfer.transfer')}
                          </Text>
                        </View>
                      </Card>
                    </Pressable>
                  ))
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Picker de destination */}
      <Modal
        visible={!!pickerFor}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerFor(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !transferring && setPickerFor(null)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('owner.barberTransfer.pickerTitle', {
                  barber: pickerFor?.barber.name ?? '',
                })}
              </Text>
              <Pressable
                onPress={() => !transferring && setPickerFor(null)}
                hitSlop={12}
              >
                <X color={colors.textMuted} size={22} strokeWidth={2.2} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              {t('owner.barberTransfer.pickerSubtitle', {
                from: pickerFor?.fromSalon.name ?? '',
              })}
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {salons
                .filter((s) => s.id !== pickerFor?.fromSalon.id)
                .map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() =>
                      Alert.alert(
                        t('owner.barberTransfer.confirmTitle'),
                        t('owner.barberTransfer.confirmText', {
                          barber: pickerFor?.barber.name ?? '',
                          from: pickerFor?.fromSalon.name ?? '',
                          to: s.name,
                        }),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('owner.barberTransfer.confirm'),
                            onPress: () => handleTransfer(s.id),
                          },
                        ],
                      )
                    }
                    disabled={transferring}
                    style={styles.salonOption}
                  >
                    <View style={styles.salonOptionIcon}>
                      <Building2
                        color={colors.primary}
                        size={18}
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.salonOptionName}>{s.name}</Text>
                      {s.city ? (
                        <Text style={styles.salonOptionCity}>{s.city}</Text>
                      ) : null}
                    </View>
                    <Check
                      color={colors.textDim}
                      size={18}
                      strokeWidth={2}
                    />
                  </Pressable>
                ))}
            </ScrollView>

            {transferring ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.modalLoadingText}>
                  {t('owner.barberTransfer.transferring')}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
  back: {
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
    paddingBottom: spacing.xxl,
  },
  intro: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  banner: {
    marginBottom: spacing.md,
  },
  bannerTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bannerText: {
    ...typography.body,
    color: colors.textMuted,
  },
  salonGroup: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  salonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  salonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  salonName: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  salonCount: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  salonEmpty: {
    ...typography.body,
    color: colors.textDim,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  barberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  barberName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  barberInactive: {
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  barberStatus: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 34, 0.3)',
  },
  transferBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  salonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  salonOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  salonOptionName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  salonOptionCity: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  modalLoadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
