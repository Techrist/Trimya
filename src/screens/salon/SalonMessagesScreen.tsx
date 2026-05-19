import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Star, ChevronRight, MessageCircle } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { LockedFeature } from '@/components/LockedFeature';
import { getCustomer } from '@/services/customers';
import { useT, getCurrentLocale, localeToBcp47 } from '@/i18n';
import { useApp } from '@/contexts/AppContext';
import { useSalonPlan } from '@/hooks/useSalonPlan';
import { subscribeSalonConversations } from '@/services/conversations';
import { colors, radius, spacing, typography } from '@/theme';
import { Conversation } from '@/types';
import { MessagesStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'MessagesList'>;

export function SalonMessagesScreen() {
  const nav = useNavigation<Nav>();
  const { salonId } = useApp();
  const { t } = useT();
  const { limits, loading: planLoading } = useSalonPlan(salonId);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId || !limits.messaging) {
      setLoading(false);
      return;
    }
    const unsub = subscribeSalonConversations(salonId, (list) => {
      setConvos(list);
      setLoading(false);
    });
    return unsub;
  }, [salonId, limits.messaging]);

  // Bloqué pour les salons en plan Free.
  if (!planLoading && !limits.messaging) {
    return <LockedFeature requiredPlan="standard" />;
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('salon.messages.title')}</Text>
        <Text style={styles.subtitle}>
          {t(convos.length > 1 ? 'salon.messages.countPlural' : 'salon.messages.count', { count: convos.length })}
        </Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : convos.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <MessageCircle color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('salon.messages.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('salon.messages.empty.text')}</Text>
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <ConvoRow
              convo={item}
              onPress={() =>
                nav.navigate('Chat', { customerId: item.customerId })
              }
              t={t}
            />
          )}
        />
      )}
    </Screen>
  );
}

function ConvoRow({
  convo,
  onPress,
  t,
}: {
  convo: Conversation;
  onPress: () => void;
  t: (key: any) => string;
}) {
  const time = formatTime(convo.lastMessageAt, t);
  const hasUnread = convo.unreadBySalon > 0;

  return (
    <Pressable onPress={onPress}>
      <Card style={hasUnread ? styles.cardUnread : undefined}>
        <View style={styles.row}>
          <Avatar name={convo.customerName} photo={convo.customerPhoto} size={48} />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.name, hasUnread && styles.nameUnread]}
                numberOfLines={1}
              >
                {convo.customerName || t('salon.reservation.client')}
              </Text>
              {convo.customerVip && (
                <Star
                  color={colors.accent}
                  size={14}
                  strokeWidth={2.2}
                  fill={colors.accent}
                />
              )}
              <Text style={styles.time}>{time}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text
                style={[styles.preview, hasUnread && styles.previewUnread]}
                numberOfLines={1}
              >
                {convo.lastSenderRole === 'salon' && t('salon.messages.preview.you')}
                {convo.lastMessage || t('salon.messages.preview.empty')}
              </Text>
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {convo.unreadBySalon > 99 ? '99+' : convo.unreadBySalon}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <ChevronRight color={colors.textDim} size={18} strokeWidth={2} />
        </View>
      </Card>
    </Pressable>
  );
}

function formatTime(ts: number, t: (key: any) => string): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const bcp47 = localeToBcp47(getCurrentLocale());
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString(bcp47, { hour: '2-digit', minute: '2-digit' });
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (
    date.getDate() === yest.getDate() &&
    date.getMonth() === yest.getMonth() &&
    date.getFullYear() === yest.getFullYear()
  ) {
    return t('salon.messages.day.yesterday');
  }
  return date.toLocaleDateString(bcp47, { day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: {
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h3,
    color: colors.primary,
  },
  cardUnread: {
    borderColor: colors.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  nameUnread: {
    fontWeight: '800',
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing.sm,
  },
  preview: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  previewUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: colors.black,
    fontSize: 11,
    fontWeight: '800',
  },
});
