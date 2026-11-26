import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '@/contexts/AppContext';
import { isClientApp, isProApp } from '@/lib/appTarget';
import { hasPin } from '@/services/clientPin';
import { findOwnerForAuthUser } from '@/services/owners';
import { storage } from '@/services/storage';
import { RootStackParamList } from './types';
import { colors, spacing, typography } from '@/theme';
import { MagicLinkNeedEmailScreen } from '@/screens/MagicLinkNeedEmailScreen';

import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { RoleSelectionScreen } from '@/screens/RoleSelectionScreen';
import { ProRoleSelectionScreen } from '@/screens/ProRoleSelectionScreen';

// ── Écrans Client (chargés seulement dans Trimya) ──────────────
import { PhoneSignupScreen } from '@/screens/client/PhoneSignupScreen';
import { OtpVerifyScreen } from '@/screens/client/OtpVerifyScreen';
import { EmailSignupScreen } from '@/screens/client/EmailSignupScreen';
import { EmailLinkSentScreen } from '@/screens/client/EmailLinkSentScreen';
import { OtpCodeVerifyScreen } from '@/screens/client/OtpCodeVerifyScreen';
import { ClientNameScreen } from '@/screens/client/ClientNameScreen';
import { ClientQrScreen } from '@/screens/client/ClientQrScreen';
import { ClientHistoryScreen } from '@/screens/client/ClientHistoryScreen';
import { ClientBarbersScreen } from '@/screens/client/ClientBarbersScreen';
import { ClientBarberDetailScreen } from '@/screens/client/ClientBarberDetailScreen';
import { ClientHomeRequestScreen } from '@/screens/client/ClientHomeRequestScreen';
import { ClientHomeRequestDetailScreen } from '@/screens/client/ClientHomeRequestDetailScreen';
import { ClientHomeRequestsListScreen } from '@/screens/client/ClientHomeRequestsListScreen';
import { ClientChatScreen } from '@/screens/client/ClientChatScreen';
import { ClientChangePhoneScreen } from '@/screens/client/ClientChangePhoneScreen';
import { ClientChangePhoneVerifyScreen } from '@/screens/client/ClientChangePhoneVerifyScreen';
import { ClientPinSetupScreen } from '@/screens/client/ClientPinSetupScreen';
import { ClientPinUnlockScreen } from '@/screens/client/ClientPinUnlockScreen';
import { ClientTabsNavigator } from './ClientTabsNavigator';

// ── Écrans Pro (chargés seulement dans Trimya Pro) ─────────────
import { SalonActivationScreen } from '@/screens/salon/SalonActivationScreen';
import { SalonSignupScreen } from '@/screens/salon/SalonSignupScreen';
import { SalonTabsNavigator } from './SalonTabsNavigator';
import { OwnerSignInScreen } from '@/screens/owner/OwnerSignInScreen';
import { OwnerTabsNavigator } from './OwnerTabsNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigator — arbore deux variantes selon la cible de build.
 *
 *   TRIMYA_APP=client → onboarding → phone signup → client tabs
 *                       (pas de role selection : le rôle est implicite)
 *
 *   TRIMYA_APP=pro    → onboarding → ProRoleSelection
 *                       → SalonActivation ou OwnerSignIn → tabs correspondantes
 *
 * Les écrans non utilisés par la cible courante ne sont pas montés dans
 * le navigator. Note : le JS bundle contient toujours les deux ensembles
 * (c'est le compromis de l'approche build-targeting léger vs monorepo).
 */
