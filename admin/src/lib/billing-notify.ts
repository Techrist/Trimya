import "server-only";
import { adminDb } from "./firebase-admin";
import { sendBrevoEmail } from "./brevo";
import { filterExpoTokens, sendPushBatch } from "./expo-push";
import { formatPrice } from "./site-plans";
import { PLANS, type PlanId } from "./plans";

/**
 * Notifications de facturation (best-effort : n'échouent jamais le flux de
 * paiement, l'appelant attrape et logue).
 *  - reçu après activation : email (owner) ou push (kiosque salon)
 *  - rappel avant expiration : mêmes canaux
 */

const dateFr = (ms: number) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(ms));

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function emailShell(title: string, lines: string[]): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:#0b0b0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f4f4f5;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
<div style="text-align:center;margin-bottom:32px;"><img src="https://www.trimya.app/email/logo.png" width="80" height="80" alt="Trimya" style="display:inline-block;border:0;" /></div>
<h1 style="font-size:22px;font-weight:700;margin:0 0 16px;">${esc(title)}</h1>
${lines.map((l) => `<p style="font-size:15px;line-height:1.5;color:#a1a1aa;margin:0 0 12px;">${esc(l)}</p>`).join("\n")}
</div></body></html>`;
  return { html, text: `${title}\n\n${lines.join("\n")}` };
}

/** Reçu envoyé après une activation réussie. */
export async function sendPaymentReceipt(paymentId: string): Promise<void> {
  const paySnap = await adminDb.collection("payments").doc(paymentId).get();
  if (!paySnap.exists) return;
  const pay = paySnap.data()!;
  const plan = PLANS[pay.planId as PlanId];
  const expiresAt = Number(pay.resultingExpiresAt) || 0;
  const title = `Plan ${plan.label} activé`;
  const lines = [
    `Ton paiement de ${formatPrice(pay.amount as number)} est bien reçu.`,
    `Ton plan ${plan.label} est actif jusqu'au ${dateFr(expiresAt)}.`,
    `Référence : ${paymentId}`,
  ];

  if (pay.targetType === "owner") {
    const owner = await adminDb.collection("owners").doc(pay.targetId as string).get();
    const email = owner.data()?.email;
    if (typeof email === "string" && email.includes("@")) {
      const { html, text } = emailShell(title, lines);
      await sendBrevoEmail({
        to: email,
        subject: `Trimya — ${title}`,
        htmlContent: html,
        textContent: text,
        tags: ["billing-receipt"],
      });
    }
    return;
  }

  const salon = await adminDb.collection("salons").doc(pay.targetId as string).get();
  const tokens = filterExpoTokens([salon.data()?.kioskPushToken]);
  if (tokens.length) {
    await sendPushBatch(tokens, title, `Actif jusqu'au ${dateFr(expiresAt)}.`, {
      type: "billing",
    });
  }
}

/** Rappel d'expiration (J-3). */
export async function sendExpiryReminder(input: {
  targetType: "salon" | "owner";
  targetId: string;
  planLabel: string;
  expiresAt: number;
}): Promise<void> {
  const title = `Ton plan ${input.planLabel} expire bientôt`;
  const body = `Il expire le ${dateFr(input.expiresAt)}. Renouvelle-le depuis l'app pour garder tes fonctionnalités.`;

  if (input.targetType === "owner") {
    const owner = await adminDb.collection("owners").doc(input.targetId).get();
    const email = owner.data()?.email;
    if (typeof email === "string" && email.includes("@")) {
      const { html, text } = emailShell(title, [body]);
      await sendBrevoEmail({
        to: email,
        subject: `Trimya — ${title}`,
        htmlContent: html,
        textContent: text,
        tags: ["billing-reminder"],
      });
    }
    return;
  }
  const salon = await adminDb.collection("salons").doc(input.targetId).get();
  const tokens = filterExpoTokens([salon.data()?.kioskPushToken]);
  if (tokens.length) {
    await sendPushBatch(tokens, title, body, { type: "billing" });
  }
}
