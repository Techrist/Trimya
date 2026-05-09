import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Camera, ImagePlus } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { BarberAvatar } from '@/components/BarberAvatar';
import { Card } from '@/components/Card';
import { useApp } from '@/contexts/AppContext';
import {
  createBarber,
  updateBarber,
  getBarber,
  pickBarberPhoto,
} from '@/services/barbers';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { ProfileStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'BarberForm'>;
type Rt = RouteProp<ProfileStackParamList, 'BarberForm'>;

export function SalonBarberFormScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { salonId } = useApp();
  const { t } = useT();
  const barberId = route.params?.barberId;
  const isEdit = !!barberId;

  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!barberId) return;
    (async () => {
      const b = await getBarber(barberId);
      if (b) {
        setName(b.name);
        setPhoto(b.photo);
        setActive(b.active);
      }
      setLoading(false);
    })();
  }, [barberId]);

  const handlePickPhoto = async () => {
    try {
      const data = await pickBarberPhoto();
      if (data) setPhoto(data);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('salon.barber.errorPick'));
    }
  };

  const handleSubmit = async () => {
    if (!salonId) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert(t('auth.name.tooShort'), t('auth.name.tooShortHint'));
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && barberId) {
        await updateBarber(barberId, { name: trimmed, photo, active });
      } else {
        await createBarber({ salonId, name: trimmed, photo });
      }
      nav.goBack();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('salon.barber.errorSave'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEdit ? t('salon.barber.formEdit') : t('salon.barber.formAdd')}
        </Text>
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
          <Pressable onPress={handlePickPhoto} style={styles.photoWrap}>
            <BarberAvatar barber={{ name, photo }} size={120} />
            <View style={styles.photoBadge}>
              {photo ? (
                <Camera color={colors.black} size={16} strokeWidth={2.4} />
              ) : (
                <ImagePlus color={colors.black} size={16} strokeWidth={2.4} />
              )}
            </View>
          </Pressable>
          <Text style={styles.photoHint}>
            {photo ? t('salon.barber.photoChange') : t('salon.barber.photoAdd')}
          </Text>

          <TextField
            label={t('auth.name.label')}
            placeholder={t('salon.barber.namePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          {isEdit && (
            <Card>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>{t('salon.barber.activeToggle')}</Text>
                  <Text style={styles.toggleHint}>{t('salon.barber.activeToggleHint')}</Text>
                </View>
                <Switch
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            </Card>
          )}

          <View style={styles.submitWrap}>
            <Button
              label={isEdit ? t('common.save') : t('salon.barber.create')}
              onPress={handleSubmit}
              loading={submitting}
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
  },
  photoWrap: {
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  photoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
  photoHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  toggleHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  submitWrap: {
    marginTop: spacing.xl,
  },
});
