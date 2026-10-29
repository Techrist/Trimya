import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  CheckCircle2,
  X,
  Clock,
  MapPin,
  Scissors,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useT } from '@/i18n';
import { humanizeError } from '@/lib/humanizeError';
import {
  getHomeServiceRequest,
  updateHomeServiceRequestStatus,
  formatHomeRequestDateTime,
  isHomeRequestActionable,
} from '@/services/homeServiceRequests';
import { storage } from '@/services/storage';
import { getCustomer } from '@/services/customers';
import { colors, radius, spacing, typography } from '@/theme';
import { Customer, HomeServiceRequest, HomeServiceStatus } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientHomeRequestDetail'>;
type Rt = RouteProp<RootStackParamList, 'ClientHomeRequestDetail'>;

/**
 * Détail d'une demande domicile côté client.
 *  - Affiche tous les détails (coiffeur, adresse, créneau, status)
 *  - Si status='proposed' : 2 boutons « Accepter » / « Refuser » la contre-prop
 *  - Si status='pending' ou 'confirmed' : bouton « Annuler ma demande »
 *  - Sinon : lecture seule
 */
export function ClientHomeRequestDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { requestId } = route.params;
  const { t } = useT();
  const [req, setReq] = useState<HomeServiceRequest | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const id = await storage.getCustomerId();
      if (id) setCustomer(await getCustomer(id));
      const r = await getHomeServiceRequest(requestId);
      setReq(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [requestId]);

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
          {t('client.homeRequestDetail.notFound')}
        </Text>
      </Screen>
    );
  }

  const handleAcceptProposal = async () => {
    setActing(true);
    try {
      await updateHomeServiceRequestStatus({
        request: req,
        status: 'confirmed',
        by: 'customer',
      });
      await load();
    } catch (e: any) {
      Alert.alert(t('common.error'), humanizeError(e, t));
    } finally {
      setActing(false);
    }
  };

  const handleRefuseProposal = () => {
    Alert.alert(
      t('client.homeRequestDetail.refuseProposalTitle'),
      t('client.homeRequestDetail.refuseProposalText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('client.homeRequestDetail.refuseProposalCta'),
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            try {
              await updateHomeServiceRequestStatus({
                request: req,
                status: 'cancelled',
                by: 'customer',
              });
              await load();
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      t('client.homeRequestDetail.cancelTitle'),
      t('client.homeRequestDetail.cancelText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('client.homeRequestDetail.cancelCta'),
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            try {
              await updateHomeServiceRequestStatus({
                request: req,
                status: 'cancelled',
                by: 'customer',
              });
              await load();
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  };

  const dt = formatHomeRequestDateTime(req.requestedFor);
  const proposedDt = req.proposedFor ? formatHomeRequestDateTime(req.proposedFor) : null;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('client.homeRequestDetail.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status badge */}
        <StatusBadge status={req.status} t={t} />

        {/* Contre-proposition si status='proposed' */}
        {req.status === 'proposed' && (
          <Card style={styles.proposalCard}>
            <View style={styles.proposalHeader}>
              <AlertTriangle color={colors.primary} size={20} strokeWidth={2.4} />
              <Text style={styles.proposalTitle}>
                {t('client.homeRequestDetail.proposalTitle')}
              </Text>
            </View>
            {req.proposedBarberName ? (
              <View style={styles.proposalRow}>
                <Scissors color={colors.textMuted} size={16} strokeWidth={2} />
                <Text style={styles.proposalLabel}>
                  {t('client.homeRequestDetail.proposalBarber')}
                </Text>
                <Text style={styles.proposalValue}>
                  {req.proposedBarberName}
                </Text>
              </View>
            ) : null}
            {proposedDt ? (
              <View style={styles.proposalRow}>
                <Clock color={colors.textMuted} size={16} strokeWidth={2} />
                <Text style={styles.proposalLabel}>
                  {t('client.homeRequestDetail.proposalSlot')}
                </Text>
                <Text style={styles.proposalValue}>{proposedDt.full}</Text>
              </View>
            ) : null}
            {req.proposeMessage ? (
              <Text style={styles.proposalMessage}>« {req.proposeMessage} »</Text>
            ) : null}
            <View style={styles.proposalActions}>
              <Button
                label={t('client.homeRequestDetail.acceptProposal')}
                onPress={handleAcceptProposal}
                loading={acting}
              />
              <View style={{ height: spacing.sm }} />
              <Button
                label={t('client.homeRequestDetail.refuseProposalCta')}
                onPress={handleRefuseProposal}
                variant="ghost"
              />
            </View>
          </Card>
        )}

        {/* Refus */}
        {req.status === 'refused' && req.refuseMessage ? (
          <Card style={styles.refuseCard}>
            <Text style={styles.refuseTitle}>
              {t('client.homeRequestDetail.refuseTitle')}
            </Text>
            <Text style={styles.refuseMessage}>« {req.refuseMessage} »</Text>
          </Card>
        ) : null}

        {/* Détails de la demande */}
        <Card>
          <Text style={styles.sectionLabel}>
            {t('client.homeRequestDetail.detailsSection')}
          </Text>

          <Row icon={Scissors} label={t('client.homeRequestDetail.barber')} value={req.barberName} />
          <Row icon={Clock} label={t('client.homeRequestDetail.slot')} value={dt.full} />
          <Row icon={MapPin} label={t('client.homeRequestDetail.address')} value={req.address} />
          {req.city ? (
            <Row icon={MapPin} label={t('client.homeRequestDetail.city')} value={req.city} />
          ) : null}
          {req.addressNotes ? (
            <Row icon={MapPin} label={t('client.homeRequestDetail.addressNotes')} value={req.addressNotes} />
          ) : null}
          {req.message ? (
            <Row icon={MessageSquare} label={t('client.homeRequestDetail.message')} value={req.message} />
          ) : null}
        </Card>

        {/* CTA : annuler la demande */}
        {(req.status === 'pending' || req.status === 'confirmed') && (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              label={t('client.homeRequestDetail.cancelCta')}
              onPress={handleCancel}
              variant="ghost"
              loading={acting}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// ─── Components ────────────────────────────────────────────

function StatusBadge({ status, t }: { status: HomeServiceStatus; t: any }) {
  const palette = {
    pending: { color: colors.accent, icon: Clock },
    confirmed: { color: colors.success, icon: CheckCircle2 },
    proposed: { color: colors.primary, icon: AlertTriangle },
    refused: { color: colors.danger, icon: X },
    cancelled: { color: colors.textDim, icon: X },
    completed: { color: colors.success, icon: CheckCircle2 },
  }[status];
  const Icon = palette.icon;
  return (
    <View
      style={[
        styles.badge,
        { borderColor: palette.color, backgroundColor: `${palette.color}1A` },
      ]}
    >
      <Icon color={palette.color} size={16} strokeWidth={2.4} />
      <Text style={[styles.badgeText, { color: palette.color }]}>
        {t(`home.status.${status}`)}
      </Text>
    </View>
  );
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
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  proposalCard: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  proposalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  proposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  proposalLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  proposalValue: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  proposalMessage: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  proposalActions: {
    marginTop: spacing.md,
  },
  refuseCard: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  refuseTitle: {
    ...typography.bodyBold,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  refuseMessage: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
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
});
