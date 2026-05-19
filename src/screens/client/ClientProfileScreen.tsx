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
import {
  Bell, LogOut, Phone, User as UserIcon, Pencil, Check, X, Camera, ImagePlus,
  Mail, Cake, Scissors, AlertTriangle, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useT } from '@/i18n';
import { storage } from '@/services/storage';
import {
  subscribeCustomer,
  setCustomerName,
  setCustomerPushEnabled,
  setCustomerPhoto,
  updateCustomerPersonalInfo,
  requestAccountDeletion,
  cancelAccountDeletion,
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

  // Infos personnelles (email, date naissance)
  const [email, setEmail] = useState('');
  const [birthdate, setBirthdate] = useState(''); // YYYY-MM-DD
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Préférences
  const [cutNote, setCutNote] = useState('');
  const [beardNote, setBeardNote] = useState('');
  const [allergies, setAllergies] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // État des sections repliables — par défaut fermées pour alléger l'écran
  const [infoOpen, setInfoOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Suppression compte
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) return;
      unsub = subscribeCustomer(id, (c) => {
        setCustomer(c);
        setPushEnabled(c?.pushEnabled !== false && !!c?.pushToken);
        if (c) {
          setEmail(c.email ?? '');
          setBirthdate(c.birthdate ?? '');
          setCutNote(c.preferences?.cutNote ?? '');
          setBeardNote(c.preferences?.beardNote ?? '');
          setAllergies(c.preferences?.allergies ?? '');
        }
      });
    })();
    return () => unsub?.();
  }, []);

  // Helpers
  const isValidEmail = (v: string) =>
    v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const isValidBirthdate = (v: string) => {
    if (v === '') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return false;
    const year = d.getFullYear();
    return year >= 1900 && d.getTime() <= Date.now();
  };

  const handleSavePersonal = async () => {
    if (!customer) return;
    if (!isValidEmail(email)) {
      Alert.alert(t('common.error'), t('client.profile.emailInvalid'));
      return;
    }
    if (!isValidBirthdate(birthdate)) {
      Alert.alert(t('common.error'), t('client.profile.birthdateInvalid'));
      return;
    }
    setSavingPersonal(true);
    try {
      await updateCustomerPersonalInfo(customer.id, {
        email: email.trim() || null,
        birthdate: birthdate.trim() || null,
      });
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!customer) return;
    setSavingPrefs(true);
    try {
      await updateCustomerPersonalInfo(customer.id, {
        preferences: {
          cutNote: cutNote.trim() || null,
          beardNote: beardNote.trim() || null,
          allergies: allergies.trim() || null,
        },
      });
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleRequestDeletion = () => {
    Alert.alert(
      t('client.profile.deleteConfirmTitle'),
      t('client.profile.deleteConfirmText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('client.profile.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            if (!customer) return;
            setDeleting(true);
            try {
              await requestAccountDeletion(customer.id);
              // Sign out + retour à l'écran de sélection de rôle.
              await signOut();
              await storage.resetAll();
              await clearMode();
              nav.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'RoleSelection' as never }],
                }),
              );
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelDeletion = async () => {
    if (!customer) return;
    try {
      await cancelAccountDeletion(customer.id);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  };

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

      {customer.deletionRequestedAt ? (
        <Card style={styles.deletionWarn}>
          <View style={styles.deletionWarnRow}>
            <AlertTriangle color={colors.danger} size={22} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.deletionWarnTitle}>
                {t('client.profile.deletePendingTitle')}
              </Text>
              <Text style={styles.deletionWarnText}>
                {t('client.profile.deletePendingText')}
              </Text>
            </View>
          </View>
          <View style={{ height: spacing.sm }} />
          <Button
            label={t('client.profile.deleteCancel')}
            onPress={handleCancelDeletion}
            variant="secondary"
          />
        </Card>
      ) : null}

      <CollapsibleCard
        icon={<Mail color={colors.primary} size={20} strokeWidth={2.2} />}
        title={t('client.profile.personalInfo')}
        summary={
          email || birthdate
            ? t('client.profile.personalInfo.summaryFilled')
            : t('client.profile.personalInfo.summaryEmpty')
        }
        open={infoOpen}
        onToggle={() => setInfoOpen((v) => !v)}
      >
        <View style={styles.fieldRow}>
          <Mail color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.profile.fieldEmail')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('client.profile.emailPlaceholder')}
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.plainInput}
            />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <Cake color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.profile.fieldBirthdate')}</Text>
            <TextInput
              value={birthdate}
              onChangeText={setBirthdate}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor={colors.textDim}
              keyboardType="numbers-and-punctuation"
              style={styles.plainInput}
              maxLength={10}
            />
            <Text style={styles.fieldHint}>{t('client.profile.birthdateHint')}</Text>
          </View>
        </View>
        <Button
          label={t('client.profile.savePersonal')}
          onPress={handleSavePersonal}
          loading={savingPersonal}
        />
      </CollapsibleCard>

      <CollapsibleCard
        icon={<Scissors color={colors.primary} size={20} strokeWidth={2.2} />}
        title={t('client.profile.preferences')}
        summary={
          cutNote || beardNote || allergies
            ? t('client.profile.preferences.summaryFilled')
            : t('client.profile.preferences.summaryEmpty')
        }
        open={prefsOpen}
        onToggle={() => setPrefsOpen((v) => !v)}
      >
        <View style={styles.fieldRow}>
          <Scissors color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.profile.prefCut')}</Text>
            <TextInput
              value={cutNote}
              onChangeText={setCutNote}
              placeholder={t('client.profile.prefCutPlaceholder')}
              placeholderTextColor={colors.textDim}
              style={styles.plainInput}
              multiline
              maxLength={200}
            />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <Scissors color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.profile.prefBeard')}</Text>
            <TextInput
              value={beardNote}
              onChangeText={setBeardNote}
              placeholder={t('client.profile.prefBeardPlaceholder')}
              placeholderTextColor={colors.textDim}
              style={styles.plainInput}
              multiline
              maxLength={200}
            />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <AlertTriangle color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.profile.prefAllergies')}</Text>
            <TextInput
              value={allergies}
              onChangeText={setAllergies}
              placeholder={t('client.profile.prefAllergiesPlaceholder')}
              placeholderTextColor={colors.textDim}
              style={styles.plainInput}
              multiline
              maxLength={200}
            />
          </View>
        </View>
        <Button
          label={t('client.profile.savePrefs')}
          onPress={handleSavePrefs}
          loading={savingPrefs}
          variant="secondary"
        />
      </CollapsibleCard>

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

      {!customer.deletionRequestedAt ? (
        <Pressable
          onPress={handleRequestDeletion}
          disabled={deleting}
          style={styles.deleteAccountBtn}
        >
          <Trash2 color={colors.textMuted} size={16} strokeWidth={2} />
          <Text style={styles.deleteAccountText}>
            {t('client.profile.deleteAccount')}
          </Text>
        </Pressable>
      ) : null}
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

