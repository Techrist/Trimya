import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '@/contexts/AppContext';
import { isClientApp, isProApp } from '@/lib/appTarget';
import { hasPin } from '@/services/clientPin';
import { RootStackParamList } from './types';
import { colors } from '@/theme';

import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { RoleSelectionScreen } from '@/screens/RoleSelectionScreen';
import { ProRoleSelectionScreen } from '@/screens/ProRoleSelectionScreen';

// ── Écrans Client (chargés seulement dans Trimya) ──────────────
import { PhoneSignupScreen } from '@/screens/client/PhoneSignupScreen';
import { OtpVerifyScreen } from '@/screens/client/OtpVerifyScreen';
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
  const { ready, mode, onboarded, user, salonId, ownerId } = useApp();
  const isClient = isClientApp();
  const isPro = isProApp();

  // ─── Vérification PIN (Trimya Client uniquement) ───────────
  // Si un PIN a été configuré localement par le client, on intercepte
  // le boot pour afficher l'écran de déverrouillage AVANT ClientTabs.
  // pinChecked: false → on attend le résultat (loader). true → on a la
  // réponse et pinRequired indique s'il faut afficher PinUnlock.
  const [pinChecked, setPinChecked] = useState(!isClient);
  const [pinRequired, setPinRequired] = useState(false);
  useEffect(() => {
    if (!isClient || !ready || !user) {
      // Pas en Trimya Client OU pas encore prêt OU pas connecté →
      // pas de PIN à vérifier (le PIN ne sert que pour les sessions
      // déjà authentifiées).
      setPinRequired(false);
      setPinChecked(true);
      return;
    }
    hasPin().then((exists) => {
      setPinRequired(exists);
      setPinChecked(true);
    });
  }, [isClient, ready, user]);

  if (!ready || !pinChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
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
    return ctx.user ? 'ClientTabs' : 'PhoneSignup';
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
