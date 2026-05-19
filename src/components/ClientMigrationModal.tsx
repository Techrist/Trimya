import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Alert } from 'react-native';
import { ArrowRightLeft } from 'lucide-react-native';
import { Button } from './Button';
import { Card } from './Card';
import { storage } from '@/services/storage';
import { subscribeCustomer } from '@/services/customers';
import {
  acceptMigrationRequest,
  clearMigrationRequest,
} from '@/services/migration';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Customer } from '@/types';

/**
 * Global modal that pops up on the client side whenever a salon requests
 * to migrate the customer's loyalty card. Listens to the customer doc and
 * shows a consent prompt with explicit accept / refuse buttons.
 */
export function ClientMigrationModal() {
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) return;
      unsub = subscribeCustomer(id, setCustomer);
    })();
    return () => unsub?.();
  }, []);

  const pending = customer?.pendingMigrationTo;

  if (!pending || !customer) return null;

  // Expired requests should not be actionable.
  const isExpired = pending.expiresAt < Date.now();

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await acceptMigrationRequest(customer.id);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefuse = async () => {
    setSubmitting(true);
    try {
      await clearMigrationRequest(customer.id);
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      onRequestClose={isExpired ? handleRefuse : undefined}
    >
      <View style={styles.backdrop}>
        <Card style={styles.card} elevated>
          <View style={styles.iconWrap}>
            <ArrowRightLeft color={colors.primary} size={36} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>
            {t('client.migration.title')}
          </Text>
          <Text style={styles.salonName}>{pending.salonName}</Text>

          <Text style={styles.body}>
            {t('client.migration.body', { salonName: pending.salonName })}
          </Text>

          <View style={styles.bullets}>
            <BulletRow text={t('client.migration.bullet1')} />
            <BulletRow text={t('client.migration.bullet2')} />
            <BulletRow text={t('client.migration.bullet3')} />
          </View>

          <View style={styles.actions}>
            <Button
              label={t('client.migration.refuse')}
              onPress={handleRefuse}
              variant="secondary"
              loading={submitting}
            />
            <Button
              label={t('client.migration.accept')}
              onPress={handleAccept}
              loading={submitting}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.dot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    alignItems: 'stretch',
  },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  salonName: {
    ...typography.h3,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  bullets: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
  },
});
