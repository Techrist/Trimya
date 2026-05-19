import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  Gift,
  Cake,
  MessageCircle,
  PencilLine,
  LucideIcon,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { LockedFeature } from '@/components/LockedFeature';
import { getCustomer } from '@/services/customers';
import { sendMessage } from '@/services/conversations';
import { currentUser } from '@/services/auth';
import { useApp } from '@/contexts/AppContext';
import { useSalonPlan } from '@/hooks/useSalonPlan';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Customer } from '@/types';
import { CustomersStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<CustomersStackParamList, 'ComposeNotification'>;
type Rt = RouteProp<CustomersStackParamList, 'ComposeNotification'>;

interface Preset {
  key: string;
  Icon: LucideIcon;
  labelKey: string;
  titleKey: string;
  bodyKey: string;
}

const PRESETS: Preset[] = [
  {
    key: 'promo',
    Icon: Gift,
    labelKey: 'salon.compose.preset.promo',
    titleKey: 'salon.compose.preset.promo.title',
    bodyKey: 'salon.compose.preset.promo.body',
  },
  {
    key: 'birthday',
    Icon: Cake,
    labelKey: 'salon.compose.preset.birthday',
    titleKey: 'salon.compose.preset.birthday.title',
    bodyKey: 'salon.compose.preset.birthday.body',
  },
  {
    key: 'miss',
    Icon: MessageCircle,
    labelKey: 'salon.compose.preset.miss',
    titleKey: 'salon.compose.preset.miss.title',
    bodyKey: 'salon.compose.preset.miss.body',
  },
  {
    key: 'custom',
    Icon: PencilLine,
    labelKey: 'salon.compose.preset.custom',
    titleKey: '',
    bodyKey: '',
  },
];

export function SalonComposeNotificationScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { customerId } = route.params;
  const { t } = useT();
  const { salonId } = useApp();
  const { limits, loading: planLoading } = useSalonPlan(salonId);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activePreset, setActivePreset] = useState<string>('promo');
  const [title, setTitle] = useState(t(PRESETS[0].titleKey as any));
  const [body, setBody] = useState(t(PRESETS[0].bodyKey as any));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await getCustomer(customerId);
      setCustomer(c);
    })();
  }, [customerId]);

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset.key);
    if (preset.key !== 'custom') {
      setTitle(t(preset.titleKey as any));
      setBody(t(preset.bodyKey as any));
    } else {
      setTitle('');
      setBody('');
    }
  };

  const handleSend = async () => {
    if (!customer) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      Alert.alert(t('salon.compose.incomplete'), t('salon.compose.incompleteHint'));
      return;
    }
    const me = currentUser();
    if (!me) return;

    // Compose final message body: title on first line (if set), then body.
    const messageText = trimmedTitle
      ? `${trimmedTitle}\n${trimmedBody}`
      : trimmedBody;

    setSending(true);
    try {
      await sendMessage({
        customer,
        text: messageText,
        senderRole: 'salon',
        senderId: me.uid,
      });
      // Go straight to the chat so the salon sees the message in context.
      nav.replace('Chat', { customerId: customer.id });
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('salon.compose.errorSend'));
    } finally {
      setSending(false);
    }
  };

  // Garde-fou plan : envoyer une notif passe par la messagerie côté backend.
  if (!planLoading && !limits.messaging) {
    return <LockedFeature requiredPlan="standard" />;
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('salon.compose.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {customer && (
            <View style={styles.recipientCard}>
              <Text style={styles.recipientLabel}>{t('salon.compose.recipient')}</Text>
              <Text style={styles.recipientName}>
                {customer.name || t('salon.reservation.client')}
              </Text>
              <Text style={styles.recipientPhone}>{customer.phone}</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>{t('salon.compose.presets')}</Text>
          <View style={styles.presetGrid}>
            {PRESETS.map((p) => {
              const active = activePreset === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => handlePreset(p)}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                >
                  <p.Icon
                    color={active ? colors.black : colors.primary}
                    size={18}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[styles.presetLabel, active && styles.presetLabelActive]}
                  >
                    {t(p.labelKey as any)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>{t('salon.compose.fieldTitle')}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('salon.compose.fieldTitlePlaceholder')}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            maxLength={80}
          />

          <Text style={styles.sectionLabel}>{t('salon.compose.fieldMessage')}</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t('salon.compose.fieldMessagePlaceholder')}
            placeholderTextColor={colors.textDim}
            style={[styles.input, styles.textarea]}
            multiline
            maxLength={300}
          />
          <Text style={styles.charCount}>{body.length}/300</Text>

          <View style={styles.submitWrap}>
            <Button
              label={t('salon.compose.cta')}
              onPress={handleSend}
              loading={sending}
              disabled={!body.trim()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  recipientCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipientLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  recipientName: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xs,
  },
  recipientPhone: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: spacing.sm,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  presetLabelActive: {
    color: colors.black,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'right',
  },
  warning: {
    backgroundColor: 'rgba(255,235,59,0.1)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: {
    ...typography.caption,
    color: colors.accent,
  },
  submitWrap: {
    marginTop: spacing.lg,
  },
});
