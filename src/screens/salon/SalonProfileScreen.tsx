import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Switch,
  Pressable,
  ScrollView,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  Bell,
  LogOut,
  BarChart3,
  Building2,
  Hash,
  ChevronRight,
  Scissors,
  TrendingUp,
  Camera,
  ImagePlus,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/Avatar';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useT } from '@/i18n';
import { useApp } from '@/contexts/AppContext';
import { getSalon, setSalonLogo } from '@/services/salons';
import { pickPhotoSquare } from '@/services/photos';
import { subscribeSalonStats } from '@/services/stats';
import { signOut } from '@/services/auth';
import { storage } from '@/services/storage';
import { colors, radius, spacing, typography } from '@/theme';
import { Salon, SalonStats } from '@/types';

export function SalonProfileScreen() {
  const nav = useNavigation();
  const { salonId, clearMode } = useApp();
  const { t } = useT();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [stats, setStats] = useState<SalonStats | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    (async () => {
      const s = await getSalon(salonId);
      setSalon(s);
    })();
    const unsub = subscribeSalonStats(salonId, setStats);
    (async () => {
      const settings = await Notifications.getPermissionsAsync();
      setPushEnabled(settings.granted);
    })();
    return unsub;
  }, [salonId]);

  const handleTogglePush = async (enabled: boolean) => {
    if (enabled) {
      const settings = await Notifications.getPermissionsAsync();
      if (!settings.granted) {
        const req = await Notifications.requestPermissionsAsync();
        if (!req.granted) {
          Alert.alert(
            t('client.profile.permissionDeniedTitle'),
            t('client.profile.permissionDeniedText'),
          );
          setPushEnabled(false);
          return;
        }
      }
      setPushEnabled(true);
    } else {
      Alert.alert(
        t('salon.profile.disablePushTitle'),
        t('salon.profile.disablePushText'),
      );
      setPushEnabled(false);
    }
  };

  const handlePickLogo = async () => {
    if (!salonId) return;
    try {
      const photo = await pickPhotoSquare();
      if (photo) {
        await setSalonLogo(salonId, photo);
        const refreshed = await getSalon(salonId);
        setSalon(refreshed);
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  };

  const handleExit = () => {
    Alert.alert(
      t('salon.scanner.exitTitle'),
      t('salon.scanner.exitText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('salon.scanner.exit'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            await storage.resetAll();
            await clearMode();
            nav.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'RoleSelection' as never }],
              }),
            );
          },
        },
      ],
    );
  };

  return (
    <Screen padded scroll>
      <View style={styles.brandHeader}>
        <Pressable onPress={handlePickLogo} style={styles.logoPressable}>
          {salon?.logo ? (
            <Avatar name={salon?.name} photo={salon.logo} size={64} />
          ) : (
            <View style={styles.logoFallback}>
              <Logo size={48} />
            </View>
          )}
          <View style={styles.logoBadge}>
            {salon?.logo ? (
              <Camera color={colors.black} size={12} strokeWidth={2.4} />
            ) : (
              <ImagePlus color={colors.black} size={12} strokeWidth={2.4} />
            )}
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandTitle}>{salon?.name || t('salon.profile.fallbackName')}</Text>
          <Text style={styles.brandSubtitle}>
            {salon?.logo ? t('salon.profile.editLogoChange') : t('salon.profile.editLogoAdd')}
          </Text>
        </View>
      </View>

      <Card style={styles.salonCard} elevated>
        <View style={styles.fieldRow}>
          <Building2 color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('salon.profile.salon')}</Text>
            <Text style={styles.fieldValue}>{salon?.name || '—'}</Text>
            {salon?.city && (
              <Text style={styles.fieldHint}>{salon.city}</Text>
            )}
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Hash color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('salon.profile.activationCode')}</Text>
            <Text style={styles.fieldValue}>{salon?.activationCode || '—'}</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>{t('salon.profile.overview')}</Text>
      {stats ? (
        <Card>
          <View style={styles.miniStatsRow}>
            <MiniStat label={t('salon.profile.today')} value={stats.cutsToday} />
            <MiniStat label={t('salon.profile.thisWeek')} value={stats.cutsWeek} />
            <MiniStat label={t('salon.profile.thisMonth')} value={stats.cutsMonth} />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </Card>
      )}

      <Pressable
        onPress={() => nav.navigate('FullStats' as never)}
        style={styles.linkRow}
      >
        <BarChart3 color={colors.primary} size={20} strokeWidth={2} />
        <Text style={styles.linkText}>{t('salon.profile.viewAllStats')}</Text>
        <ChevronRight color={colors.textMuted} size={18} strokeWidth={2} />
      </Pressable>

      <Text style={styles.sectionTitle}>{t('salon.profile.team')}</Text>
      <Pressable
        onPress={() => nav.navigate('Barbers' as never)}
        style={styles.linkRow}
      >
        <Scissors color={colors.primary} size={20} strokeWidth={2} />
        <Text style={styles.linkText}>{t('salon.profile.myBarbers')}</Text>
        <ChevronRight color={colors.textMuted} size={18} strokeWidth={2} />
      </Pressable>
      <View style={{ height: spacing.sm }} />
      <Pressable
        onPress={() => nav.navigate('BarberStats' as never)}
        style={styles.linkRow}
      >
        <TrendingUp color={colors.primary} size={20} strokeWidth={2} />
        <Text style={styles.linkText}>{t('salon.profile.barberStats')}</Text>
        <ChevronRight color={colors.textMuted} size={18} strokeWidth={2} />
      </Pressable>

      <Text style={styles.sectionTitle}>{t('salon.profile.notifications')}</Text>
      <Card>
        <View style={styles.settingRow}>
          <Bell color={colors.primary} size={20} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{t('salon.profile.pushTitle')}</Text>
            <Text style={styles.settingHint}>{t('salon.profile.pushHint')}</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={handleTogglePush}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      <Text style={styles.sectionTitle}>{t('salon.profile.language')}</Text>
      <LanguagePicker />

      <Pressable onPress={handleExit} style={styles.exitBtn}>
        <LogOut color={colors.danger} size={18} strokeWidth={2.2} />
        <Text style={styles.exitText}>{t('salon.profile.exit')}</Text>
      </Pressable>
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  logoPressable: {
    position: 'relative',
  },
  logoFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  brandTitle: {
    ...typography.h2,
    color: colors.text,
  },
  brandSubtitle: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  salonCard: {
    gap: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  fieldValue: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: 2,
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  miniStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  miniStat: {
    alignItems: 'center',
  },
  miniStatValue: {
    ...typography.h1,
    color: colors.primary,
  },
  miniStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  linkText: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  settingHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  exitText: {
    ...typography.button,
    color: colors.danger,
  },
});
