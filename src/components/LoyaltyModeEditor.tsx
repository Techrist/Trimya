import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { Users, Lock, Check } from 'lucide-react-native';
import { Card } from './Card';
import { Button } from './Button';
import { setOwnerLoyalty } from '@/services/owners';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

interface Props {
  ownerId: string;
  /** Mode actuel (défaut: 'blocked'). */
  currentMode?: 'shared' | 'blocked';
  /** Seuil chaîne actuel (défaut: 4). */
  currentChainThreshold?: number;
  /** Nombre de salons couverts (pour le hint d'impact). */
  salonsCount?: number;
}

type Mode = 'shared' | 'blocked';
const MIN = 1;
const MAX = 20;

/**
 * Section "Fidélité chaîne" du profil propriétaire.
 *
 * Permet de choisir entre :
 *  - 'shared' : un client peut accumuler ses coupes sur n'importe quel salon
 *    de la chaîne. Une seule carte fidélité pour toute la marque.
 *  - 'blocked' : chaque salon est indépendant, le client doit migrer pour
 *    changer de salon (comportement historique).
 *
 * Si shared : on demande aussi le seuil de récompense unique pour la chaîne
 * (surchargeant celui de chaque salon).
 */
export function LoyaltyModeEditor({
  ownerId,
  currentMode = 'blocked',
  currentChainThreshold = 4,
  salonsCount = 0,
}: Props) {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>(currentMode);
  const [threshold, setThreshold] = useState<number>(currentChainThreshold);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(currentMode);
    setThreshold(currentChainThreshold);
  }, [currentMode, currentChainThreshold]);

  const clampedThreshold = Math.max(MIN, Math.min(MAX, Math.round(threshold || MIN)));
  const dirty =
    mode !== currentMode ||
    (mode === 'shared' && clampedThreshold !== currentChainThreshold);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setOwnerLoyalty(ownerId, {
        mode,
        chainRewardThreshold: clampedThreshold,
      });
      Alert.alert(t('common.done'), t('loyalty.owner.savedText', { count: salonsCount }));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Users color={colors.primary} size={20} strokeWidth={2.2} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('loyalty.owner.title')}</Text>
          <Text style={styles.hint}>{t('loyalty.owner.hint')}</Text>
        </View>
      </View>

      <View style={styles.modes}>
        <ModeCard
          icon={<Users color={mode === 'shared' ? colors.primary : colors.textMuted} size={20} strokeWidth={2.2} />}
          title={t('loyalty.owner.mode.shared.title')}
          body={t('loyalty.owner.mode.shared.body')}
          active={mode === 'shared'}
          onPress={() => setMode('shared')}
        />
        <ModeCard
          icon={<Lock color={mode === 'blocked' ? colors.primary : colors.textMuted} size={20} strokeWidth={2.2} />}
          title={t('loyalty.owner.mode.blocked.title')}
          body={t('loyalty.owner.mode.blocked.body')}
          active={mode === 'blocked'}
          onPress={() => setMode('blocked')}
        />
      </View>

      {mode === 'shared' ? (
        <View style={styles.thresholdBlock}>
          <Text style={styles.thresholdLabel}>
            {t('loyalty.owner.chainThresholdLabel')}
          </Text>
          <View style={styles.thresholdRow}>
            <TextInput
              value={String(clampedThreshold)}
              onChangeText={(v) => {
                const n = parseInt(v.replace(/\D/g, ''), 10);
                if (!isNaN(n)) setThreshold(n);
                else if (v === '') setThreshold(MIN);
              }}
              keyboardType="numeric"
              maxLength={2}
              style={styles.thresholdInput}
            />
            <Text style={styles.thresholdSuffix}>
              {t('reward.threshold.unit')}
            </Text>
          </View>
          <Text style={styles.thresholdHint}>
            {t('loyalty.owner.chainThresholdHint', {
              count: clampedThreshold,
              reward: clampedThreshold + 1,
            })}
          </Text>
        </View>
      ) : null}

      {salonsCount > 0 ? (
        <Text style={styles.impactText}>
          {t('loyalty.owner.impactHint', { count: salonsCount })}
        </Text>
      ) : null}

      {dirty ? (
        <Button
          label={t('common.save')}
          onPress={handleSave}
          loading={saving}
        />
      ) : null}
    </Card>
  );
}

function ModeCard({
  icon,
  title,
  body,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeCard, active && styles.modeCardActive]}
    >
      <View style={styles.modeCardHeader}>
        {icon}
        <Text style={[styles.modeCardTitle, active && styles.modeCardTitleActive]}>
          {title}
        </Text>
        {active ? (
          <Check color={colors.primary} size={16} strokeWidth={2.4} />
        ) : null}
      </View>
      <Text style={styles.modeCardBody}>{body}</Text>
    </Pressable>
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
  modes: {
    gap: spacing.sm,
  },
  modeCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.06)',
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  modeCardTitle: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  modeCardTitleActive: {
    color: colors.primary,
  },
  modeCardBody: {
    ...typography.caption,
    color: colors.textMuted,
  },
  thresholdBlock: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 235, 59, 0.06)',
    borderWidth: 1,
    borderColor: colors.accent,
    gap: spacing.sm,
  },
  thresholdLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  thresholdInput: {
    ...typography.h2,
    color: colors.accent,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 70,
    textAlign: 'center',
  },
  thresholdSuffix: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  thresholdHint: {
    ...typography.caption,
    color: colors.textDim,
    fontStyle: 'italic',
  },
  impactText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
