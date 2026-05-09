import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { signOut } from '@/services/auth';
import { storage } from '@/services/storage';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { ScannerStackParamList } from '@/navigation/types';
import { CommonActions } from '@react-navigation/native';

type Nav = NativeStackNavigationProp<ScannerStackParamList, 'Scanner'>;

export function SalonScannerScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const lastScanRef = useRef<{ id: string; at: number } | null>(null);
  const { clearMode } = useApp();

  useFocusEffect(
    React.useCallback(() => {
      setScanned(false);
      return () => {};
    }, []),
  );

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scanned) return;
    try {
      const data = JSON.parse(result.data);
      if (data?.t !== 'trimya' || !data?.id) {
        throw new Error('QR non reconnu');
      }
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.id === data.id &&
        now - lastScanRef.current.at < 2000
      ) {
        return;
      }
      lastScanRef.current = { id: data.id, at: now };
      setScanned(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      nav.navigate('AddCut', { customerId: data.id });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('salon.scanner.invalidQr'), t('salon.scanner.invalidQrHint'), [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
      setScanned(true);
    }
  };

  const handleExitSalonMode = () => {
    Alert.alert(
      t('salon.scanner.exitTitle'),
      t('salon.scanner.exitText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('salon.scanner.exit'),
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
      ],
    );
  };

  if (!permission) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('salon.scanner.cameraPrep')}</Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen padded centered>
        <Logo size={64} />
        <Text style={styles.title}>{t('salon.scanner.cameraNeeded.title')}</Text>
        <Text style={styles.subtitle}>{t('salon.scanner.cameraNeeded.text')}</Text>
        <Button label={t('salon.scanner.cameraNeeded.cta')} onPress={requestPermission} />
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Logo size={32} />
          <Pressable onPress={handleExitSalonMode} hitSlop={12}>
            <Text style={styles.exitLink}>{t('salon.scanner.exit')}</Text>
          </Pressable>
        </View>

        <View style={styles.middle} pointerEvents="none">
          <Text style={styles.headline}>{t('salon.scanner.headline')}</Text>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.hint}>{t('salon.scanner.hint')}</Text>
        </View>

        <View style={styles.bottom} />
      </View>
    </View>
  );
}

const FRAME = 260;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  exitLink: {
    ...typography.bodyBold,
    color: colors.white,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  middle: {
    alignItems: 'center',
  },
  headline: {
    ...typography.h2,
    color: colors.white,
    marginBottom: spacing.lg,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
  },
  frame: {
    width: FRAME,
    height: FRAME,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: colors.primary,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  hint: {
    ...typography.body,
    color: colors.white,
    marginTop: spacing.lg,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  bottom: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  bottomText: {
    ...typography.caption,
    color: colors.white,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
