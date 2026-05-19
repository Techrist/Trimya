import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Send, Check, CheckCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Message, SenderRole } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';
import { useT, getCurrentLocale, localeToBcp47 } from '@/i18n';

interface ChatViewProps {
  messages: Message[];
  loading?: boolean;
  myRole: SenderRole;
  onSend: (text: string) => Promise<void>;
  emptyHint?: string;
  /** Timestamp at which the other party last read the conversation. Used for read receipts. */
  lastReadByOtherAt?: number;
}

type PendingStatus = 'sending' | 'failed';

interface Pending {
  tempId: string;
  text: string;
  createdAt: number;
  status: PendingStatus;
}

type RenderItem =
  | { kind: 'real'; message: Message }
  | { kind: 'pending'; pending: Pending };

export function ChatView({
  messages,
  loading,
  myRole,
  onSend,
  emptyHint,
  lastReadByOtherAt = 0,
}: ChatViewProps) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const listRef = useRef<FlatList<RenderItem>>(null);

  // Track keyboard state so we can collapse the bottom safe-area padding
  // when it's not needed (it'd otherwise create a phantom gap above the keyboard).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Once the real message arrives via Firestore subscription, drop the
  // matching pending placeholder so we don't show a duplicate.
  useEffect(() => {
    setPending((current) =>
      current.filter((p) => {
        if (p.status === 'failed') return true; // keep failed for retry UI
        const matched = messages.some(
          (m) =>
            m.senderRole === myRole &&
            m.text === p.text &&
            Math.abs(m.createdAt - p.createdAt) < 30_000,
        );
        return !matched;
      }),
    );
  }, [messages, myRole]);

  const items = useMemo<RenderItem[]>(() => {
    const real = messages.map<RenderItem>((message) => ({ kind: 'real', message }));
    const pend = pending.map<RenderItem>((p) => ({ kind: 'pending', pending: p }));
    const merged = [...real, ...pend];
    merged.sort((a, b) => itemTimestamp(a) - itemTimestamp(b));
    return merged;
  }, [messages, pending]);

  useEffect(() => {
    if (items.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [items.length]);

  const doSend = async (toSend: string, tempId: string) => {
    try {
      await onSend(toSend);
      // Real message will arrive shortly; the useEffect above will drop pending.
    } catch {
      setPending((current) =>
        current.map((p) =>
          p.tempId === tempId ? { ...p, status: 'failed' } : p,
        ),
      );
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newPending: Pending = {
      tempId,
      text: trimmed,
      createdAt: Date.now(),
      status: 'sending',
    };

    setText('');
    setSending(true);
    setPending((p) => [...p, newPending]);

    try {
      await doSend(trimmed, tempId);
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async (p: Pending) => {
    // Reset to sending state and retry
    setPending((current) =>
      current.map((x) =>
        x.tempId === p.tempId ? { ...x, status: 'sending', createdAt: Date.now() } : x,
      ),
    );
    setSending(true);
    try {
      await doSend(p.text, p.tempId);
    } finally {
      setSending(false);
    }
  };

  const hasContent = items.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !hasContent ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('client.chat.empty.title')}</Text>
          {emptyHint && <Text style={styles.emptyHint}>{emptyHint}</Text>}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(it) =>
            it.kind === 'real' ? it.message.id : it.pending.tempId
          }
          renderItem={({ item, index }) => {
            const prev = index > 0 ? items[index - 1] : undefined;
            const currentTs = itemTimestamp(item);
            const prevTs = prev ? itemTimestamp(prev) : undefined;
            const showDay = !prevTs || !sameDay(prevTs, currentTs);

            if (item.kind === 'pending') {
              return (
                <View>
                  {showDay && <DayDivider ts={currentTs} />}
                  <PendingBubble
                    pending={item.pending}
                    onRetry={() => handleRetry(item.pending)}
                    sendingLabel={t('chat.status.sending')}
                    failedLabel={t('chat.status.failed')}
                  />
                </View>
              );
            }
            return (
              <View>
                {showDay && <DayDivider ts={currentTs} />}
                <Bubble
                  message={item.message}
                  mine={item.message.senderRole === myRole}
                  lastReadByOtherAt={lastReadByOtherAt}
                />
              </View>
            );
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: false });
          }}
        />
      )}

      <View
        style={[
          styles.inputBar,
          {
            paddingBottom:
              spacing.sm + (keyboardOpen ? 0 : Math.max(insets.bottom, 0)),
          },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('chat.input.placeholder')}
          placeholderTextColor={colors.textDim}
          style={styles.input}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={({ pressed }) => [
            styles.sendBtnWrap,
            (!text.trim() || sending) && styles.sendBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendBtn}
          >
            <Send color={colors.black} size={20} strokeWidth={2.4} />
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function itemTimestamp(item: RenderItem): number {
  return item.kind === 'real' ? item.message.createdAt : item.pending.createdAt;
}

function Bubble({
  message,
  mine,
  lastReadByOtherAt,
}: {
  message: Message;
  mine: boolean;
  lastReadByOtherAt: number;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString(
    localeToBcp47(getCurrentLocale()),
    { hour: '2-digit', minute: '2-digit' },
  );

  // Read receipt state (only for our own messages)
  const read = mine && lastReadByOtherAt >= message.createdAt;
  const delivered = mine && !read && lastReadByOtherAt > 0;

  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        <Text style={[styles.text, mine && styles.textMine]}>{message.text}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.time, mine && styles.timeMine]}>{time}</Text>
          {mine && (
            <View style={styles.receipt}>
              {read ? (
                <CheckCheck
                  color={READ_COLOR}
                  size={14}
                  strokeWidth={2.4}
                />
              ) : delivered ? (
                <CheckCheck
                  color="rgba(0,0,0,0.55)"
                  size={14}
                  strokeWidth={2.4}
                />
              ) : (
                <Check
                  color="rgba(0,0,0,0.55)"
                  size={14}
                  strokeWidth={2.4}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const READ_COLOR = '#4FC3F7';

function PendingBubble({
  pending,
  onRetry,
  sendingLabel,
  failedLabel,
}: {
  pending: Pending;
  onRetry: () => void;
  sendingLabel: string;
  failedLabel: string;
}) {
  const failed = pending.status === 'failed';
  return (
    <Pressable
      onPress={failed ? onRetry : undefined}
      style={[styles.bubbleRow, styles.rowMine]}
    >
      <View>
        <View
          style={[
            styles.bubble,
            styles.bubbleMine,
            styles.bubblePending,
            failed && styles.bubbleFailed,
          ]}
        >
          <Text style={[styles.text, styles.textMine]}>{pending.text}</Text>
        </View>
        <Text
          style={[
            styles.pendingHint,
            failed && styles.pendingHintFailed,
          ]}
        >
          {failed ? failedLabel : sendingLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function DayDivider({ ts }: { ts: number }) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const bcp47 = localeToBcp47(getCurrentLocale());
  const isEn = getCurrentLocale() === 'en';

  let label: string;
  if (sameDay(ts, today.getTime())) label = isEn ? 'Today' : "Aujourd'hui";
  else if (sameDay(ts, yesterday.getTime())) label = isEn ? 'Yesterday' : 'Hier';
  else
    label = date.toLocaleDateString(bcp47, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  return (
    <View style={styles.dayWrap}>
      <Text style={styles.dayText}>{label}</Text>
    </View>
  );
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  bubbleRow: {
    marginVertical: 3,
    flexDirection: 'row',
  },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubblePending: {
    opacity: 0.7,
  },
  bubbleFailed: {
    backgroundColor: colors.danger,
    opacity: 1,
  },
  text: {
    ...typography.body,
    color: colors.text,
  },
  textMine: {
    color: colors.black,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  time: {
    ...typography.caption,
    color: colors.textDim,
    fontSize: 10,
  },
  timeMine: {
    color: 'rgba(0,0,0,0.55)',
  },
  receipt: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingHint: {
    ...typography.caption,
    color: colors.textDim,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 2,
    marginRight: 4,
    fontStyle: 'italic',
  },
  pendingHintFailed: {
    color: colors.danger,
    fontStyle: 'normal',
    fontWeight: '600',
  },
  dayWrap: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dayText: {
    ...typography.caption,
    color: colors.textDim,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    textTransform: 'capitalize',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendBtnWrap: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
