import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  ChevronLeft,
  CheckCircle2,
  X,
  Clock,
  MapPin,
  MessageSquare,
  Scissors,
  RefreshCw,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useApp } from '@/contexts/AppContext';
import {
  getHomeServiceRequest,
  updateHomeServiceRequestStatus,
  formatHomeRequestDateTime,
} from '@/services/homeServiceRequests';
import { subscribeBarbers } from '@/services/barbers';
import { getCustomer } from '@/services/customers';
import { DateSlotPicker, TimeSlotPicker } from '@/components/SlotPickers';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import {
  Barber,
  Customer,
  HomeServiceRequest,
} from '@/types';

type Rt = RouteProp<{ SalonHomeRequestAction: { requestId: string } }, 'SalonHomeRequestAction'>;

/**
 * Écran d'action côté salon pour une demande domicile.
 *
 * Trois actions principales :
 *  - Confirmer tel quel (status → confirmed)
 *  - Contre-proposer (autre coiffeur, autre créneau, ou les deux)
 *  - Refuser (avec message libre)
 *
 * Si déjà confirmé : bouton « Marquer terminé ».
 */
export function SalonHomeRequestActionScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<Rt>();
  const { requestId } = route.params;
  const { salonId } = useApp();
  const { t } = useT();
  const [req, setReq] = useState<HomeServiceRequest | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // États contre-proposition
  const [showPropose, setShowPropose] = useState(false);
  const [proposedBarberId, setProposedBarberId] = useState<string | null>(null);
  // Date du jour proposé (00:00) + timestamp complet du slot retenu
  const [proposedDateMs, setProposedDateMs] = useState<number>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [proposedSlotTs, setProposedSlotTs] = useState<number | null>(null);
  const [proposeMessage, setProposeMessage] = useState('');

  // États refus
  const [showRefuse, setShowRefuse] = useState(false);
  const [refuseMessage, setRefuseMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await getHomeServiceRequest(requestId);
      setReq(r);
      if (r) {
        const c = await getCustomer(r.customerId);
        setCustomer(c);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [requestId]);

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeBarbers(salonId, setBarbers, { activeOnly: true });
    return unsub;
  }, [salonId]);

  if (loading) {
    return (
      <Screen centered>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!req) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>
          {t('salon.homeRequestAction.notFound')}
        </Text>
      </Screen>
    );
  }

  const dt = formatHomeRequestDateTime(req.requestedFor);

  // ─── Actions ─────────────────────────────────────────

  const handleConfirm = async () => {
    setActing(true);
    try {
      await updateHomeServiceRequestStatus({
        request: req,
        status: 'confirmed',
        by: 'salon',
        customer,
      });
      await load();
    } finally {
      setActing(false);
    }
  };

  const handleComplete = async () => {
    setActing(true);
    try {
      await updateHomeServiceRequestStatus({
        request: req,
        status: 'completed',
        by: 'salon',
        customer,
      });
      await load();
    } finally {
      setActing(false);
    }
  };

  const handlePropose = async () => {
    if (!proposedBarberId && !proposedSlotTs) {
      Alert.alert(t('common.error'), t('salon.homeRequestAction.proposeEmpty'));
      return;
    }
    const proposedBarber = barbers.find((b) => b.id === proposedBarberId);
    setActing(true);
    try {
      await updateHomeServiceRequestStatus({
        request: req,
        status: 'proposed',
        by: 'salon',
        proposedBarberId: proposedBarberId || undefined,
        proposedBarberName: proposedBarber?.name,
        proposedFor: proposedSlotTs ?? undefined,
        proposeMessage: proposeMessage.trim() || undefined,
        customer,
      });
      setShowPropose(false);
      await load();
    } finally {
      setActing(false);
    }
  };

  const handleProposeDateChange = (ts: number) => {
    setProposedDateMs(ts);
    setProposedSlotTs(null);
  };

  const handleRefuse = async () => {
    setActing(true);
    try {
      await updateHomeServiceRequestStatus({
        request: req,
        status: 'refused',
        by: 'salon',
        refuseMessage: refuseMessage.trim() || undefined,
        customer,
      });
      setShowRefuse(false);
      await load();
    } finally {
      setActing(false);
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('salon.homeRequestAction.title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Récap demande */}
        <Card>
          <Text style={styles.sectionLabel}>
            {t('salon.homeRequestAction.requestSection')}
          </Text>
          <Row icon={MessageSquare} label={t('salon.homeRequestAction.customer')} value={req.customerName || req.customerPhone} />
          <Row icon={Scissors} label={t('salon.homeRequestAction.requestedBarber')} value={req.barberName} />
          <Row icon={Clock} label={t('salon.homeRequestAction.slot')} value={dt.full} />
          <Row icon={MapPin} label={t('salon.homeRequestAction.address')} value={req.address} />
          {req.city ? <Row icon={MapPin} label={t('salon.homeRequestAction.city')} value={req.city} /> : null}
          {req.addressNotes ? <Row icon={MapPin} label={t('salon.homeRequestAction.notes')} value={req.addressNotes} /> : null}
          {req.message ? <Row icon={MessageSquare} label={t('salon.homeRequestAction.message')} value={req.message} /> : null}
          <Text style={[styles.statusInline, { color: statusColor(req.status) }]}>
            {t(`home.status.${req.status}`)}
          </Text>
        </Card>

        {/* Actions selon le statut */}
        {req.status === 'pending' && !showPropose && !showRefuse && (
          <View style={styles.actions}>
            <Button
              label={t('salon.homeRequestAction.confirmCta')}
              onPress={handleConfirm}
              loading={acting}
            />
            <View style={{ height: spacing.sm }} />
            <Button
              label={t('salon.homeRequestAction.proposeCta')}
              onPress={() => setShowPropose(true)}
              variant="secondary"
            />
            <View style={{ height: spacing.sm }} />
            <Button
              label={t('salon.homeRequestAction.refuseCta')}
              onPress={() => setShowRefuse(true)}
              variant="ghost"
            />
          </View>
        )}

        {/* Formulaire contre-proposition */}
        {showPropose && (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>
              {t('salon.homeRequestAction.proposeFormTitle')}
            </Text>

            <Text style={styles.formLabel}>
              {t('salon.homeRequestAction.proposeBarberLabel')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.barberChipsRow}>
                {barbers.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() =>
                      setProposedBarberId(proposedBarberId === b.id ? null : b.id)
                    }
                    style={[
                      styles.barberChip,
                      proposedBarberId === b.id && styles.barberChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.barberChipText,
                        proposedBarberId === b.id && styles.barberChipTextActive,
                      ]}
                    >
                      {b.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.formLabel, { marginTop: spacing.md }]}>
              {t('salon.homeRequestAction.proposeSlotLabel')}
            </Text>
            <DateSlotPicker
              value={proposedDateMs}
              onChange={handleProposeDateChange}
              daysAhead={14}
            />
            <TimeSlotPicker
              date={proposedDateMs}
              value={proposedSlotTs}
              onChange={setProposedSlotTs}
            />

            <Text style={[styles.formLabel, { marginTop: spacing.md }]}>
              {t('salon.homeRequestAction.proposeMessageLabel')}
            </Text>
            <TextInput
              value={proposeMessage}
              onChangeText={setProposeMessage}
              placeholder={t('salon.homeRequestAction.proposeMessagePlaceholder')}
              placeholderTextColor={colors.textDim}
              style={styles.input}
              maxLength={200}
              multiline
            />

            <View style={{ height: spacing.md }} />
            <Button
              label={t('salon.homeRequestAction.proposeSubmit')}
              onPress={handlePropose}
              loading={acting}
            />
            <View style={{ height: spacing.sm }} />
            <Button
              label={t('common.cancel')}
              onPress={() => setShowPropose(false)}
              variant="ghost"
            />
          </Card>
        )}

        {/* Formulaire refus */}
        {showRefuse && (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>
              {t('salon.homeRequestAction.refuseFormTitle')}
            </Text>
            <Text style={styles.formLabel}>
              {t('salon.homeRequestAction.refuseMessageLabel')}
            </Text>
            <TextInput
              value={refuseMessage}
              onChangeText={setRefuseMessage}
              placeholder={t('salon.homeRequestAction.refuseMessagePlaceholder')}
              placeholderTextColor={colors.textDim}
              style={styles.input}
              maxLength={200}
              multiline
            />
            <View style={{ height: spacing.md }} />
            <Button
              label={t('salon.homeRequestAction.refuseSubmit')}
              onPress={handleRefuse}
              loading={acting}
              variant="secondary"
            />
            <View style={{ height: spacing.sm }} />
            <Button
              label={t('common.cancel')}
              onPress={() => setShowRefuse(false)}
              variant="ghost"
            />
          </Card>
        )}

        {req.status === 'confirmed' && (
          <View style={styles.actions}>
            <Button
              label={t('salon.homeRequestAction.markCompletedCta')}
              onPress={handleComplete}
              loading={acting}
              variant="secondary"
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'pending':
      return colors.accent;
    case 'confirmed':
    case 'completed':
      return colors.success;
    case 'proposed':
      return colors.primary;
    case 'refused':
    case 'cancelled':
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Icon color={colors.textMuted} size={16} strokeWidth={2} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
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
  backBtn: {
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
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
    marginTop: 2,
  },
  statusInline: {
    ...typography.bodyBold,
    marginTop: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 13,
  },
  actions: {
    marginTop: spacing.lg,
  },
  formCard: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  formTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  formLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  barberChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  barberChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  barberChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.15)',
  },
  barberChipText: {
    ...typography.body,
    color: colors.textMuted,
  },
  barberChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
