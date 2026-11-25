import "server-only";

/**
 * Client Brevo (ex-Sendinblue) pour l'envoi d'emails transactionnels.
 *
 * Plan gratuit : 300 emails/jour. Largement suffisant pour les OTP.
 *
 * Clés attendues dans les env vars Vercel (server-side uniquement) :
 *   BREVO_API_KEY          — clé API Brevo (xkeysib-...)
 *   BREVO_SENDER_EMAIL     — adresse expéditeur VÉRIFIÉE dans Brevo
 *   BREVO_SENDER_NAME      — nom affiché (ex: "Trimya")
 *
 * Toujours vérifier qu'un sender est validé côté Brevo (Senders & IP →
 * Senders) sinon l'API renverra 400 avec "sender email is not authorized".
 */

interface BrevoSendParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  // Entêtes optionnelles — utile pour tracking / groupage
  tags?: string[];
}

export interface BrevoSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Envoie un email transactionnel via Brevo. Ne throw jamais — renvoie
 * un résultat typé pour laisser le caller décider du comportement
 * (retry, log, afficher une erreur générique au client).
 */
export async function sendBrevoEmail(
  params: BrevoSendParams,
): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Trimya";

  if (!apiKey || !senderEmail) {
    return {
      ok: false,
      error:
        "BREVO_API_KEY or BREVO_SENDER_EMAIL missing. Configure in Vercel env.",
    };
  }

  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: params.to }],
    subject: params.subject,
    htmlContent: params.htmlContent,
    textContent: params.textContent,
    tags: params.tags,
  };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Brevo renvoie du JSON détaillé ; on log mais on expose un message
      // générique au caller (qui lui-même expose un message safe à l'user).
      const body = await res.text().catch(() => "");
      console.error("[brevo] send failed", res.status, body);
      return { ok: false, error: `brevo_http_${res.status}` };
    }

    const data = (await res.json()) as { messageId?: string };
    return { ok: true, messageId: data.messageId };
  } catch (e) {
    console.error("[brevo] network error", e);
    return { ok: false, error: "network_error" };
  }
}

/**
 * Logo affiché en tête de l'email. Un email ne peut pas embarquer une image
 * locale ni un data-URI (bloqués par Gmail et Outlook) : l'image doit être
 * servie par une URL publique en HTTPS. Le fichier vit dans
 * `admin/public/email/logo.png` (160x160, ~12 Ko, affiché à 80 px pour les
 * écrans haute densité) et est donc servi par le site vitrine.
 */
const EMAIL_LOGO_URL = "https://www.trimya.app/email/logo.png";

/**
 * Template email OTP — HTML sobre, lisible même sans CSS externe.
 * On garde le branding minimal : logo, titre, code en gros, note de sécurité.
 */
export function renderOtpEmail(params: {
  code: string;
  expiresInMinutes: number;
}): { html: string; text: string } {
  const safeCode = params.code.replace(/[^0-9]/g, "");
  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#0b0b0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f4f4f5;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:32px;">
        <img src="${EMAIL_LOGO_URL}" width="80" height="80" alt="Trimya" style="display:inline-block;width:80px;height:80px;border:0;outline:none;text-decoration:none;" />
      </div>
      <h1 style="font-size:24px;font-weight:700;margin:0 0 12px;color:#f4f4f5;">Ton code Trimya</h1>
      <p style="font-size:15px;line-height:1.5;color:#a1a1aa;margin:0 0 32px;">
        Entre ce code dans l'app pour te connecter. Il est valable ${params.expiresInMinutes} minutes.
      </p>
      <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#FF5722;font-family:ui-monospace,'SF Mono',Menlo,monospace;">${safeCode}</div>
      </div>
      <p style="font-size:13px;line-height:1.5;color:#71717a;margin:0 0 8px;">
        Tu n'as pas demandé ce code ? Ignore cet email, ton compte reste sécurisé.
      </p>
      <p style="font-size:13px;line-height:1.5;color:#71717a;margin:0;">
        Trimya ne te demandera jamais ce code par téléphone ou SMS.
      </p>
    </div>
  </body>
</html>`;

  const text = `Ton code Trimya : ${safeCode}

Entre ce code dans l'app pour te connecter. Il est valable ${params.expiresInMinutes} minutes.

Tu n'as pas demandé ce code ? Ignore cet email.
Trimya ne te demandera jamais ce code par téléphone ou SMS.`;

  return { html, text };
}
