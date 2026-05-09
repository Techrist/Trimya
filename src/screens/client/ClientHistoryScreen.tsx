import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Scissors, Gift } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { storage } from '@/services/storage';
import { subscribeRecentCuts } from '@/services/cuts';
import { useT, getCurrentLocale, localeToBcp47 } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { Cut } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientHistory'>;

export function ClientHistoryScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) {
        setLoading(false);
        return;
      }
      unsub = subscribeRecentCuts(id, (list) => {
        setCuts(list);
        setLoading(false);
      });
    })();
    return () => unsub?.();
  }, []);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('client.history.title')}</Text>
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
          renderItem={({ item }) => <HistoryItem cut={item} t={t} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}

      <View style={styles.footer}>
        <Button label={t('common.back')} onPress={() => nav.goBack()} variant="secondary" />
      </View>
    </Screen>
  );
}

function HistoryItem({ cut, t }: { cut: Cut; t: (key: any, params?: Record<string, string | number>) => string }) {
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
        </View>
      </View>
    </Card>
  );
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
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