/**
 * Section repliable réutilisable, par défaut fermée pour alléger l'écran.
 * Le header est tappable, affiche l'icône + le titre + un résumé compact
 * (ex. "Renseignées" / "Vide") et un chevron qui indique l'état.
 */
function CollapsibleCard({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.collapsibleCard}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={styles.collapsibleHeader}
      >
        <View style={styles.collapsibleLeft}>
          {icon}
          <View style={{ flex: 1 }}>
            <Text style={styles.collapsibleTitle}>{title}</Text>
            {summary ? (
              <Text style={styles.collapsibleSummary} numberOfLines={1}>
                {summary}
              </Text>
            ) : null}
          </View>
        </View>
        {open ? (
          <ChevronUp color={colors.textMuted} size={20} strokeWidth={2.2} />
        ) : (
          <ChevronDown color={colors.textMuted} size={20} strokeWidth={2.2} />
        )}
      </Pressable>
      {open ? (
        <View style={styles.collapsibleBody}>{children}</View>
      ) : null}
    </Card>
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
  collapsibleCard: {
    marginTop: spacing.md,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  collapsibleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  collapsibleTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  collapsibleSummary: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  collapsibleBody: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  plainInput: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  deletionWarn: {
    borderColor: colors.danger,
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    marginBottom: spacing.md,
  },
  deletionWarnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  deletionWarnTitle: {
    ...typography.bodyBold,
    color: colors.danger,
  },
  deletionWarnText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteAccountText: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
