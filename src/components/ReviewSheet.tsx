import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import { Star, X } from 'lucide-react-native';
import { Button } from './Button';
import { BarberAvatar } from './BarberAvatar';
import { colors, radius, spacing, typography } from '@/theme';
import { useT } from '@/i18n';
import { CutReview } from '@/types';

interface Props {
  visible: boolean;
  /** Nom du coiffeur qui a fait la coupe. */
  barberName: string;
  /** Photo optionnelle du coiffeur. */
  barberPhoto?: string;
  /** Avis existant si édition (sinon création). */
  existing?: CutReview | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (rating: 1 | 2 | 3 | 4 | 5, comment: string) => void;
}

const MAX_COMMENT = 280;

/**
 * Bottom-sheet de notation client.
 *
 * - 5 étoiles tappables (réactives immédiatement, animation simple)
 * - Champ commentaire optionnel (280 caractères max)
 * - Affiche la note existante en mode édition (24h)
 */
export function ReviewSheet({
  visible,
  barberName,
  barberPhoto,
  existing,
  loading = false,
  onCancel,
  onSubmit,
}: Props) {
  const { t } = useT();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(
    (existing?.rating as 1 | 2 | 3 | 4 | 5) ?? 5,
  );
  const [comment, setComment] = useState(existing?.comment ?? '');

  // Reset le state à chaque ouverture (au cas où on change de coupe).
  useEffect(() => {
    if (visible) {
      setRating((existing?.rating as 1 | 2 | 3 | 4 | 5) ?? 5);
      setComment(existing?.comment ?? '');
    }
  }, [visible, existing]);

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

          <View style={styles.barberRow}>
            <BarberAvatar
              barber={{ name: barberName, photo: barberPhoto }}
              size={64}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {existing
                  ? t('review.sheet.editLabel')
                  : t('review.sheet.label')}
              </Text>
              <Text style={styles.barberName}>{barberName}</Text>
            </View>
          </View>

          <Text style={styles.title}>{t('review.sheet.title')}</Text>

          {/* Étoiles */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = n <= rating;
              return (
                <Pressable
                  key={n}
                  onPress={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
                  hitSlop={6}
                  style={styles.starBtn}
                >
                  <Star
                    color={active ? colors.accent : colors.border}
                    fill={active ? colors.accent : 'transparent'}
                    size={42}
                    strokeWidth={2}
                  />
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.ratingLabel}>
            {t(`review.rating.${rating}` as any)}
          </Text>

          {/* Commentaire */}
          <Text style={styles.commentLabel}>
            {t('review.sheet.commentLabel')}
          </Text>
          <TextInput
            value={comment}
            onChangeText={(v) => setComment(v.slice(0, MAX_COMMENT))}
            placeholder={t('review.sheet.commentPlaceholder')}
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={MAX_COMMENT}
            style={styles.commentInput}
          />
          <Text style={styles.charCount}>
            {comment.length} / {MAX_COMMENT}
          </Text>

          <View style={{ height: spacing.lg }} />

          <Button
            label={
              existing
                ? t('review.sheet.updateCta')
                : t('review.sheet.submitCta')
            }
            onPress={() => onSubmit(rating, comment.trim())}
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
  barberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  barberName: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  starBtn: {
    padding: 4,
  },
  ratingLabel: {
    ...typography.bodyBold,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  commentLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  commentInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
});
