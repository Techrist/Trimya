import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import type { QrScannerProps, QrScannerError } from './QrScanner.types';

/**
 * Implémentation WEB du scanner QR, construite sur `getUserMedia` + `html5-qrcode`.
 *
 * Points importants (cf. section 6 du PDF) :
 *   1. On exige la caméra arrière (facingMode: 'environment').
 *   2. On relance automatiquement le flux au retour au premier plan — iOS Safari
 *      coupe la caméra dès que la PWA passe en arrière-plan et ne la rouvre PAS
 *      spontanément : il faut écouter `visibilitychange` et réappliquer `start`.
 *   3. On exige HTTPS (secure context). En HTTP/dev non-localhost → onError.
 *   4. On ne cache JAMAIS un échec en « succès silencieux » : chaque erreur est
 *      remontée explicitement à l'appelant via onError.
 *   5. Dédup : une fois `onScan` appelé, on arrête le décodage jusqu'à ce que
 *      `paused` repasse à false ou qu'un timeout s'écoule.
 *
 * `html5-qrcode` encapsule proprement les API MediaDevices et gère le décodage
 * canvas → ZXing WASM. On lui laisse la responsabilité du throttling.
 */

type Html5Qrcode = {
  start: (
    camera: { facingMode: string } | string,
    config: { fps: number; qrbox?: number | { width: number; height: number } },
    onSuccess: (text: string) => void,
    onError: (msg: string) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  isScanning: boolean;
};

type Html5QrcodeCtor = new (
  elementId: string,
  config?: { verbose?: boolean },
) => Html5Qrcode;

const CONTAINER_ID = 'trimya-qr-scanner';

export function QrScanner({
  onScan,
  onError,
  paused = false,
  style,
}: QrScannerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const errorFiredRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [state, setState] = useState<'init' | 'ready' | 'error'>('init');

  useEffect(() => {
    let mounted = true;

    const fireError = (kind: QrScannerError) => {
      if (errorFiredRef.current) return;
      errorFiredRef.current = true;
      setState('error');
      onError?.(kind);
    };

    const start = async () => {
      // 1) Secure context obligatoire pour getUserMedia hors localhost
      if (
        typeof window !== 'undefined' &&
        !window.isSecureContext &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        fireError('secure_context_required');
        return;
      }

      // 2) Vérifie l'existence de l'API
      const nav = (globalThis as { navigator?: Navigator }).navigator;
      if (!nav?.mediaDevices?.getUserMedia) {
        fireError('camera_unavailable');
        return;
      }

      // 3) Charge html5-qrcode à la demande (évite ~200 KB au bundle initial)
      let Html5QrcodeImpl: Html5QrcodeCtor;
      try {
        const mod = (await import('html5-qrcode')) as unknown as {
          Html5Qrcode: Html5QrcodeCtor;
        };
        Html5QrcodeImpl = mod.Html5Qrcode;
      } catch {
        fireError('unknown');
        return;
      }

      if (!mounted) return;

      try {
        const scanner = new Html5QrcodeImpl(CONTAINER_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (text) => {
            if (handledRef.current || pausedRef.current) return;
            handledRef.current = true;
            onScan(text);
            // Reset pour permettre d'autres scans consécutifs
            setTimeout(() => {
              handledRef.current = false;
            }, 800);
          },
          () => {
            // callback appelé en continu quand aucun QR n'est trouvé :
            // c'est du bruit normal, on ignore.
          },
        );
        if (mounted) setState('ready');
      } catch (err) {
        // Firefox et Safari renvoient des erreurs différentes selon le cas
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (
          msg.includes('permission') ||
          msg.includes('notallowed') ||
          msg.includes('denied')
        ) {
          fireError('permission_denied');
        } else if (msg.includes('notfound') || msg.includes('devicenotfound')) {
          fireError('camera_unavailable');
        } else {
          fireError('unknown');
        }
      }
    };

    const stop = async () => {
      const s = scannerRef.current;
      if (!s) return;
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        // L'arrêt peut throw si la caméra a déjà été libérée (ex: tab fermé)
      }
      scannerRef.current = null;
    };

    // Risque n°2 du PDF : iOS coupe la caméra en arrière-plan.
    // On réécoute visibilitychange et on relance proprement.
    const onVisibility = async () => {
      if (document.visibilityState === 'visible') {
        if (!scannerRef.current && mounted) {
          handledRef.current = false;
          errorFiredRef.current = false;
          await start();
        }
      } else {
        await stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibility);
      void stop();
    };
    // on ne veut PAS relancer sur chaque re-render : les deps sont volontairement vides
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, style as ViewStyle]}>
      {/* Note : html5-qrcode monte sa <video> à l'intérieur du <div id={CONTAINER_ID}>.
          react-native-web convertit <View nativeID=...> en <div id=...>. */}
      <View
        nativeID={CONTAINER_ID}
        ref={containerRef as unknown as React.Ref<View>}
        style={styles.scanner}
      />
      {state === 'init' && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>Activation de la caméra…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative' as unknown as 'relative',
  },
  scanner: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute' as unknown as 'absolute',
    inset: 0 as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayText: {
    color: '#fff',
    fontSize: 14,
  },
});
