import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { Conversation, Message, SenderRole, Customer } from '@/types';
import { sendPush } from './push';

/**
 * Conversation id = customer id (one conversation per customer with the salon).
 */
function convoId(customerId: string): string {
  return customerId;
}

export async function ensureConversation(input: {
  customer: Customer;
}): Promise<Conversation> {
  const id = convoId(input.customer.id);
  const ref = doc(db, 'conversations', id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id, ...(snap.data() as Omit<Conversation, 'id'>) };
  }

  const c: Conversation = {
    id,
    customerId: input.customer.id,
    salonId: input.customer.salonId,
    customerName: input.customer.name || '',
    customerPhone: input.customer.phone,
    customerVip: !!input.customer.vip,
    lastMessage: '',
    lastMessageAt: Date.now(),
    lastSenderRole: 'customer',
    unreadByCustomer: 0,
    unreadBySalon: 0,
    createdAt: Date.now(),
  };
  await setDoc(ref, c);
  return c;
}

export function subscribeConversation(
  customerId: string,
  cb: (c: Conversation | null) => void,
): () => void {
  const ref = doc(db, 'conversations', convoId(customerId));
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb({ id: snap.id, ...(snap.data() as Omit<Conversation, 'id'>) });
  });
}

export function subscribeSalonConversations(
  salonId: string,
  cb: (list: Conversation[]) => void,
): () => void {
  const q = query(
    collection(db, 'conversations'),
    where('salonId', '==', salonId),
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Conversation, 'id'>),
    }));
    list.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    cb(list);
  });
}

export function subscribeMessages(
  customerId: string,
  cb: (messages: Message[]) => void,
  max = 200,
): () => void {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', convoId(customerId)),
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Message, 'id'>),
    }));
    list.sort((a, b) => a.createdAt - b.createdAt);
    cb(list.slice(-max));
  });
}

interface SendMessageParams {
  customer: Customer;
  text: string;
  senderRole: SenderRole;
  senderId: string;
}

export async function sendMessage(params: SendMessageParams): Promise<void> {
  const { customer, text, senderRole, senderId } = params;
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Message vide.');

  const id = convoId(customer.id);
  const convoRef = doc(db, 'conversations', id);
  const messageRef = doc(collection(db, 'messages'));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(convoRef);
    if (!snap.exists()) {
      const initial: Conversation = {
        id,
        customerId: customer.id,
        salonId: customer.salonId,
        customerName: customer.name || '',
        customerPhone: customer.phone,
        customerPhoto: customer.photo || '',
        customerVip: !!customer.vip,
        lastMessage: trimmed,
        lastMessageAt: Date.now(),
        lastSenderRole: senderRole,
        unreadByCustomer: senderRole === 'salon' ? 1 : 0,
        unreadBySalon: senderRole === 'customer' ? 1 : 0,
        createdAt: Date.now(),
      };
      tx.set(convoRef, initial);
    } else {
      tx.update(convoRef, {
        lastMessage: trimmed,
        lastMessageAt: Date.now(),
        lastSenderRole: senderRole,
        customerName: customer.name || '',
        customerPhoto: customer.photo || '',
        customerVip: !!customer.vip,
        unreadByCustomer:
          senderRole === 'salon' ? increment(1) : (snap.data() as any).unreadByCustomer ?? 0,
        unreadBySalon:
          senderRole === 'customer' ? increment(1) : (snap.data() as any).unreadBySalon ?? 0,
      });
    }

    const message: Message = {
      id: messageRef.id,
      conversationId: id,
      senderId,
      senderRole,
      text: trimmed,
      createdAt: Date.now(),
    };
    tx.set(messageRef, message);
  });

  // Best-effort push to the customer if the salon sent the message
  // and the customer has consented to push notifications.
  if (
    senderRole === 'salon' &&
    customer.pushToken &&
    customer.pushEnabled !== false
  ) {
    try {
      await sendPush({
        token: customer.pushToken,
        title: 'Nouveau message du salon',
        body: trimmed.length > 100 ? trimmed.slice(0, 97) + '…' : trimmed,
        data: { type: 'message', customerId: customer.id },
      });
    } catch {
      /* ignore push failures */
    }
  }
}

export async function markRead(customerId: string, role: SenderRole): Promise<void> {
  const ref = doc(db, 'conversations', convoId(customerId));
  const field = role === 'customer' ? 'unreadByCustomer' : 'unreadBySalon';
  try {
    await updateDoc(ref, { [field]: 0 });
  } catch {
    /* convo may not exist yet */
  }
}
