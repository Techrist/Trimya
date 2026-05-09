import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { Send } from 'lucide-react-native';
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
}

export function ChatView({
  messages,
  loading,
  myRole,
  onSend,
  emptyHint,
}: ChatViewProps) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onSend(t);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('client.chat.empty.title')}</Text>
          {emptyHint && <Text style={styles.emptyHint}>{emptyHint}</Text>}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            const prev = index > 0 ? messages[index - 1] : undefined;
            const showDay =
              !prev ||
              !sameDay(prev.createdAt, item.createdAt);
            return (
              <View>
                {showDay && <DayDivider ts={item.createdAt} />}
                <Bubble message={item} mine={item.senderRole === myRole} />
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
          { paddingBottom: spacing.md + Math.max(insets.bottom, 0) },
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

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString(
    localeToBcp47(getCurrentLocale()),
    { hour: '2-digit', minute: '2-digit' },
  );
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        <Text style={[styles.text, mine && styles.textMine]}>{message.text}</Text>
        <Text style={[styles.time, mine && styles.timeMine]}>{time}</Text>
      </View>
    </View>
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
  text: {
    ...typography.body,
    color: colors.text,
  },
  textMine: {
    color: colors.black,
  },
  time: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
    fontSize: 10,
    textAlign: 'right',
  },
  timeMine: {
    color: 'rgba(0,0,0,0.55)',
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
