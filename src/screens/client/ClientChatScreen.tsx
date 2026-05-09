import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { ChatView } from '@/components/ChatView';
import { Avatar } from '@/components/Avatar';
import { useT } from '@/i18n';
import { storage } from '@/services/storage';
import { getCustomer } from '@/services/customers';
import { getSalon } from '@/services/salons';
import {
  subscribeMessages,
  sendMessage,
  markRead,
} from '@/services/conversations';
import { colors, spacing, typography } from '@/theme';
import { Customer, Message } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientChat'>;

export function ClientChatScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [salonName, setSalonName] = useState<string>('Salon');
  const [salonLogo, setSalonLogo] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
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

      const salon = await getSalon(c.salonId);
      if (salon) {
        setSalonName(salon.name);
        setSalonLogo(salon.logo);
      }

      unsub = subscribeMessages(c.id, (list) => {
        setMessages(list);
        setLoading(false);
        markRead(c.id, 'customer');
      });
    })();
    return () => unsub?.();
  }, []);

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
      Alert.alert(t('common.error'), e.message || t('salon.chat.errorSend'));
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

      <ChatView
        messages={messages}
        loading={loading}
        myRole="customer"
        onSend={handleSend}
        emptyHint={t('client.chat.empty.hint')}
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
});
