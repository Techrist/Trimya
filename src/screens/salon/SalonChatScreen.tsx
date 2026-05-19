import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Star } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { ChatView } from '@/components/ChatView';
import { Avatar } from '@/components/Avatar';
import { LockedFeature } from '@/components/LockedFeature';
import { useT } from '@/i18n';
import { useApp } from '@/contexts/AppContext';
import { useSalonPlan } from '@/hooks/useSalonPlan';
import { getCustomer } from '@/services/customers';
import {
  subscribeMessages,
  subscribeConversation,
  sendMessage,
  markRead,
} from '@/services/conversations';
import { currentUser } from '@/services/auth';
import { colors, spacing, typography } from '@/theme';
import { Conversation, Customer, Message } from '@/types';

type ChatRouteParam = { customerId: string };
type Nav = NativeStackNavigationProp<any>;
type Rt = RouteProp<{ Chat: ChatRouteParam }, 'Chat'>;

export function SalonChatScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { customerId } = route.params;
  const { salonId } = useApp();
  const { t } = useT();
  const { limits, loading: planLoading } = useSalonPlan(salonId);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!limits.messaging) {
      setLoading(false);
      return;
    }
    let unsub: (() => void) | undefined;
    let unsubConvo: (() => void) | undefined;
    (async () => {
      const c = await getCustomer(customerId);
      if (!c) {
        setLoading(false);
        return;
      }
      setCustomer(c);
      unsub = subscribeMessages(c.id, (list) => {
        setMessages(list);
        setLoading(false);
      });
      unsubConvo = subscribeConversation(c.id, setConversation);
    })();
    return () => {
      unsub?.();
      unsubConvo?.();
    };
  }, [customerId, limits.messaging]);

  // Mark messages as read only when the salon is actually viewing this chat.
  useFocusEffect(
    React.useCallback(() => {
      if (customer && messages.length > 0) {
        markRead(customer.id, 'salon');
      }
    }, [customer, messages.length]),
  );

  const handleSend = async (msg: string) => {
    if (!customer || !salonId) return;
    const me = currentUser();
    if (!me) return;
    try {
      await sendMessage({
        customer,
        text: msg,
        senderRole: 'salon',
        senderId: me.uid,
      });
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('salon.chat.errorSend'));
    }
  };

  // Garde-fou plan : si on arrive ici via un deep link / une route persistée
  // sur un salon Free, on bloque proprement avec le LockedFeature plein écran.
  if (!planLoading && !limits.messaging) {
    return <LockedFeature requiredPlan="standard" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Avatar name={customer?.name} photo={customer?.photo} size={36} />
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {customer?.name || t('salon.reservation.client')}
              </Text>
              {customer?.vip && (
                <Star
                  color={colors.accent}
                  size={14}
                  strokeWidth={2.2}
                  fill={colors.accent}
                />
              )}
            </View>
            <Text style={styles.headerSubtitle}>{customer?.phone || ''}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ChatView
        messages={messages}
        loading={loading}
        myRole="salon"
        onSend={handleSend}
        emptyHint={t('salon.chat.empty.hint')}
        lastReadByOtherAt={conversation?.lastReadByCustomerAt || 0}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
