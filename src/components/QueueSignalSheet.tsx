import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Footprints, X } from 'lucide-react-native';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useT } from '@/i18n';
import { QUEUE_ETAS, QueueEta } from '@/types';
import { formatEta } from '@/services/queue';

interface QueueSignalSheetProps {
  visible: boolean;
  loading?: boolean;
  /** ETA pré-sélectionné (utile si on ré-ouvre la modale pour modifier). */
  initialEta?: QueueEta;
  onCancel: () => void;
  onConfirm: (eta: QueueEta) => void;
}

/**
 * Bottom-sheet permettant au client de signaler "Je suis en route"
 * en choisissant un ETA dans une liste fermée (5/10/15/30/60 min).
 *
 * Pas de saisie libre : on évite "j'arrive dans 2h" qui n'a pas de sens
 * pour un signal d'arrivée imminente.
 */
export function QueueSignalSheet({
  visible,
  loading = false,
  initialEta,
  onCancel,
  onConfirm,
}: QueueSignalSheetProps) {
  const { t } = useT();
  const [eta, setEta] = useState<QueueEta>(initialEta ?? 10);

  // Resync à l'ouverture si initialEta change (modification d'un signal existant).
  React.useEffect(() => {
    if (visible && initialEta) setEta(initialEta);
  }, [visible, initialEta]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Pressable style={styles.closeBtn} onPress={onCancel} hitSlop={12}>
            <X color={colors.textMuted} size={22} strokeWidth={2.2} />
          </Pressable>

          <View style={styles.iconWrap}>
            <Footprints color={colors.primary} size={36} strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>{t('queue.sheet.title')}</Text>
          <Text style={styles.subtitle}>{t('queue.sheet.subtitle')}</Text>

          <Text style={styles.sectionLabel}>{t('queue.sheet.etaLabel')}</Text>
          <View style={styles.etaRow}>
            {QUEUE_ETAS.map((value) => {
              const active = eta === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setEta(value)}
                  style={[
                    styles.etaChip,
                    active && styles.etaChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.etaLabel,
                      active && styles.etaLabelActive,
                    ]}
                  >
                    {formatEta(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: spacing.lg }} />

          <Button
            label={
              initialEta
                ? t('queue.sheet.confirmUpdate')
                : t('queue.sheet.confirm')
            }
            onPress={() => onConfirm(eta)}
            loading={loading}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            label={t('common.cancel')}
            variant="ghost"
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  etaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  etaChip: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
  },
  etaLabel: {
    ...typography.bodyBold,
    color: colors.text,
    fontSize: 13,
  },
  etaLabelActive: {
    color: colors.primary,
  },
});
