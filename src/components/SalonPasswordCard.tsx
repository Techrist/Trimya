import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { TextField } from './TextField';
import { accountErrorText, isStrongPassword } from '@/lib/accountErrors';
import { setOwnerSalonPassword } from '@/services/ownerSalons';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

/**
 * Carte « mot de passe de connexion » d'un salon, affichée au propriétaire
 * sur la fiche du salon : il peut en choisir un nouveau (les sessions ouvertes
 * du salon sont révoquées côté serveur).
 */
export function SalonPasswordCard({ salonId }: { salonId: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!isStrongPassword(password)) return setError(t('account.error.weak_password'));
    setLoading(true);
    try {
      await setOwnerSalonPassword(salonId, password);
      setDone(true);
      setPassword('');
      setOpen(false);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(code === 'no_login_account' ? t('owner.salonPassword.noAccount') : accountErrorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('owner.salonPassword.title')}</Text>
      {done ? <Text style={styles.success}>{t('owner.salonPassword.done')}</Text> : null}
      {open ? (
        <View style={{ marginTop: spacing.sm }}>
          <TextField
            label={t('owner.salonPassword.label')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            maxLength={128}
          />
          <Text style={styles.hint}>{t('account.password.hint')}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={t('owner.salonPassword.submit')}
            onPress={submit}
            loading={loading}
            disabled={password.length < 8}
          />
          <Button label={t('common.cancel')} onPress={() => setOpen(false)} variant="ghost" />
        </View>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          <Button
            label={t('owner.salonPassword.cta')}
            onPress={() => {
              setDone(false);
              setOpen(true);
            }}
            variant="secondary"
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, marginTop: spacing.md },
  title: { ...typography.h3, color: colors.text },
  hint: { ...typography.caption, color: colors.textDim, marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  success: { ...typography.caption, color: colors.success, marginTop: spacing.xs },
});