export function RootNavigator() {
  const {
    ready,
    mode,
    onboarded,
    user,
    salonId,
    ownerId,
    setOwnerId,
    setMode,
    magicLinkStatus,
    magicLinkError,
    magicLinkTarget,
  } = useApp();
  const isClient = isClientApp();
  const isPro = isProApp();

  // ─── Vérification PIN (Trimya Client uniquement) ───────────
  const [pinChecked, setPinChecked] = useState(!isClient);
  const [pinRequired, setPinRequired] = useState(false);
  useEffect(() => {
    if (!isClient || !ready || !user) {
      setPinRequired(false);
      setPinChecked(true);
      return;
    }
    hasPin().then((exists) => {
      setPinRequired(exists);
      setPinChecked(true);
    });
  }, [isClient, ready, user]);

  // ─── Post-signin magic link : résout l'owner / customer ───
  // Au magic link signin, Firebase pose `user` mais notre contexte ignore
  // encore `ownerId` ou `customerId`. On fait ici le routing dérivé :
  //  - Pro + magicLinkTarget=owner → lookup owner par uid → setOwnerId + mode
  //  - Client → setCustomerId sur le uid du user (créé au premier cut)
  const [magicLinkResolving, setMagicLinkResolving] = useState(false);
  useEffect(() => {
    if (!ready || !user) return;
    if (magicLinkStatus !== 'idle') return;
    if (!magicLinkTarget) return;

    (async () => {
      setMagicLinkResolving(true);
      try {
        if (magicLinkTarget === 'owner' && isPro) {
          const owner = await findOwnerForAuthUser(user);
          if (owner) {
            await setMode('owner');
            await setOwnerId(owner.id);
          }
        } else if (magicLinkTarget === 'client' && isClient) {
          // Le customerId local = uid Firebase. Le doc customer sera créé
          // au premier cut si inexistant (flux historique).
          await storage.setCustomerId(user.uid);
        }
      } finally {
        setMagicLinkResolving(false);
      }
    })();
  }, [
    ready,
    user,
    magicLinkStatus,
    magicLinkTarget,
    isPro,
    isClient,
    setOwnerId,
    setMode,
  ]);

  // ─── États de chargement / cas spéciaux magic link ─────────
  if (magicLinkStatus === 'needEmail') {
    return <MagicLinkNeedEmailScreen />;
  }

  if (magicLinkStatus === 'processing' || magicLinkResolving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.centerText}>Connexion en cours…</Text>
      </View>
    );
  }

  if (magicLinkStatus === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Lien invalide</Text>
        <Text style={styles.centerText}>
          {magicLinkError || 'Ce lien a expiré ou a déjà été utilisé.'}
        </Text>
      </View>
    );
  }

  if (!ready || !pinChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ─── Détermination de l'initialRoute ───────────────────────
  const initialRoute: keyof RootStackParamList = pinRequired
    ? 'ClientPinUnlock'
    : computeInitialRoute({
        isClient,
        isPro,
        onboarded,
        mode,
        user,
        salonId,
        ownerId,
      });

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
      initialRouteName={initialRoute}
    >
      {/* Écrans partagés (les 2 apps) */}
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />

      {/* ─── Trimya Client ──────────────────────────────────────── */}
      {isClient && (
        <>
          <Stack.Screen name="EmailSignup" component={EmailSignupScreen} />
          <Stack.Screen name="OtpCodeVerify" component={OtpCodeVerifyScreen} />
          <Stack.Screen name="EmailLinkSent" component={EmailLinkSentScreen} />
          {/* PhoneSignup/OtpVerify conservés pour compat (anciens deep-links,
              bundles natifs). Nouveau flux par défaut : EmailSignup. */}
          <Stack.Screen name="PhoneSignup" component={PhoneSignupScreen} />
          <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
          <Stack.Screen name="ClientName" component={ClientNameScreen} />
          <Stack.Screen name="ClientTabs" component={ClientTabsNavigator} />
          <Stack.Screen name="ClientQr" component={ClientQrScreen} />
          <Stack.Screen name="ClientHistory" component={ClientHistoryScreen} />
          <Stack.Screen name="ClientBarbers" component={ClientBarbersScreen} />
          <Stack.Screen
            name="ClientBarberDetail"
            component={ClientBarberDetailScreen}
          />
          <Stack.Screen
            name="ClientHomeRequest"
            component={ClientHomeRequestScreen}
          />
          <Stack.Screen
            name="ClientHomeRequestDetail"
            component={ClientHomeRequestDetailScreen}
          />
          <Stack.Screen
            name="ClientHomeRequestsList"
            component={ClientHomeRequestsListScreen}
          />
          <Stack.Screen name="ClientChat" component={ClientChatScreen} />
          <Stack.Screen
            name="ClientChangePhone"
            component={ClientChangePhoneScreen}
          />
          <Stack.Screen
            name="ClientChangePhoneVerify"
            component={ClientChangePhoneVerifyScreen}
          />
          <Stack.Screen
            name="ClientPinSetup"
            component={ClientPinSetupScreen}
          />
          <Stack.Screen
            name="ClientPinUnlock"
            component={ClientPinUnlockScreen}
          />
        </>
      )}

      {/* ─── Trimya Pro ─────────────────────────────────────────── */}
      {isPro && (
        <>
          <Stack.Screen
            name="ProRoleSelection"
            component={ProRoleSelectionScreen}
          />
          <Stack.Screen
            name="SalonActivation"
            component={SalonActivationScreen}
          />
          <Stack.Screen name="SalonSignup" component={SalonSignupScreen} />
          <Stack.Screen name="SalonTabs" component={SalonTabsNavigator} />
          <Stack.Screen name="OwnerSignIn" component={OwnerSignInScreen} />
          <Stack.Screen name="OwnerTabs" component={OwnerTabsNavigator} />
        </>
      )}

      {/* RoleSelection historique : conservé pour compat ascendante uniquement
          en mode client (si un ancien lien deep-link y pointe). En Pro il
          n'existe pas — toute navigation vers RoleSelection est ignorée. */}
      {isClient && (
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      )}
    </Stack.Navigator>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

interface InitialRouteContext {
  isClient: boolean;
  isPro: boolean;
  onboarded: boolean;
  mode: 'client' | 'salon' | 'owner' | null;
  user: { uid: string } | null;
  salonId: string | null;
  ownerId: string | null;
}

function computeInitialRoute(ctx: InitialRouteContext): keyof RootStackParamList {
  // Étape 0 : onboarding jamais fait → on commence par là quoi qu'il arrive.
  if (!ctx.onboarded) return 'Onboarding';

  // ── Trimya Client ────────────────────────────────────────────
  if (ctx.isClient) {
    // L'app client n'a qu'un seul rôle implicite. Pas de RoleSelection.
    // Flux par défaut : EmailSignup (magic link). Plus de SMS — bloqués par
    // MTN Cameroun et plan Blaze non activé. Voir src/services/emailAuth.ts.
    return ctx.user ? 'ClientTabs' : 'EmailSignup';
  }

  // ── Trimya Pro ───────────────────────────────────────────────
  if (ctx.isPro) {
    if (!ctx.mode || (ctx.mode !== 'salon' && ctx.mode !== 'owner')) {
      // Pas encore choisi entre salon / propriétaire → ProRoleSelection.
      // (Si le storage contenait `client`, c'est un résidu de migration
      // depuis l'ancien build unifié — on le force à reposer le choix.)
      return 'ProRoleSelection';
    }
    if (ctx.mode === 'salon') {
      return ctx.salonId ? 'SalonTabs' : 'SalonActivation';
    }
    // mode === 'owner'
    return ctx.user && ctx.ownerId ? 'OwnerTabs' : 'OwnerSignIn';
  }

  // ── Fallback (ne devrait pas arriver) ────────────────────────
  return 'Onboarding';
}

const styles = {
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.lg,
  },
  centerText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center' as const,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
};
