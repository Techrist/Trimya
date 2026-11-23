import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MessageCircleOff } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { ChatView } from '@/components/ChatView';
import { Avatar } from '@/components/Avatar';
import { useT } from '@/i18n';
import { humanizeError } from '@/lib/humanizeError';
import { storage } from '@/services/storage';
import { getCustomer } from '@/services/customers';
import { getSalon } from '@/services/salons';
import {
  subscribeMessages,
  subscribeConversation,
  sendMessage,
  markRead,
} from '@/services/conversations';
import { getLimits } from '@/lib/plans';
import { colors, spacing, typography } from '@/theme';
import { Conversation, Customer, Message, Salon } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientChat'>;

export function ClientChatScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  // Plan-gating : la messagerie est réservée aux salons en plan Standard
  // ou Pro. Côté client, on détermine ça depuis les limits du salon.
  // Tant que le salon n'est pas chargé on considère messaging=true pour
  // ne pas faire clignoter l'écran "non activé" avant la vraie valeur.
  const salonLimits = salon ? getLimits(salon) : null;
  const messagingAvailable = salonLimits ? salonLimits.messaging : true;

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let unsubConvo: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) {
        setLoading(false);
        return;
      }
      const c = await getCustomer(id);
      if (!c) {
        setLoading(false);
        return;
      }
      setCustomer(c);

      const s = await getSalon(c.salonId);
      if (s) {
        setSalon(s);
      }

      // On ne souscrit aux conversations/messages QUE si le plan autorise
      // la messagerie. Sinon les règles Firestore renvoient permission-denied
      // et ça pollue la console pour rien.
      if (s && getLimits(s).messaging) {
        unsub = subscribeMessages(c.id, (list) => {
          setMessages(list);
          setLoading(false);
        });
        unsubConvo = subscribeConversation(c.id, setConversation);
      } else {
        setLoading(false);
      }
    })();
    return () => {
      unsub?.();
      unsubConvo?.();
    };
  }, []);

  const salonName = salon?.name ?? 'Salon';
  const salonLogo = salon?.logo;

  // Mark messages as read only when the user is actually viewing the chat tab.
  useFocusEffect(
    React.useCallback(() => {
      if (customer && messages.length > 0) {
        markRead(customer.id, 'customer');
      }
    }, [customer, messages.length]),
  );

  const handleSend = async (msg: string) => {
    if (!customer) return;
    try {
      await sendMessage({
        customer,
        text: msg,
        senderRole: 'customer',
        senderId: customer.id,
      });
    } catch (e: any) {
      Alert.alert(t('common.error'), humanizeError(e, t));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {nav.canGoBack() ? (
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
            <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.headerCenter}>
          <Avatar name={salonName} photo={salonLogo} size={36} />
          <View>
            <Text style={styles.headerTitle}>{salonName}</Text>
            <Text style={styles.headerSubtitle}>{t('client.chat.subtitle')}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!messagingAvailable ? (
        <View style={styles.unavailableWrap}>
          <View style={styles.unavailableIcon}>
            <MessageCircleOff
              color={colors.textMuted}
              size={44}
              strokeWidth={1.8}
            />
          </View>
          <Text style={styles.unavailableTitle}>
            {t('client.chat.unavailableTitle')}
          </Text>
          <Text style={styles.unavailableBody}>
            {t('client.chat.unavailableBody')}
          </Text>
        </View>
      ) : (
        <ChatView
          messages={messages}
          loading={loading}
          myRole="customer"
          onSend={handleSend}
          emptyHint={t('client.chat.empty.hint')}
          lastReadByOtherAt={conversation?.lastReadBySalonAt || 0}
        />
      )}
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
    justifyContent: 'center',
    gap: spacing.sm,
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
  unavailableWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  unavailableIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  unavailableTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  unavailableBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
