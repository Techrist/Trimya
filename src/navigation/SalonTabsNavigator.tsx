import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ScanLine,
  UsersRound,
  CalendarDays,
  MessageCircle,
  User,
} from 'lucide-react-native';

import {
  SalonTabParamList,
  ScannerStackParamList,
  CustomersStackParamList,
  MessagesStackParamList,
  ReservationsStackParamList,
  ProfileStackParamList,
} from './types';
import { colors, typography } from '@/theme';
import { useApp } from '@/contexts/AppContext';
import { useSalonUnreadCount } from '@/hooks/useSalonUnreadCount';
import { useSalonPendingReservations } from '@/hooks/useSalonPendingReservations';
import { useT } from '@/i18n';

import { SalonScannerScreen } from '@/screens/salon/SalonScannerScreen';
import { SalonAddCutScreen } from '@/screens/salon/SalonAddCutScreen';
import { SalonCustomersScreen } from '@/screens/salon/SalonCustomersScreen';
import { SalonCustomerDetailScreen } from '@/screens/salon/SalonCustomerDetailScreen';
import { SalonComposeNotificationScreen } from '@/screens/salon/SalonComposeNotificationScreen';
import { SalonMessagesScreen } from '@/screens/salon/SalonMessagesScreen';
import { SalonChatScreen } from '@/screens/salon/SalonChatScreen';
import { SalonReservationsScreen } from '@/screens/salon/SalonReservationsScreen';
import { SalonReservationDetailScreen } from '@/screens/salon/SalonReservationDetailScreen';
import { SalonProposeReservationScreen } from '@/screens/salon/SalonProposeReservationScreen';
import { SalonRefuseReservationScreen } from '@/screens/salon/SalonRefuseReservationScreen';
import { SalonProfileScreen } from '@/screens/salon/SalonProfileScreen';
import { SalonStatsScreen } from '@/screens/salon/SalonStatsScreen';
import { SalonBarbersScreen } from '@/screens/salon/SalonBarbersScreen';
import { SalonBarberFormScreen } from '@/screens/salon/SalonBarberFormScreen';
import { SalonBarberStatsScreen } from '@/screens/salon/SalonBarberStatsScreen';

const Tab = createBottomTabNavigator<SalonTabParamList>();
const ScannerStack = createNativeStackNavigator<ScannerStackParamList>();
const CustomersStack = createNativeStackNavigator<CustomersStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const ReservationsStack = createNativeStackNavigator<ReservationsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ScannerStackNavigator() {
  return (
    <ScannerStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <ScannerStack.Screen name="Scanner" component={SalonScannerScreen} />
      <ScannerStack.Screen name="AddCut" component={SalonAddCutScreen} />
    </ScannerStack.Navigator>
  );
}

function CustomersStackNavigator() {
  return (
    <CustomersStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <CustomersStack.Screen name="CustomersList" component={SalonCustomersScreen} />
      <CustomersStack.Screen name="CustomerDetail" component={SalonCustomerDetailScreen} />
      <CustomersStack.Screen name="Chat" component={SalonChatScreen} />
      <CustomersStack.Screen
        name="ComposeNotification"
        component={SalonComposeNotificationScreen}
      />
    </CustomersStack.Navigator>
  );
}

function MessagesStackNavigator() {
  return (
    <MessagesStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <MessagesStack.Screen name="MessagesList" component={SalonMessagesScreen} />
      <MessagesStack.Screen name="Chat" component={SalonChatScreen} />
    </MessagesStack.Navigator>
  );
}

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
        component={SalonReservationsScreen}
      />
      <ReservationsStack.Screen
        name="ReservationDetail"
        component={SalonReservationDetailScreen}
      />
      <ReservationsStack.Screen
        name="ProposeReservation"
        component={SalonProposeReservationScreen}
      />
      <ReservationsStack.Screen
        name="RefuseReservation"
        component={SalonRefuseReservationScreen}
      />
    </ReservationsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <ProfileStack.Screen name="Profile" component={SalonProfileScreen} />
      <ProfileStack.Screen name="FullStats" component={SalonStatsScreen} />
      <ProfileStack.Screen name="Barbers" component={SalonBarbersScreen} />
      <ProfileStack.Screen name="BarberForm" component={SalonBarberFormScreen} />
      <ProfileStack.Screen name="BarberStats" component={SalonBarberStatsScreen} />
    </ProfileStack.Navigator>
  );
}

export function SalonTabsNavigator() {
  const { salonId } = useApp();
  const unread = useSalonUnreadCount(salonId);
  const pendingRdv = useSalonPendingReservations(salonId);
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
        name="ScannerTab"
        component={ScannerStackNavigator}
        options={{
          title: t('salon.tab.scanner'),
          tabBarIcon: ({ color, size }) => (
            <ScanLine color={color} size={size ?? 22} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="CustomersTab"
        component={CustomersStackNavigator}
        options={{
          title: t('salon.tab.customers'),
          tabBarIcon: ({ color, size }) => (
            <UsersRound color={color} size={size ?? 22} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="ReservationsTab"
        component={ReservationsStackNavigator}
        options={{
          title: t('salon.tab.reservations'),
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size ?? 22} strokeWidth={2} />
          ),
          tabBarBadge: pendingRdv > 0 ? (pendingRdv > 99 ? '99+' : pendingRdv) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: colors.black,
            fontWeight: '700',
            fontSize: 11,
          },
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStackNavigator}
        options={{
          title: t('salon.tab.messages'),
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
        component={ProfileStackNavigator}
        options={{
          title: t('salon.tab.profile'),
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
