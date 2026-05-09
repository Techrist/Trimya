import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Bell, LogOut, Phone, User as UserIcon, Pencil, Check, X, Camera, ImagePlus } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useT } from '@/i18n';
import { storage } from '@/services/storage';
import {
  subscribeCustomer,
  setCustomerName,
  setCustomerPushEnabled,
  setCustomerPhoto,
} from '@/services/customers';
import { pickPhotoSquare } from '@/services/photos';
import { registerPushTokenForCustomer } from '@/services/push';
import { signOut } from '@/services/auth';
import { useApp } from '@/contexts/AppContext';
import { colors, radius, spacing, typography } from '@/theme';
import { Customer } from '@/types';

export function ClientProfileScreen() {
  const nav = useNavigation();
  const { clearMode } = useApp();
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) return;
      unsub = subscribeCustomer(id, (c) => {
        setCustomer(c);
        setPushEnabled(c?.pushEnabled !== false && !!c?.pushToken);
      });
    })();
    return () => unsub?.();
  }, []);

  const handleStartEditName = () => {
    setNameDraft(customer?.name || '');
    setEditingName(true);
  };

  const handlePickPhoto = async () => {
    if (!customer) return;
    try {
      const photo = await pickPhotoSquare();
      if (photo) {
        await setCustomerPhoto(customer.id, photo);
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  };

  const handleSaveName = async () => {
    if (!customer) return;
    const v = nameDraft.trim();
    if (v.length < 2) {
      Alert.alert(t('auth.name.tooShort'), t('auth.name.tooShortHint'));
      return;
    }
    setSavingName(true);
    try {
      await setCustomerName(customer.id, v);
      setEditingName(false);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleTogglePush = async (enabled: boolean) => {
    if (!customer) return;
    setPushEnabled(enabled);
    try {
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
        await registerPushTokenForCustomer(customer.id);
      }
      await setCustomerPushEnabled(customer.id, enabled);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
      setPushEnabled(!enabled);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('client.profile.signOutTitle'), t('client.profile.signOutText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('client.profile.signOut'),
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
    ]);
  };

  if (!customer) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen padded scroll>
      <Text style={styles.title}>{t('client.profile.title')}</Text>

      <Card style={styles.profileCard} elevated>
        <Pressable onPress={handlePickPhoto} style={styles.avatarPressable}>
          <Avatar name={customer.name} photo={customer.photo} size={96} />
          <View style={styles.photoBadge}>
            {customer.photo ? (
              <Camera color={colors.black} size={14} strokeWidth={2.4} />
            ) : (
              <ImagePlus color={colors.black} size={14} strokeWidth={2.4} />
            )}
          </View>
        </Pressable>

        <View style={styles.fieldRow}>
          <UserIcon color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.profile.fieldFirstName')}</Text>
            {editingName ? (
              <View style={styles.editRow}>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                  style={styles.editInput}
                  placeholderTextColor={colors.textDim}
                />
                <Pressable onPress={handleSaveName} disabled={savingName}>
                  <Check color={colors.success} size={20} strokeWidth={2.4} />
                </Pressable>
                <Pressable onPress={() => setEditingName(false)}>
                  <X color={colors.textMuted} size={20} strokeWidth={2.4} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.editRow}>
                <Text style={styles.fieldValue}>{customer.name || '—'}</Text>
                <Pressable onPress={handleStartEditName}>
                  <Pencil color={colors.textMuted} size={16} strokeWidth={2} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Phone color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.profile.fieldPhone')}</Text>
            <Text style={styles.fieldValue}>{customer.phone}</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>{t('client.profile.notifications')}</Text>
      <Card>
        <View style={styles.settingRow}>
          <Bell color={colors.primary} size={20} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{t('client.profile.pushTitle')}</Text>
            <Text style={styles.settingHint}>{t('client.profile.pushHint')}</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={handleTogglePush}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      <Text style={styles.sectionTitle}>{t('client.profile.language')}</Text>
      <LanguagePicker />

      <Text style={styles.sectionTitle}>{t('client.profile.stats')}</Text>
      <Card>
        <View style={styles.statsRow}>
          <Stat label={t('client.profile.stat.cuts')} value={customer.totalCuts} />
          <Stat label={t('client.profile.stat.rewards')} value={customer.totalRewards} />
          <Stat label={t('client.profile.stat.progress')} value={`${customer.currentCount}/4`} isText />
        </View>
      </Card>

      <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
        <LogOut color={colors.danger} size={18} strokeWidth={2.2} />
        <Text style={styles.signOutText}>{t('client.profile.signOut')}</Text>
      </Pressable>
    </Screen>
  );
}

function Stat({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={isText ? styles.statTextValue : styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  profileCard: {
    alignItems: 'stretch',
    gap: spacing.md,
  },
  avatarPressable: {
    alignSelf: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  photoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surfaceElevated,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
    flex: 1,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  editInput: {
    flex: 1,
    ...typography.bodyBold,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statTextValue: {
    ...typography.h2,
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  signOutBtn: {
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
  signOutText: {
    ...typography.button,
    color: colors.danger,
  },
});
