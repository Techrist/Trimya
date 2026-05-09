import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus, ChevronRight, UserPlus } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { BarberAvatar } from '@/components/BarberAvatar';
import { useApp } from '@/contexts/AppContext';
import { subscribeBarbers } from '@/services/barbers';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Barber } from '@/types';
import { ProfileStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Barbers'>;

export function SalonBarbersScreen() {
  const nav = useNavigation<Nav>();
  const { salonId } = useApp();
  const { t } = useT();
  const [list, setList] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeBarbers(salonId, (rows) => {
      setList(rows);
      setLoading(false);
    });
    return unsub;
  }, [salonId]);

  const activeCount = list.filter((b) => b.active).length;
  const inactiveCount = list.length - activeCount;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('salon.barbers.title')}</Text>
        <Pressable
          onPress={() => nav.navigate('BarberForm', {})}
          hitSlop={12}
          style={styles.addBtn}
        >
          <Plus color={colors.primary} size={24} strokeWidth={2.4} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <UserPlus color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('salon.barbers.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('salon.barbers.empty.text')}</Text>
          <View style={{ height: spacing.lg }} />
          <Button
            label={t('salon.barbers.empty.cta')}
            onPress={() => nav.navigate('BarberForm', {})}
            fullWidth={false}
          />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <Text style={styles.subtitle}>
              {t(activeCount > 1 ? 'salon.barbers.activeCountPlural' : 'salon.barbers.activeCount', { count: activeCount })}
              {inactiveCount > 0 && t(inactiveCount > 1 ? 'salon.barbers.inactiveCountPlural' : 'salon.barbers.inactiveCount', { count: inactiveCount })}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => nav.navigate('BarberForm', { barberId: item.id })}
            >
              <Card style={!item.active ? styles.cardInactive : undefined}>
                <View style={styles.row}>
                  <BarberAvatar barber={item} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.name, !item.active && styles.nameInactive]}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.status}>
                      {item.active ? t('salon.barbers.status.active') : t('salon.barbers.status.inactive')}
                    </Text>
                  </View>
                  <ChevronRight color={colors.textDim} size={18} strokeWidth={2} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
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
  addBtn: {
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
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  list: {
    padding: spacing.lg,
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
  cardInactive: {
    opacity: 0.55,
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
  nameInactive: {
    textDecorationLine: 'line-through',
  },
  status: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
