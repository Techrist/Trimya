import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Scissors, Crown } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { LegalLinks } from '@/components/LegalLinks';
import { AuthFooterLink } from '@/components/AuthFooterLink';
import { accountErrorText, isStrongPassword } from '@/lib/accountErrors';
import {
  requestSignupCode,
  signInWithPassword,
  submitSignup,
  verifySignupCode,
  type AccountType,
} from '@/services/account';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AccountSignUp'>;
type Step = 'type' | 'creds' | 'code' | 'profile';

/**
 * Création de compte (salon ou propriétaire de chaîne) :
 *   1. type            2. email + mot de passe → code envoyé
 *   3. validation du code               4. infos du salon / du propriétaire
 * Puis l'utilisateur est connecté et attend la validation de l'admin.
 */
export function AccountSignUpScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'AccountSignUp'>>();
  const { t } = useT();
  const { setMode } = useApp();

  const preset = route.params?.type;
  const [type, setType] = useState<AccountType | null>(preset ?? null);
  const [step, setStep] = useState<Step>(preset ? 'creds' : 'type');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [proof, setProof] = useState('');

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [salonCount, setSalonCount] = useState('');
  const [accepted, setAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    if (!isStrongPassword(password)) return setError(t('account.error.weak_password'));
    if (password !== confirm) return setError(t('account.error.password_mismatch'));
    setLoading(true);
    try {
      await requestSignupCode(email);
      setStep('code');
      setInfo(t('account.signUp.codeSent'));
    } catch (e) {
      setError(accountErrorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      setProof(await verifySignupCode(email, code));
      setStep('profile');
    } catch (e) {
      setError(accountErrorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!type) return;
    setLoading(true);
    setError(null);
    try {
      const count = Number.parseInt(salonCount, 10);
      await submitSignup({
        email,
        proof,
        password,
        profile:
          type === 'salon'
            ? { type: 'salon', name, city, ownerName: managerName, phone }
            : {
                type: 'owner',
                name,
                phone,
                ...(company.trim() ? { companyName: company } : {}),
                ...(Number.isFinite(count) && count >= 1 && count <= 50
                  ? { salonCount: count }
                  : {}),
              },
      });
      // Compte créé : connexion immédiate, puis attente de la validation.
      await signInWithPassword(email, password);
      await setMode(type);
      nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'AccountPending' }] }));
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      // Preuve expirée / déjà utilisée : on repart de l'étape du code.
      if (raw === 'verification_required') {
        setCode('');
        setStep('code');
      }
      setError(accountErrorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  const profileValid =
    name.trim().length >= 2 &&
    phone.replace(/\D/g, '').length >= 8 &&
    accepted &&
    (type === 'salon' ? city.trim().length >= 2 && managerName.trim().length >= 2 : true);

  const subtitle =
    step === 'type'
      ? t('account.signUp.typeSubtitle')
      : step === 'creds'
        ? t('account.signUp.credsSubtitle')
        : step === 'code'
          ? t('account.signUp.codeSubtitle', { email: email.trim() })
          : t('account.signUp.profileSubtitle');

  return (
    <Screen padded keyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Logo size={72} />
          <Text style={styles.title}>{t('account.signUp.title')}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {step === 'type' ? (
          <View style={{ gap: spacing.md }}>
            {(
              [
                ['salon', Scissors, 'account.signUp.type.salon', 'account.signUp.type.salonText'],
                ['owner', Crown, 'account.signUp.type.owner', 'account.signUp.type.ownerText'],
              ] as const
            ).map(([value, Icon, titleKey, textKey]) => (
              <Pressable
                key={value}
                style={styles.typeCard}
                onPress={() => {
                  setType(value);
                  setStep('creds');
                }}
              >
                <Icon color={colors.primary} size={26} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeTitle}>{t(titleKey)}</Text>
                  <Text style={styles.typeText}>{t(textKey)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 'creds' ? (
          <>
            <TextField
              label={t('account.field.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              maxLength={254}
            />
            <TextField
              label={t('account.field.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              maxLength={128}
            />
            <Text style={styles.hint}>{t('account.password.hint')}</Text>
            <TextField
              label={t('account.field.confirmPassword')}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              maxLength={128}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={t('account.signUp.sendCode')}
              onPress={sendCode}
              loading={loading}
              disabled={!emailValid || !password || !confirm}
            />
          </>
        ) : null}

        {step === 'code' ? (
          <>
            <TextField
              label={t('account.field.code')}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
            />
            {info ? <Text style={styles.info}>{info}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={t('account.signUp.verify')}
              onPress={verifyCode}
              loading={loading}
              disabled={code.length !== 6}
            />
            <Button
              label={t('account.signUp.resend')}
              onPress={sendCode}
              variant="ghost"
              disabled={loading}
            />
            <Button
              label={t('account.signUp.changeEmail')}
              onPress={() => {
                setStep('creds');
                setCode('');
                setError(null);
                setInfo(null);
              }}
              variant="ghost"
              disabled={loading}
            />
          </>
        ) : null}

        {step === 'profile' ? (
          <>
            <TextField
              label={t(type === 'salon' ? 'account.signUp.salonName' : 'account.signUp.ownerName')}
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            {type === 'salon' ? (
              <>
                <TextField
                  label={t('account.signUp.city')}
                  value={city}
                  onChangeText={setCity}
                  maxLength={80}
                />
                <TextField
                  label={t('account.signUp.managerName')}
                  value={managerName}
                  onChangeText={setManagerName}
                  maxLength={80}
                />
              </>
            ) : (
              <>
                <TextField
                  label={t('account.signUp.company')}
                  value={company}
                  onChangeText={setCompany}
                  maxLength={80}
                />
                <TextField
                  label={t('account.signUp.salonCount')}
                  value={salonCount}
                  onChangeText={(v) => setSalonCount(v.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </>
            )}
            <TextField
              label={t('account.signUp.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={25}
            />

            <ConsentCheckbox checked={accepted} onChange={setAccepted} />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={{ height: spacing.md }} />
            <Button
              label={t('account.signUp.submit')}
              onPress={submit}
              loading={loading}
              disabled={!profileValid}
            />
          </>
        ) : null}

        <AuthFooterLink
          text={t('account.signUp.alreadyHave')}
          linkText={t('account.signUp.signInLink')}
          onPress={() => nav.replace('AccountSignIn')}
        />
        <LegalLinks variant="inline" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
  },
  typeTitle: { ...typography.h3, color: colors.text },
  typeText: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  hint: { ...typography.caption, color: colors.textDim, marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  info: { ...typography.caption, color: colors.success, textAlign: 'center', marginBottom: spacing.sm },
});
