import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { subscribeSalonConversations } from '@/services/conversations';

/**
 * Salon-side variant of useForegroundMessageAlerts: watches ALL conversations
 * for new customer messages and fires a local notification per conversation.
 *
 * Use this in the salon tabs root so alerts trigger no matter which tab
 * the kiosk is currently viewing.
 */
export function useSalonForegroundAlerts(salonId: string | null) {
  const lastSeenRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!salonId) return;
    const seen = lastSeenRef.current;

    const unsub = subscribeSalonConversations(salonId, (convos) => {
      convos.forEach((c) => {
        const prev = seen[c.id];

        // First snapshot — set baseline, don't notify.
        if (prev === undefined) {
          seen[c.id] = c.lastMessageAt;
          return;
        }

        const isNewer = c.lastMessageAt > prev;
        const fromCustomer = c.lastSenderRole === 'customer';

        if (isNewer && fromCustomer && c.lastMessage) {
          const title = c.customerName
            ? `Message de ${c.customerName}`
            : 'Nouveau message client';
          const body =
            c.lastMessage.length > 100
              ? c.lastMessage.slice(0, 97) + '…'
              : c.lastMessage;

          Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: 'default',
              data: { type: 'message', customerId: c.customerId },
            },
            trigger: null,
          }).catch(() => {
            /* ignore */
          });
        }
        seen[c.id] = c.lastMessageAt;
      });
    });

    return unsub;
  }, [salonId]);
}
