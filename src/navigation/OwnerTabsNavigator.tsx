import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LayoutDashboard, Building2, User } from 'lucide-react-native';

import {
  OwnerTabParamList,
  OwnerSalonsStackParamList,
} from './types';
import { colors, typography } from '@/theme';
import { useT } from '@/i18n';

import { OwnerDashboardScreen } from '@/screens/owner/OwnerDashboardScreen';
import { OwnerSalonsListScreen } from '@/screens/owner/OwnerSalonsListScreen';
import { OwnerSalonDetailScreen } from '@/screens/owner/OwnerSalonDetailScreen';
import { OwnerProfileScreen } from '@/screens/owner/OwnerProfileScreen';

const Tab = createBottomTabNavigator<OwnerTabParamList>();
const SalonsStack = createNativeStackNavigator<OwnerSalonsStackParamList>();

function SalonsStackNavigator() {
  return (
    <SalonsStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <SalonsStack.Screen
        name="OwnerSalonsList"
        component={OwnerSalonsListScreen}
      />
      <SalonsStack.Screen
        name="OwnerSalonDetail"
        component={OwnerSalonDetailScreen}
      />
    </SalonsStack.Navigator>
  );
}

export function OwnerTabsNavigator() {
  const { t } = useT();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="OwnerHomeTab"
        component={OwnerDashboardScreen}
        options={{
          title: t('owner.tab.home'),
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size ?? 22} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="OwnerSalonsTab"
        component={SalonsStackNavigator}
        options={{
          title: t('owner.tab.salons'),
          tabBarIcon: ({ color, size }) => (
            <Building2 color={color} size={size ?? 22} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="OwnerProfileTab"
        component={OwnerProfileScreen}
        options={{
          title: t('owner.tab.profile'),
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size ?? 22} strokeWidth={2} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
});
