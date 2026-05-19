import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Card } from './Card';
import { Button } from './Button';
import { setSalonSubscriptionPrice } from '@/services/subscriptions';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

interface Props {
  salonId: string;
  /** Prix mensuel d'abonnement actuel du salon (FCFA, par défaut 0). */
  currentPrice?: number;
  /** Devise affichée à côté du montant. */
  currency?: string;
}

/**
 * Section "Prix abonnement client illimité".
 *
 * Le salon configure ici le tarif mensuel d'un abonnement coupes illimitées.
 * Ce prix sera pré-rempli dans la modale d'activation côté détail client,
 * sans empêcher le salon de l'ajuster ponctuellement si besoin.
 */
export function SubscriptionPriceEditor({
  salonId,
  currentPrice = 0,
  currency = 'FCFA',
}: Props) {
  const { t } = useT();
  const [draft, setDraft] = useState(String(currentPrice || ''));
  const [saving, setSaving] = useState(false);

  // Si la prop change (snapshot live du salon), on resync le draft.
  useEffect(() => {
    setDraft(currentPrice > 0 ? String(currentPrice) : '');
  }, [currentPrice]);

  const handleSave = async () => {
    const parsed = parseInt(draft.replace(/\s/g, ''), 10);
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert(t('common.error'), t('subscription.priceInvalid'));
      return;
    }
    setSaving(true);
    try {
      await setSalonSubscriptionPrice(salonId, parsed);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const dirty = String(currentPrice || '') !== draft.trim();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Sparkles color={colors.primary} size={20} strokeWidth={2.2} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('subscription.priceTitle')}</Text>
          <Text style={styles.hint}>{t('subscription.priceHint')}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textDim}
          style={styles.input}
        />
        <Text style={styles.currency}>{currency}</Text>
      </View>

      {dirty ? (
        <View style={styles.saveWrap}>
          <Button
            label={t('common.save')}
            onPress={handleSave}
            loading={saving}
            variant="secondary"
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.h2,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  currency: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  saveWrap: {
    marginTop: spacing.xs,
  },
});
