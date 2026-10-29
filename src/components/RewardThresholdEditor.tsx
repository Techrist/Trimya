import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { Gift, Minus, Plus } from 'lucide-react-native';
import { Card } from './Card';
import { Button } from './Button';
import { setSalonRewardThreshold } from '@/services/salons';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

interface Props {
  salonId: string;
  /** Seuil actuel du salon (rewardThreshold), 4 par défaut. */
  currentThreshold?: number;
  /**
   * Seuil effectif appliqué (peut différer si fidélité partagée par l'owner).
   * Si fourni et différent du salon, on affiche un hint expliquant pourquoi.
   */
  effectiveThreshold?: number;
  /** True si l'owner du salon impose son propre seuil (mode partagé). */
  overriddenByOwner?: boolean;
}

const MIN = 1;
const MAX = 20;

/**
 * Section "Seuil de récompense" du profil salon.
 * Le salon choisit combien de coupes payantes ses clients doivent acheter
 * avant la coupe offerte (4 par défaut = 4 payées → 5ᵉ offerte).
 *
 * Si l'owner du salon a activé la fidélité partagée, son chainRewardThreshold
 * surcharge cette valeur — on l'indique clairement avec un hint en lecture seule.
 */
export function RewardThresholdEditor({
  salonId,
  currentThreshold = 4,
  effectiveThreshold,
  overriddenByOwner = false,
}: Props) {
  const { t } = useT();
  const [draft, setDraft] = useState<number>(currentThreshold);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(currentThreshold);
  }, [currentThreshold]);

  const clamped = Math.max(MIN, Math.min(MAX, Math.round(draft || MIN)));
  const dirty = clamped !== currentThreshold;

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSalonRewardThreshold(salonId, clamped);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Gift color={colors.primary} size={20} strokeWidth={2.2} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('reward.threshold.title')}</Text>
          <Text style={styles.hint}>
            {t('reward.threshold.hint', { count: clamped })}
          </Text>
        </View>
      </View>

      {overriddenByOwner ? (
        <View style={styles.overrideBanner}>
          <Text style={styles.overrideText}>
            {t('reward.threshold.overriddenByOwner', {
              count: effectiveThreshold ?? clamped,
            })}
          </Text>
        </View>
      ) : null}

      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => setDraft((v) => Math.max(MIN, v - 1))}
          disabled={overriddenByOwner || saving || clamped <= MIN}
          style={[
            styles.stepBtn,
            (overriddenByOwner || clamped <= MIN) && styles.stepBtnDisabled,
          ]}
          hitSlop={6}
        >
          <Minus color={colors.text} size={20} strokeWidth={2.4} />
        </Pressable>

        <View style={styles.valueWrap}>
          <TextInput
            value={String(clamped)}
            onChangeText={(v) => {
              const n = parseInt(v.replace(/\D/g, ''), 10);
              if (!isNaN(n)) setDraft(n);
              else if (v === '') setDraft(MIN);
            }}
            keyboardType="numeric"
            editable={!overriddenByOwner}
            maxLength={2}
            style={styles.valueInput}
          />
          <Text style={styles.valueSuffix}>
            {t('reward.threshold.unit')}
          </Text>
        </View>

        <Pressable
          onPress={() => setDraft((v) => Math.min(MAX, v + 1))}
          disabled={overriddenByOwner || saving || clamped >= MAX}
          style={[
            styles.stepBtn,
            (overriddenByOwner || clamped >= MAX) && styles.stepBtnDisabled,
          ]}
          hitSlop={6}
        >
          <Plus color={colors.text} size={20} strokeWidth={2.4} />
        </Pressable>
      </View>

      <Text style={styles.example}>
        {t('reward.threshold.example', { count: clamped, reward: clamped + 1 })}
      </Text>

      {dirty && !overriddenByOwner ? (
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
  overrideBanner: {
    backgroundColor: 'rgba(255, 235, 59, 0.08)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  overrideText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    minWidth: 100,
    justifyContent: 'center',
  },
  valueInput: {
    ...typography.h1,
    color: colors.primary,
    fontSize: 36,
    textAlign: 'center',
    minWidth: 56,
    padding: 0,
  },
  valueSuffix: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  example: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  saveWrap: {
    marginTop: spacing.xs,
  },
});
