import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  Pressable,
  Linking,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import {
  LogOut,
  Mail,
  Phone,
  User as UserIcon,
  Pencil,
  Check,
  X,
  Crown,
  KeyRound,
  MessageCircle,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useApp } from '@/contexts/AppContext';
import { useOwner } from '@/hooks/useOwner';
import {
  updateOwnerProfile,
  changeOwnerPassword,
} from '@/services/owners';
import { signOut } from '@/services/auth';
import { storage } from '@/services/storage';
import {
  PLANS,
  isOwnerEnterpriseActive,
  planExpiresInDays,
  formatPlanPrice,
  getPlanLabel,
  type OwnerPlanId,
} from '@/lib/plans';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

const CONTACT_WHATSAPP = '+237692979345';
const CONTACT_EMAIL = 'tenimkoc@gmail.com';

export function OwnerProfileScreen() {
  const nav = useNavigation();
  const { ownerId, clearMode } = useApp();
  const { owner } = useOwner(ownerId);
  const { t } = useT();

  const [editName, setEditName] = useState(false);
  const [editPhone, setEditPhone] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  if (!owner) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const enterprise = isOwnerEnterpriseActive(owner);
  const expiresInDays = planExpiresInDays(owner);

  const handleStartEditName = () => {
    setNameDraft(owner.name);
    setEditName(true);
  };
  const handleSaveName = async () => {
    const v = nameDraft.trim();
    if (v.length < 2) {
      Alert.alert(t('common.error'), t('owner.profile.nameTooShort'));
      return;
    }
    setSavingName(true);
    try {
      await updateOwnerProfile(owner.id, { name: v });
      setEditName(false);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleStartEditPhone = () => {
    setPhoneDraft(owner.phone ?? '');
    setEditPhone(true);
  };
  const handleSavePhone = async () => {
    setSavingPhone(true);
    try {
      await updateOwnerProfile(owner.id, { phone: phoneDraft.trim() || null });
      setEditPhone(false);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSavingPhone(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('owner.profile.passwordMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      await changeOwnerPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      Alert.alert(t('common.done'), t('owner.profile.passwordChanged'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleContact = () => {
    Linking.openURL(
      `whatsapp://send?phone=${encodeURIComponent(
        CONTACT_WHATSAPP.replace(/\s/g, ''),
      )}&text=${encodeURIComponent(
        t('owner.profile.whatsappMessage', { email: owner.email }),
      )}`,
    ).catch(() =>
      Linking.openURL(
        `https://wa.me/${CONTACT_WHATSAPP.replace(/[^0-9]/g, '')}`,
      ),
    );
  };

  const handleEmail = () => {
    Linking.openURL(
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('owner.profile.emailSubject'))}`,
    );
  };

  const handleSignOut = () => {
    Alert.alert(t('owner.profile.signOutTitle'), t('owner.profile.signOutText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.profile.signOut'),
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

  return (
    <Screen padded scroll>
      <Text style={styles.title}>{t('owner.profile.title')}</Text>

      {/* Plan */}
      <Card style={styles.planCard} elevated>
        <View style={styles.planRow}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: enterprise
                  ? 'rgba(255, 235, 59, 0.12)'
                  : colors.surfaceElevated,
              },
            ]}
          >
            <Crown
              color={enterprise ? colors.accent : colors.textMuted}
              size={28}
              strokeWidth={2.2}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planLabel}>{t('owner.profile.currentPlan')}</Text>
            <Text style={styles.planName}>
              {enterprise && owner.plan
                ? getPlanLabel(owner.plan as OwnerPlanId, t)
                : t('owner.profile.noPlan')}
            </Text>
            <Text style={styles.planMeta}>
              {enterprise && expiresInDays !== null && expiresInDays > 0
                ? t('owner.profile.expiresIn', { days: expiresInDays })
                : enterprise
                  ? t('owner.profile.noExpiry')
                  : t('owner.profile.noPlanHint')}
            </Text>
          </View>
        </View>
        <Text style={styles.planPrice}>
          {/* Affiche le prix du plan actif. Si pas d'abonnement, on montre
              le tarif de l'Entreprise Standard (point d'entrée le moins cher)
              pour donner une idée à l'owner non-abonné. */}
          {formatPlanPrice(
            PLANS[(owner.plan as OwnerPlanId) || 'enterprise_standard'],
          )}
        </Text>

        {enterprise && expiresInDays !== null && expiresInDays <= 14 ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              label={t('owner.profile.renewCta')}
              onPress={handleContact}
            />
          </View>
        ) : !enterprise ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              label={t('owner.profile.activateCta')}
              onPress={handleContact}
            />
          </View>
        ) : null}
      </Card>

      {/* Profil */}
      <Text style={styles.sectionTitle}>{t('owner.profile.account')}</Text>
      <Card style={styles.profileCard}>
        <View style={styles.fieldRow}>
          <UserIcon color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('owner.profile.name')}</Text>
            {editName ? (
              <View style={styles.editRow}>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                  style={styles.editInput}
                />
                <Pressable onPress={handleSaveName} disabled={savingName}>
                  <Check color={colors.success} size={20} strokeWidth={2.4} />
                </Pressable>
                <Pressable onPress={() => setEditName(false)}>
                  <X color={colors.textMuted} size={20} strokeWidth={2.4} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.editRow}>
                <Text style={styles.fieldValue}>{owner.name}</Text>
                <Pressable onPress={handleStartEditName}>
                  <Pencil color={colors.textMuted} size={16} strokeWidth={2} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Mail color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('owner.profile.email')}</Text>
            <Text style={styles.fieldValue}>{owner.email}</Text>
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Phone color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('owner.profile.phone')}</Text>
            {editPhone ? (
              <View style={styles.editRow}>
                <TextInput
                  value={phoneDraft}
                  onChangeText={setPhoneDraft}
                  autoFocus
                  keyboardType="phone-pad"
                  style={styles.editInput}
                  placeholder="+237 6 12 34 56 78"
                  placeholderTextColor={colors.textDim}
                />
                <Pressable onPress={handleSavePhone} disabled={savingPhone}>
                  <Check color={colors.success} size={20} strokeWidth={2.4} />
                </Pressable>
                <Pressable onPress={() => setEditPhone(false)}>
                  <X color={colors.textMuted} size={20} strokeWidth={2.4} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.editRow}>
                <Text style={styles.fieldValue}>{owner.phone || '—'}</Text>
                <Pressable onPress={handleStartEditPhone}>
                  <Pencil color={colors.textMuted} size={16} strokeWidth={2} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Card>

      {/* Changer mot de passe */}
      <Text style={styles.sectionTitle}>{t('owner.profile.security')}</Text>
      <Card>
        {!showPasswordForm ? (
          <Pressable
            onPress={() => setShowPasswordForm(true)}
            style={styles.actionRow}
          >
            <KeyRound color={colors.primary} size={20} strokeWidth={2} />
            <Text style={styles.actionText}>
              {t('owner.profile.changePassword')}
            </Text>
          </Pressable>
        ) : (
          <View>
            <Text style={styles.formLabel}>
              {t('owner.profile.newPassword')}
            </Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              style={styles.passwordInput}
              placeholder={t('owner.profile.passwordPlaceholder')}
              placeholderTextColor={colors.textDim}
            />
            <Text style={[styles.formLabel, { marginTop: spacing.sm }]}>
              {t('owner.profile.confirmPassword')}
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              style={styles.passwordInput}
              placeholder={t('owner.profile.passwordPlaceholder')}
              placeholderTextColor={colors.textDim}
            />
            <View style={styles.formButtons}>
              <Button
                label={t('common.cancel')}
                onPress={() => {
                  setShowPasswordForm(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                variant="ghost"
                fullWidth={false}
              />
              <Button
                label={t('owner.profile.savePassword')}
                onPress={handleChangePassword}
                loading={savingPassword}
                disabled={!newPassword || newPassword.length < 8}
                fullWidth={false}
              />
            </View>
          </View>
        )}
      </Card>

      {/* Contact */}
      <Text style={styles.sectionTitle}>{t('owner.profile.support')}</Text>
      <Card>
        <Pressable onPress={handleContact} style={styles.actionRow}>
          <MessageCircle color={colors.primary} size={20} strokeWidth={2} />
          <Text style={styles.actionText}>{t('owner.profile.supportWhatsapp')}</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable onPress={handleEmail} style={styles.actionRow}>
          <Mail color={colors.primary} size={20} strokeWidth={2} />
          <Text style={styles.actionText}>{t('owner.profile.supportEmail')}</Text>
        </Pressable>
      </Card>

      <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
        <LogOut color={colors.danger} size={18} strokeWidth={2.2} />
        <Text style={styles.signOutText}>{t('owner.profile.signOut')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  planCard: {
    marginBottom: spacing.lg,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  planName: {
    ...typography.h2,
    color: colors.text,
    marginTop: 2,
  },
  planMeta: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  planPrice: {
    ...typography.bodyBold,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  profileCard: {
    gap: spacing.md,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionText: {
    ...typography.bodyBold,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  formLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  passwordInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
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
