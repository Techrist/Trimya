"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  MessageCircle,
  Inbox,
  Clock,
  Activity,
} from "lucide-react";
import { db } from "@/lib/firebase-client";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { KpiCard } from "@/components/KpiCard";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Conversation, Message, Salon, Period } from "@/lib/types";
import { periodSinceMs } from "@/lib/types";

/**
 * Average salon response time:
 * For each conversation, we walk the messages in chronological order
 * and compute the delay between a customer message and the next salon
 * reply (if any). The page-wide metric is the mean of all those delays.
 */
function computeAvgResponseMs(messagesByConv: Map<string, Message[]>): {
  avgMs: number | null;
  sampleCount: number;
} {
  const deltas: number[] = [];
  for (const list of messagesByConv.values()) {
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    let waitingFor: number | null = null;
    for (const m of sorted) {
      if (m.senderRole === "customer") {
        if (waitingFor === null) waitingFor = m.createdAt;
      } else if (m.senderRole === "salon" && waitingFor !== null) {
        deltas.push(m.createdAt - waitingFor);
        waitingFor = null;
      }
    }
  }
  if (deltas.length === 0) return { avgMs: null, sampleCount: 0 };
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return { avgMs: avg, sampleCount: deltas.length };
}

function humanDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)} h`;
  return `${(ms / 86_400_000).toFixed(1)} j`;
}

export default function MessagingAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [salonFilter, setSalonFilter] = useState<string>("");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [conversations, setConversations] = useState<Conversation[] | null>(
    null,
  );
  const [messagesByConv, setMessagesByConv] = useState<Map<
    string,
    Message[]
  > | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "salons"), (snap) => {
      setSalons(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Salon)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setConversations(null);
    setMessagesByConv(null);

    const since = periodSinceMs(period);
    const convoConstraints = [];
    if (salonFilter) convoConstraints.push(where("salonId", "==", salonFilter));

    (async () => {
      // 1) Conversations within filter
      const convoSnap = await getDocs(
        query(collection(db, "conversations"), ...convoConstraints),
      );
      const allConvos = convoSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Conversation,
      );
      const relevant =
        since > 0
          ? allConvos.filter((c) => c.lastMessageAt >= since)
          : allConvos;
      if (cancelled) return;
      setConversations(relevant);

      // 2) Messages for those conversations
      // Firestore "in" supports up to 30 values per query, so we batch
      const ids = relevant.map((c) => c.id);
      const messages: Message[] = [];
      for (let i = 0; i < ids.length; i += 30) {
        const chunk = ids.slice(i, i + 30);
        if (chunk.length === 0) continue;
        const messagesConstraints = [
          where("conversationId", "in", chunk),
          ...(since > 0 ? [where("createdAt", ">=", since)] : []),
        ];
        const msgSnap = await getDocs(
          query(collection(db, "messages"), ...messagesConstraints),
        );
        for (const d of msgSnap.docs)
          messages.push({ id: d.id, ...d.data() } as Message);
      }
      if (cancelled) return;
      const byConv = new Map<string, Message[]>();
      for (const m of messages) {
        const arr = byConv.get(m.conversationId) ?? [];
        arr.push(m);
        byConv.set(m.conversationId, arr);
      }
      setMessagesByConv(byConv);
    })();
    return () => {
      cancelled = true;
    };
  }, [period, salonFilter]);

  const salonNameById = useMemo(
    () => new Map(salons.map((s) => [s.id, s.name] as const)),
    [salons],
  );

  const stats = useMemo(() => {
    if (!conversations || !messagesByConv) return null;
    const totalConvos = conversations.length;
    const totalMessages = Array.from(messagesByConv.values()).reduce(
      (a, list) => a + list.length,
      0,
    );
    const { avgMs, sampleCount } = computeAvgResponseMs(messagesByConv);
    const unanswered = conversations.filter(
      (c) => c.unreadBySalon > 0 && c.lastSenderRole === "customer",
    ).length;
    return { totalConvos, totalMessages, avgMs, sampleCount, unanswered };
  }, [conversations, messagesByConv]);

  // Top salons by message volume
  const topSalons = useMemo(() => {
    if (!conversations || !messagesByConv) return [];
    const m = new Map<string, number>();
    for (const c of conversations) {
      const count = messagesByConv.get(c.id)?.length ?? 0;
      m.set(c.salonId, (m.get(c.salonId) ?? 0) + count);
    }
    return Array.from(m.entries())
      .map(([salonId, count]) => ({
        salonId,
        salonName: salonNameById.get(salonId) ?? salonId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [conversations, messagesByConv, salonNameById]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Messagerie</h1>
          <p className="mt-1 text-sm text-text-muted">
            Volume des conversations et temps de réponse des salons
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </header>

      <div className="min-w-[200px] max-w-sm">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
          Salon
        </label>
        <select
          value={salonFilter}
          onChange={(e) => setSalonFilter(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tous les salons</option>
          {salons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.city}
            </option>
          ))}
        </select>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Conversations actives"
          value={stats ? formatNumber(stats.totalConvos) : "—"}
          icon={MessageCircle}
          tone="primary"
        />
        <KpiCard
          label="Messages échangés"
          value={stats ? formatNumber(stats.totalMessages) : "—"}
          icon={Inbox}
          tone="accent"
        />
        <KpiCard
          label="Temps de réponse moyen"
          value={
            stats
              ? stats.avgMs !== null
                ? humanDuration(stats.avgMs)
                : "—"
              : "—"
          }
          hint={
            stats && stats.sampleCount > 0
              ? `Sur ${formatNumber(stats.sampleCount)} échanges`
              : "Pas assez de données"
          }
          icon={Clock}
          tone="success"
        />
        <KpiCard
          label="Sans réponse"
          value={stats ? formatNumber(stats.unanswered) : "—"}
          hint="Conv. où le salon n'a pas répondu"
          icon={Activity}
          tone="neutral"
        />
      </section>

      <Card>
        <CardTitle>Top salons par volume de messages</CardTitle>
        <CardDescription>Sur la période sélectionnée</CardDescription>
        <div className="mt-4 divide-y divide-border">
          {topSalons.length === 0 ? (
            <p className="py-4 text-sm text-text-muted">
              Aucune conversation sur cette période.
            </p>
          ) : null}
          {topSalons.map((s, i) => (
            <div
              key={s.salonId}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-text-muted">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{s.salonName}</span>
              </div>
              <span className="text-sm font-semibold text-primary">
                {formatNumber(s.count)} message{s.count > 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Conversations actives</CardTitle>
        <CardDescription>
          {conversations === null
            ? "Chargement…"
            : conversations.length === 0
              ? "Aucune"
              : `${conversations.length} au total — 50 plus récentes`}
        </CardDescription>

        {conversations === null ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-surface-elevated"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? null : (
          <div className="mt-4 divide-y divide-border">
            {[...conversations]
              .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
              .slice(0, 50)
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {c.customerName}
                      <span className="text-xs font-normal text-text-dim">
                        · {salonNameById.get(c.salonId) ?? c.salonId}
                      </span>
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-text-muted">
                      {c.lastMessage}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-text-dim">
                      {formatDateTime(c.lastMessageAt)}
                    </div>
                    {c.unreadBySalon > 0 ? (
                      <span className="mt-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {c.unreadBySalon} non lu{c.unreadBySalon > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}
