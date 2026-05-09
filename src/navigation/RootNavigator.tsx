import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '@/contexts/AppContext';
import { RootStackParamList } from './types';
import { colors } from '@/theme';

import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { RoleSelectionScreen } from '@/screens/RoleSelectionScreen';
import { PhoneSignupScreen } from '@/screens/client/PhoneSignupScreen';
import { OtpVerifyScreen } from '@/screens/client/OtpVerifyScreen';
import { ClientNameScreen } from '@/screens/client/ClientNameScreen';
import { ClientQrScreen } from '@/screens/client/ClientQrScreen';
import { ClientHistoryScreen } from '@/screens/client/ClientHistoryScreen';
import { ClientChatScreen } from '@/screens/client/ClientChatScreen';
import { ClientTabsNavigator } from './ClientTabsNavigator';
import { SalonActivationScreen } from '@/screens/salon/SalonActivationScreen';
import { SalonTabsNavigator } from './SalonTabsNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { ready, mode, onboarded, user, salonId } = useApp();

  if (!ready) {
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

  const initialRoute: keyof RootStackParamList = !onboarded
    ? 'Onboarding'
    : !mode
      ? 'RoleSelection'
      : mode === 'salon'
        ? salonId
          ? 'SalonTabs'
          : 'SalonActivation'
        : user
          ? 'ClientTabs'
          : 'PhoneSignup';

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />

      <Stack.Screen name="PhoneSignup" component={PhoneSignupScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="ClientName" component={ClientNameScreen} />
      <Stack.Screen name="ClientTabs" component={ClientTabsNavigator} />
      <Stack.Screen name="ClientQr" component={ClientQrScreen} />
      <Stack.Screen name="ClientHistory" component={ClientHistoryScreen} />
      <Stack.Screen name="ClientChat" component={ClientChatScreen} />

      <Stack.Screen name="SalonActivation" component={SalonActivationScreen} />
      <Stack.Screen name="SalonTabs" component={SalonTabsNavigator} />
    </Stack.Navigator>
  );
}
