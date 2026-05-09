import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, Gift, AlertTriangle } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { BarberAvatar } from '@/components/BarberAvatar';
import { getCustomer } from '@/services/customers';
import { addCut } from '@/services/cuts';
import { subscribeBarbers } from '@/services/barbers';
import { useApp } from '@/contexts/AppContext';
import { formatPrice, parsePriceInput } from '@/utils/currency';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography, REWARD_THRESHOLD } from '@/theme';
import { Customer, ScanResult, Barber } from '@/types';
import { ScannerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ScannerStackParamList, 'AddCut'>;
type Rt = RouteProp<ScannerStackParamList, 'AddCut'>;

const LAST_PRICE_KEY = '@trimya/lastPrice';

export function SalonAddCutScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { customerId } = route.params;
  const { salonId } = useApp();
  const { t } = useT();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const c = await getCustomer(customerId);
        if (!c) throw new Error('Client introuvable.');
        if (salonId && c.salonId !== salonId) {
          throw new Error('Ce client n\'est pas inscrit à ce salon.');
        }
        setCustomer(c);
      } catch (e: any) {
        setError(e.message || 'Erreur de chargement.');
      }
    })();
  }, [customerId, salonId]);

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeBarbers(salonId, (list) => {
      setBarbers(list);
      if (list.length === 1 && !selectedBarberId) {
        setSelectedBarberId(list[0].id);
      }
    }, { activeOnly: true });
    return unsub;
  }, [salonId]);

  useEffect(() => {
    AsyncStorage.getItem(LAST_PRICE_KEY).then((v) => {
      if (v && !priceInput) setPriceInput(v);
    });
  }, []);

  const isReward = customer
    ? customer.currentCount >= REWARD_THRESHOLD
    : false;

  const selectedBarber = useMemo(
    () => barbers.find((b) => b.id === selectedBarberId) || null,
    [barbers, selectedBarberId],
  );

  const needsBarber = barbers.length > 0 && !selectedBarberId;

  const canSubmit = useMemo(() => {
    if (!customer) return false;
    // If the salon has barbers configured, one must be selected.
    if (needsBarber) return false;
    // For reward cuts, we don't require a price (it's free).
    if (isReward) return true;
    // Price required for paid cuts.
    const price = parsePriceInput(priceInput);
    return price > 0;
  }, [customer, isReward, priceInput, needsBarber]);

  const handleAdd = async () => {
    if (!customer || !salonId) return;
    if (needsBarber) {
      Alert.alert(
        t('salon.cut.barberRequired'),
        t('salon.cut.barberRequiredHint'),
      );
      return;
    }
    setSubmitting(true);
    try {
      const price = isReward ? 0 : parsePriceInput(priceInput);
      const r = await addCut({
        customerId: customer.id,
        salonId,
        barberId: selectedBarberId || undefined,
        barberName: selectedBarber?.name,
        price,
      });
      if (!isReward && price > 0) {
        await AsyncStorage.setItem(LAST_PRICE_KEY, String(price));
      }
      setResult(r);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('salon.cut.errorAdd'));
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <Screen padded centered>
        <View style={styles.errIconWrap}>
          <AlertTriangle color={colors.danger} size={48} strokeWidth={2} />
        </View>
        <Text style={styles.title}>{error}</Text>
        <Button label={t('salon.cut.backScanner')} onPress={() => nav.replace('Scanner')} />
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen padded centered>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.successCircle}
        >
          {result.wasReward ? (
            <Gift color={colors.black} size={56} strokeWidth={2.4} />
          ) : (
            <Check color={colors.black} size={64} strokeWidth={3} />
          )}
        </LinearGradient>

        <Text style={styles.successTitle}>
          {result.wasReward ? t('salon.cut.successReward') : t('salon.cut.successAdded')}
        </Text>
        <Text style={styles.successSub}>
          {customer.name || 'Client'} · {result.newCount}/{REWARD_THRESHOLD}
        </Text>

        {!result.wasReward && (
          <Text style={styles.successPrice}>
            {formatPrice(parsePriceInput(priceInput))}
            {selectedBarber && ` · ${selectedBarber.name}`}
          </Text>
        )}

        {result.rewardUnlocked && (
          <Card style={styles.unlocked} elevated>
            <View style={styles.unlockedHeader}>
              <Gift color={colors.primary} size={20} strokeWidth={2.2} />
              <Text style={styles.unlockedTitle}>{t('salon.cut.unlocked.title')}</Text>
            </View>
            <Text style={styles.unlockedText}>{t('salon.cut.unlocked.text')}</Text>
          </Card>
        )}

        {result.wasReward && (
          <Card style={styles.unlocked} elevated>
            <Text style={styles.unlockedTitle}>{t('salon.cut.reset.title')}</Text>
            <Text style={styles.unlockedText}>{t('salon.cut.reset.text')}</Text>
          </Card>
        )}

        <Button label={t('salon.cut.scanAnother')} onPress={() => nav.replace('Scanner')} />
      </Screen>
    );
  }

  return (
    <Screen padded scroll>
      <Text style={styles.label}>{t('salon.cut.identified')}</Text>
      <Text style={styles.name}>{customer.name || t('salon.cut.fallbackName')}</Text>
      <Text style={styles.phone}>{customer.phone}</Text>

      <Card style={styles.progressCard} elevated>
        <ProgressIndicator count={customer.currentCount} />
      </Card>

      {isReward ? (
        <Card style={styles.rewardNotice}>
          <View style={styles.rewardNoticeHeader}>
            <Gift color={colors.primary} size={22} strokeWidth={2.2} />
            <Text style={styles.rewardNoticeTitle}>{t('salon.cut.rewardTitle')}</Text>
          </View>
          <Text style={styles.rewardNoticeText}>{t('salon.cut.rewardText')}</Text>
        </Card>
      ) : null}

      {barbers.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>{t('salon.cut.barberLabel')}</Text>
            <Text style={styles.required}>· {t('common.required')}</Text>
          </View>
          {barbers.length === 1 ? (
            <View style={styles.singleBarber}>
              <BarberAvatar barber={barbers[0]} size={48} />
              <Text style={styles.singleBarberName}>{barbers[0].name}</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.barberRow}
            >
              {barbers.map((b) => {
                const selected = selectedBarberId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setSelectedBarberId(b.id)}
                    style={styles.barberChoice}
                  >
                    <View
                      style={[
                        styles.avatarRing,
                        selected && styles.avatarRingActive,
                      ]}
                    >
                      <BarberAvatar barber={b} size={64} />
                    </View>
                    <Text
                      style={[
                        styles.barberName,
                        selected && styles.barberNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {!isReward && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('salon.cut.priceLabel')}</Text>
          <View style={styles.priceRow}>
            <TextInput
              value={priceInput}
              onChangeText={setPriceInput}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textDim}
              style={styles.priceInput}
              autoFocus
            />
            <Text style={styles.priceCurrency}>FCFA</Text>
          </View>
        </View>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <Button
          label={isReward ? t('salon.cut.validateRewardCta') : t('salon.cut.addCta')}
          onPress={handleAdd}
          loading={submitting}
          disabled={!canSubmit}
        />
        <View style={{ height: spacing.sm }} />
        <Button
          label={t('salon.cut.cancelCta')}
          onPress={() => nav.replace('Scanner')}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  name: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xs,
  },
  phone: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  progressCard: {
    marginBottom: spacing.lg,
  },
  rewardNotice: {
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  rewardNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  rewardNoticeTitle: {
    ...typography.h3,
    color: colors.primary,
    textAlign: 'center',
  },
  rewardNoticeText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
  section: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  required: {
    ...typography.caption,
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  singleBarber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  singleBarberName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  barberRow: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  barberChoice: {
    alignItems: 'center',
    width: 80,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarRingActive: {
    borderColor: colors.primary,
  },
  barberName: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  barberNameActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  priceInput: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  priceCurrency: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  successSub: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  successPrice: {
    ...typography.h3,
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  unlocked: {
    width: '100%',
    marginVertical: spacing.lg,
  },
  unlockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  unlockedTitle: {
    ...typography.h3,
    color: colors.primary,
    textAlign: 'center',
  },
  unlockedText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
  errIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
