import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import {
  Clock,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Pencil,
} from 'lucide-react-native';
import { Card } from './Card';
import { Button } from './Button';
import {
  OpeningHours,
  DayHours,
  SalonClosure,
  DEFAULT_OPENING_HOURS,
} from '@/types';
import {
  setSalonOpeningHours,
  setSalonDayHours,
  addSalonClosure,
  removeSalonClosure,
  formatDayHours,
} from '@/services/openingHours';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

interface OpeningHoursEditorProps {
  salonId: string;
  openingHours?: OpeningHours;
  closures?: SalonClosure[];
}

const DAY_KEYS: { key: keyof OpeningHours; labelKey: string }[] = [
  { key: 'monday', labelKey: 'days.monday' },
  { key: 'tuesday', labelKey: 'days.tuesday' },
  { key: 'wednesday', labelKey: 'days.wednesday' },
  { key: 'thursday', labelKey: 'days.thursday' },
  { key: 'friday', labelKey: 'days.friday' },
  { key: 'saturday', labelKey: 'days.saturday' },
  { key: 'sunday', labelKey: 'days.sunday' },
];

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function OpeningHoursEditor({
  salonId,
  openingHours,
  closures,
}: OpeningHoursEditorProps) {
  const { t } = useT();
  // Sections repliables : par défaut tout est fermé pour ne pas écraser
  // visuellement la page Profil. Le salon ouvre uniquement ce dont il a besoin.
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [closuresOpen, setClosuresOpen] = useState(false);

  // Merge avec les defaults pour qu'un salon avec horaires partiels
  // (ex. seuls monday + tuesday définis) ne crash pas sur les jours manquants.
  const effectiveHours = useMemo<OpeningHours>(
    () => ({ ...DEFAULT_OPENING_HOURS, ...(openingHours ?? {}) }),
    [openingHours],
  );

  // Petit résumé d'aperçu sous le titre pour donner du contexte
  // même quand la section est repliée.
  const openDaysCount = DAY_KEYS.filter(
    ({ key }) => !effectiveHours[key].closed,
  ).length;
  const closuresCount = (closures ?? []).length;

  return (
    <View>
      {/* ── Horaires hebdomadaires ────────────────────────── */}
      <CollapsibleSection
        icon={<Clock color={colors.primary} size={20} strokeWidth={2.2} />}
        title={t('hours.weeklyTitle')}
        summary={t(
          openDaysCount > 1 ? 'hours.openDaysSummaryPlural' : 'hours.openDaysSummary',
          { count: openDaysCount },
        )}
        open={weeklyOpen}
        onToggle={() => setWeeklyOpen((v) => !v)}
      >
        <Text style={styles.sectionHint}>{t('hours.weeklyHint')}</Text>
        <View style={styles.daysList}>
          {DAY_KEYS.map(({ key, labelKey }) => (
            <DayRow
              key={key}
              salonId={salonId}
              dayKey={key}
              label={t(labelKey as never)}
              hours={effectiveHours[key]}
            />
          ))}
        </View>
      </CollapsibleSection>

      {/* ── Fermetures exceptionnelles ───────────────────── */}
      <CollapsibleSection
        icon={<Calendar color={colors.accent} size={20} strokeWidth={2.2} />}
        title={t('hours.closuresTitle')}
        summary={
          closuresCount === 0
            ? t('hours.closuresSummaryEmpty')
            : t(
                closuresCount > 1
                  ? 'hours.closuresSummaryPlural'
                  : 'hours.closuresSummary',
                { count: closuresCount },
              )
        }
        open={closuresOpen}
        onToggle={() => setClosuresOpen((v) => !v)}
      >
        <Text style={styles.sectionHint}>{t('hours.closuresHint')}</Text>
        <ClosuresEditor salonId={salonId} closures={closures ?? []} />
      </CollapsibleSection>
    </View>
  );
}

// ─── Section repliable réutilisable ────────────────────────

function CollapsibleSection({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={styles.collapsibleHeader}
      >
        <View style={styles.collapsibleHeaderLeft}>
          {icon}
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {summary ? (
              <Text style={styles.collapsibleSummary} numberOfLines={1}>
                {summary}
              </Text>
            ) : null}
          </View>
        </View>
        {open ? (
          <ChevronUp color={colors.textMuted} size={20} strokeWidth={2.2} />
        ) : (
          <ChevronDown color={colors.textMuted} size={20} strokeWidth={2.2} />
        )}
      </Pressable>

      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </Card>
  );
}

// ─── Ligne d'un jour ───────────────────────────────────────

