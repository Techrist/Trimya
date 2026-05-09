import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Star, Scissors, Gift, Send, MessageCircle } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { subscribeConversation } from '@/services/conversations';
import { Conversation } from '@/types';
import { useT, getCurrentLocale, localeToBcp47 } from '@/i18n';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { useApp } from '@/contexts/AppContext';
import {
  subscribeCustomer,
  setCustomerVip,
  setCustomerNotes,
} from '@/services/customers';
import { addCut, subscribeRecentCuts } from '@/services/cuts';
import { colors, radius, spacing, typography, REWARD_THRESHOLD } from '@/theme';
import { Customer, Cut } from '@/types';
import { CustomersStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<CustomersStackParamList, 'CustomerDetail'>;
type Rt = RouteProp<CustomersStackParamList, 'CustomerDetail'>;

export function SalonCustomerDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { customerId } = route.params;
  const { salonId } = useApp();
  const { t } = useT();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [adding, setAdding] = useState(false);
  const [convo, setConvo] = useState<Conversation | null>(null);

  useEffect(() => {
    const unsubC = subscribeCustomer(customerId, (c) => {
      setCustomer(c);
      if (c) setNotes(c.notes || '');
    });
    const unsubH = subscribeRecentCuts(customerId, setCuts, 30);
    const unsubConvo = subscribeConversation(customerId, setConvo);
    return () => {
      unsubC();
      unsubH();
      unsubConvo();
    };
  }, [customerId]);

  const handleAddCut = async () => {
    if (!customer || !salonId) return;
    setAdding(true);
    try {
      const r = await addCut({ customerId: customer.id, salonId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        r.wasReward ? t('salon.customer.rewardOk') : t('salon.customer.addCutOk'),
        `${customer.name || t('salon.reservation.client')} : ${r.newCount}/${REWARD_THRESHOLD}` +
          (r.rewardUnlocked ? t('salon.customer.rewardUnlockedNote') : ''),
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleVip = async () => {
    if (!customer) return;
    try {
      await setCustomerVip(customer.id, !customer.vip);
      Haptics.selectionAsync();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  };

  const handleSaveNotes = async () => {
    if (!customer) return;
    setSavingNotes(true);
    try {
      await setCustomerNotes(customer.id, notes);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSavingNotes(false);
    }
  };

  if (!customer) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const created = new Date(customer.createdAt).toLocaleDateString(
    localeToBcp47(getCurrentLocale()),
    { day: '2-digit', month: 'long', year: 'numeric' },
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={cuts}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
                <ChevronLeft color={colors.textMuted} size={22} strokeWidth={2.2} />
                <Text style={styles.back}>{t('common.back')}</Text>
              </Pressable>
              <Pressable
                onPress={handleToggleVip}
                hitSlop={12}
                style={[styles.vipToggle, customer.vip && styles.vipToggleActive]}
              >
                <Star
                  color={customer.vip ? colors.accent : colors.textMuted}
                  size={16}
                  strokeWidth={2.2}
                  fill={customer.vip ? colors.accent : 'transparent'}
                />
                <Text
                  style={[
                    styles.vipToggleText,
                    customer.vip && styles.vipToggleTextActive,
                  ]}
                >
                  {customer.vip ? t('salon.customer.vipBadge') : t('salon.customer.markVip')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.heroRow}>
              <Avatar name={customer.name} photo={customer.photo} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{customer.name || t('salon.customers.row.noName')}</Text>
                <Text style={styles.phone}>{customer.phone}</Text>
                <Text style={styles.since}>{t('salon.customer.clientSince', { date: created })}</Text>
              </View>
            </View>

            <Card style={styles.progressCard} elevated>
              <ProgressIndicator count={customer.currentCount} />
            </Card>

            <View style={styles.statsRow}>
              <Stat label={t('salon.customer.stat.cuts')} value={customer.totalCuts} />
              <Stat label={t('salon.customer.stat.rewards')} value={customer.totalRewards} />
              <Stat
                label={t('salon.customer.stat.lastVisit')}
                value={
                  customer.lastVisitAt
                    ? new Date(customer.lastVisitAt).toLocaleDateString(
                        localeToBcp47(getCurrentLocale()),
                        { day: '2-digit', month: 'short' },
                      )
                    : '—'
                }
                isText
              />
            </View>

            <Button
              label={
                customer.currentCount >= REWARD_THRESHOLD
                  ? t('salon.customer.validateRewardCta')
                  : t('salon.customer.addCutCta')
              }
              onPress={handleAddCut}
              loading={adding}
            />

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => nav.navigate('Chat', { customerId })}
                style={[styles.actionBtn, { flex: 1 }]}
              >
                <MessageCircle color={colors.primary} size={18} strokeWidth={2.2} />
                <Text style={styles.actionBtnText}>{t('salon.customer.actionConversation')}</Text>
                {convo && convo.unreadBySalon > 0 && (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>
                      {convo.unreadBySalon > 9 ? '9+' : convo.unreadBySalon}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => nav.navigate('ComposeNotification', { customerId })}
                style={[styles.actionBtn, { flex: 1 }]}
              >
                <Send color={colors.primary} size={18} strokeWidth={2.2} />
                <Text style={styles.actionBtnText}>{t('salon.customer.actionNotification')}</Text>
              </Pressable>
            </View>

            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>{t('salon.customer.notes.title')}</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                onBlur={handleSaveNotes}
                placeholder={t('salon.customer.notes.placeholder')}
                placeholderTextColor={colors.textDim}
                multiline
                style={styles.notesInput}
              />
              {savingNotes && (
                <Text style={styles.savingHint}>{t('salon.customer.notes.saving')}</Text>
              )}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
              {t('salon.customer.history')}
            </Text>
            {cuts.length === 0 && (
              <Text style={styles.emptyHistory}>{t('salon.customer.historyEmpty')}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => <HistoryRow cut={item} t={t} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </Screen>
  );
}

function Stat({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <Card style={styles.stat}>
      <Text style={isText ? styles.statTextValue : styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function HistoryRow({ cut, t }: { cut: Cut; t: (key: any) => string }) {
  const date = new Date(cut.createdAt);
  const bcp47 = localeToBcp47(getCurrentLocale());
  const Icon = cut.wasReward ? Gift : Scissors;
  return (
    <Card>
      <View style={styles.histRow}>
        <View
          style={[
            styles.histIconWrap,
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
          <Text style={styles.histTitle}>
            {cut.wasReward ? t('salon.customer.cut.reward') : t('salon.customer.cut.paid')}
          </Text>
          <Text style={styles.histDate}>
            {date.toLocaleDateString(bcp47, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}{' '}
            ·{' '}
            {date.toLocaleTimeString(bcp47, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  vipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vipToggleActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 235, 59, 0.12)',
  },
  vipToggleText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
  vipToggleTextActive: {
    color: colors.accent,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  phone: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  since: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  progressCard: {
    marginVertical: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statTextValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  actionBtnText: {
    ...typography.button,
    color: colors.primary,
    fontSize: 14,
  },
  actionBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    color: colors.black,
    fontSize: 11,
    fontWeight: '800',
  },
  notesSection: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  notesInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  savingHint: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  emptyHistory: {
    ...typography.body,
    color: colors.textDim,
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  histIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  histDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
