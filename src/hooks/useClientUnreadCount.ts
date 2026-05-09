import { useEffect, useState } from 'react';
import { storage } from '@/services/storage';
import { subscribeConversation } from '@/services/conversations';

export function useClientUnreadCount(): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) return;
      unsub = subscribeConversation(id, (c) => {
        setUnread(c?.unreadByCustomer || 0);
      });
    })();
    return () => unsub?.();
  }, []);

  return unread;
}