function DayRow({
  salonId,
  dayKey,
  label,
  hours: rawHours,
}: {
  salonId: string;
  dayKey: keyof OpeningHours;
  label: string;
  hours: DayHours | undefined;
}) {
  const { t } = useT();
  // Filet de sécurité : si jamais un jour manque côté parent, on retombe sur
  // les horaires par défaut au lieu de crash sur `hours.open`.
  const hours: DayHours = rawHours ?? DEFAULT_OPENING_HOURS[dayKey];
  const [editing, setEditing] = useState(false);
  const [openDraft, setOpenDraft] = useState(hours.open ?? '09:00');
  const [closeDraft, setCloseDraft] = useState(hours.close ?? '19:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOpenDraft(hours.open ?? '09:00');
    setCloseDraft(hours.close ?? '19:00');
  }, [hours.open, hours.close]);

  const handleToggleClosed = async (closed: boolean) => {
    setSaving(true);
    try {
      if (closed) {
        await setSalonDayHours(salonId, dayKey, { closed: true });
      } else {
        await setSalonDayHours(salonId, dayKey, {
          closed: false,
          open: hours.open ?? '09:00',
          close: hours.close ?? '19:00',
        });
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHours = async () => {
    if (!TIME_REGEX.test(openDraft) || !TIME_REGEX.test(closeDraft)) {
      Alert.alert(t('common.error'), t('hours.invalidTime'));
      return;
    }
    if (openDraft >= closeDraft) {
      Alert.alert(t('common.error'), t('hours.openMustBeBeforeClose'));
      return;
    }
    setSaving(true);
    try {
      await setSalonDayHours(salonId, dayKey, {
        closed: false,
        open: openDraft,
        close: closeDraft,
      });
      setEditing(false);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.dayRow}>
      <View style={styles.dayLeft}>
        <Text style={styles.dayLabel}>{label}</Text>
        {hours.closed ? (
          <Text style={styles.closedLabel}>{t('hours.closed')}</Text>
        ) : editing ? null : (
          <Text style={styles.hoursValue}>{formatDayHours(hours)}</Text>
        )}
      </View>

      {hours.closed ? (
        <View style={styles.dayRight}>
          <Switch
            value={!hours.closed}
            onValueChange={(v) => handleToggleClosed(!v)}
            disabled={saving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      ) : editing ? (
        <View style={styles.editRow}>
          <TextInput
            value={openDraft}
            onChangeText={setOpenDraft}
            placeholder="09:00"
            placeholderTextColor={colors.textDim}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={styles.timeInput}
          />
          <Text style={styles.dash}>–</Text>
          <TextInput
            value={closeDraft}
            onChangeText={setCloseDraft}
            placeholder="19:00"
            placeholderTextColor={colors.textDim}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={styles.timeInput}
          />
          <Pressable
            onPress={handleSaveHours}
            disabled={saving}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>{t('common.save')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.dayRight}>
          <Pressable
            onPress={() => setEditing(true)}
            style={styles.editBtn}
            hitSlop={6}
          >
            <Pencil color={colors.primary} size={14} strokeWidth={2.2} />
            <Text style={styles.editBtnText}>{t('hours.editCta')}</Text>
          </Pressable>
          <Switch
            value={!hours.closed}
            onValueChange={(v) => handleToggleClosed(!v)}
            disabled={saving}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      )}
    </View>
  );
}

// ─── Fermetures ────────────────────────────────────────────

function ClosuresEditor({
  salonId,
  closures,
}: {
  salonId: string;
  closures: SalonClosure[];
}) {
  const { t } = useT();
  const [dateInput, setDateInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [adding, setAdding] = useState(false);

  const sortedClosures = useMemo(
    () => [...closures].sort((a, b) => a.date.localeCompare(b.date)),
    [closures],
  );

  const handleAdd = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      Alert.alert(t('common.error'), t('hours.invalidDate'));
      return;
    }
    const exists = closures.some((c) => c.date === dateInput);
    if (exists) {
      Alert.alert(t('common.error'), t('hours.closureExists'));
      return;
    }
    setAdding(true);
    try {
      await addSalonClosure(salonId, {
        date: dateInput,
        ...(reasonInput.trim() ? { reason: reasonInput.trim() } : {}),
      });
      setDateInput('');
      setReasonInput('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (closure: SalonClosure) => {
    try {
      await removeSalonClosure(salonId, closure);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  };

  return (
    <View>
      {sortedClosures.length === 0 ? (
        <Text style={styles.emptyText}>{t('hours.closuresEmpty')}</Text>
      ) : (
        <View style={styles.closuresList}>
          {sortedClosures.map((c) => (
            <View key={c.date} style={styles.closureRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.closureDate}>{c.date}</Text>
                {c.reason ? (
                  <Text style={styles.closureReason}>{c.reason}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => handleRemove(c)} hitSlop={10}>
                <X color={colors.danger} size={18} strokeWidth={2.2} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.addClosureBlock}>
        <Text style={styles.addClosureLabel}>{t('hours.addClosure')}</Text>
        <TextInput
          value={dateInput}
          onChangeText={setDateInput}
          placeholder="AAAA-MM-JJ"
          placeholderTextColor={colors.textDim}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          style={styles.closureInput}
        />
        <TextInput
          value={reasonInput}
          onChangeText={setReasonInput}
          placeholder={t('hours.reasonPlaceholder')}
          placeholderTextColor={colors.textDim}
          maxLength={60}
          style={styles.closureInput}
        />
        <Button
          label={t('hours.addClosureCta')}
          onPress={handleAdd}
          loading={adding}
          variant="secondary"
          disabled={!dateInput}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  collapsibleSummary: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  collapsibleBody: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  daysList: {
    gap: spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  dayLeft: {
    flex: 1,
  },
  dayLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  hoursValue: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  dayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  editBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  closedLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  timeInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    width: 70,
    textAlign: 'center',
  },
  dash: {
    color: colors.textMuted,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginLeft: 4,
  },
  saveBtnText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 12,
  },
  closuresList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  closureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  closureDate: {
    ...typography.bodyBold,
    color: colors.text,
  },
  closureReason: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyText: {
    ...typography.body,
    color: colors.textDim,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  addClosureBlock: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addClosureLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  closureInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
