import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, CalendarDays, MessageCircle, User } from 'lucide-react-native';

import {
  ClientTabParamList,
  ReservationsStackParamList,
} from './types';
import { colors, typography } from '@/theme';
import { useClientUnreadCount } from '@/hooks/useClientUnreadCount';
import { useT } from '@/i18n';

import { ClientDashboardScreen } from '@/screens/client/ClientDashboardScreen';
import { ClientReservationsScreen } from '@/screens/client/ClientReservationsScreen';
import { ClientReservationFormScreen } from '@/screens/client/ClientReservationFormScreen';
import { ClientChatScreen } from '@/screens/client/ClientChatScreen';
import { ClientProfileScreen } from '@/screens/client/ClientProfileScreen';

const Tab = createBottomTabNavigator<ClientTabParamList>();
const ReservationsStack = createNativeStackNavigator<ReservationsStackParamList>();

function ReservationsStackNavigator() {
  return (
    <ReservationsStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <ReservationsStack.Screen
        name="ReservationsList"
        component={ClientReservationsScreen}
      />
      <ReservationsStack.Screen
        name="ReservationForm"
        component={ClientReservationFormScreen}
      />
    </ReservationsStack.Navigator>
  );
}

export function ClientTabsNavigator() {
  const unread = useClientUnreadCount();
  const { t } = useT();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={ClientDashboardScreen}
        options={{
          title: t('client.tab.home'),
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size ?? 22} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="ReservationsTab"
        component={ReservationsStackNavigator}
        options={{
          title: t('client.tab.reservations'),
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size ?? 22} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={ClientChatScreen}
        options={{
          title: t('client.tab.messages'),
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size ?? 22} strokeWidth={2} />
          ),
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.black,
            fontWeight: '700',
            fontSize: 11,
          },
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ClientProfileScreen}
        options={{
          title: t('client.tab.profile'),
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
