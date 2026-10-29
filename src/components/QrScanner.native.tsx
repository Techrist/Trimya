import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import type { QrScannerProps } from './QrScanner.types';

/**
 * Implémentation NATIVE du scanner QR, construite sur expo-camera.
 *
 * Metro choisit automatiquement ce fichier (`.native.tsx`) sur iOS et
 * Android. Sur web il prend `QrScanner.web.tsx` à la place.
 *
 * Garde volontairement la même sémantique que l'ancien SalonScannerScreen :
 *  - demande la permission caméra au mount
 *  - une seule détection relayée à `onScan` (dédup par ref parent)
 *  - permission refusée → remonté via onError('permission_denied')
 */
export function QrScanner({
  onScan,
  onError,
  paused = false,
  style,
}: QrScannerProps): React.JSX.Element | null {
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);
  const errorFiredRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && !permission.canAskAgain && !errorFiredRef.current) {
      errorFiredRef.current = true;
      onError?.('permission_denied');
    }
  }, [permission, onError]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (handled || paused) return;
    setHandled(true);
    onScan(result.data);
    // Reset un peu plus tard pour permettre un nouveau scan si l'écran
    // reste monté (ex: scans consécutifs). Les callers qui veulent un
    // one-shot désactivent via `paused`.
    setTimeout(() => setHandled(false), 800);
  };

  if (!permission?.granted) {
    return null;
  }

  return (
    <View style={[styles.container, style as ViewStyle]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={paused ? undefined : handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});
