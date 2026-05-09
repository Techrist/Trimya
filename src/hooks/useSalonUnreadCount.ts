import { useEffect, useState } from 'react';
import { subscribeSalonConversations } from '@/services/conversations';

export function useSalonUnreadCount(salonId: string | null): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!salonId) {
      setUnread(0);
      return;
    }
    const unsub = subscribeSalonConversations(salonId, (list) => {
      const total = list.reduce((s, c) => s + (c.unreadBySalon || 0), 0);
      setUnread(total);
    });
    return unsub;
  }, [salonId]);

  return unread;
}
