import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { storage } from '@/services/storage';
import { subscribeCustomer } from '@/services/customers';
import { useT } from '@/i18n';
import { colors, spacing, typography, REWARD_THRESHOLD } from '@/theme';
import { Customer } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientQr'>;

export function ClientQrScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) return;
      unsub = subscribeCustomer(id, setCustomer);
    })();
    return () => unsub?.();
  }, []);

  if (!customer) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const qrPayload = JSON.stringify({ t: 'trimya', v: 1, id: customer.id });
  const isReward = customer.currentCount >= REWARD_THRESHOLD;

  return (
    <Screen padded centered>
      <Text style={styles.title}>{t('client.qr.title')}</Text>
      <Text style={styles.subtitle}>{t('client.qr.subtitle')}</Text>

      <Card style={styles.qrCard} elevated>
        <View style={styles.qrInner}>
          <QRCode
            value={qrPayload}
            size={240}
            color={colors.black}
            backgroundColor={colors.white}
          />
        </View>
        <Text style={styles.name}>{customer.name || t('client.qr.fallbackName')}</Text>
        <Text style={styles.count}>
          {Math.min(customer.currentCount, REWARD_THRESHOLD)}/{REWARD_THRESHOLD}
        </Text>
      </Card>

      {isReward && (
        <View style={styles.rewardBanner}>
          <Text style={styles.rewardText}>{t('client.qr.rewardBanner')}</Text>
        </View>
      )}

      <Button
        label={t('client.qr.backDashboard')}
        onPress={() => nav.goBack()}
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  qrCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    width: '100%',
    marginBottom: spacing.lg,
  },
  qrInner: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 16,
  },
  name: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
  },
  count: {
    ...typography.h2,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  rewardBanner: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    marginBottom: spacing.lg,
  },
  rewardText: {
    ...typography.bodyBold,
    color: colors.black,
  },
});
