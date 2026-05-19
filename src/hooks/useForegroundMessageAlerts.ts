import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Conversation, SenderRole } from '@/types';

/**
 * Fire a LOCAL notification when a new message arrives from the OTHER party.
 *
 * Works without FCM/APNs — uses the device's local notification system.
 * Triggers when the JS context is alive (app foreground or recently
 * backgrounded). If the app is fully killed, only real push wakes it.
 */
export function useForegroundMessageAlerts(params: {
  conversation: Conversation | null;
  myRole: SenderRole;
  notificationTitle: string;
}) {
  const { conversation, myRole, notificationTitle } = params;
  const lastSeenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversation) return;

    // First time — establish baseline, no alert.
    if (lastSeenAtRef.current === null) {
      lastSeenAtRef.current = conversation.lastMessageAt;
      return;
    }

    const isNewer = conversation.lastMessageAt > lastSeenAtRef.current;
    const fromOther = conversation.lastSenderRole !== myRole;

    if (isNewer && fromOther && conversation.lastMessage) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: notificationTitle,
          body:
            conversation.lastMessage.length > 100
              ? conversation.lastMessage.slice(0, 97) + '…'
              : conversation.lastMessage,
          sound: 'default',
          data: { type: 'message', conversationId: conversation.id },
        },
        trigger: null,
      }).catch(() => {
        /* ignore */
      });
    }
    lastSeenAtRef.current = conversation.lastMessageAt;
  }, [conversation, myRole, notificationTitle]);
}
