import "server-only";

/**
 * Server-side helper to send notifications via the Expo Push API.
 *
 * The mobile app registers ExponentPushTokens, which can only be delivered
 * through https://exp.host/--/api/v2/push/send — Firebase FCM credentials
 * are NOT used here (they're used by Expo behind the scenes).
 *
 * Expo accepts up to 100 messages per request.
 */

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

export interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface SendResult {
  delivered: number;
  failed: number;
  errors: string[];
}

/**
 * Filters tokens to keep only valid-looking Expo push tokens.
 */
export function filterExpoTokens(tokens: (string | undefined | null)[]): string[] {
  return tokens
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .filter((t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
}

export async function sendPushBatch(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<SendResult> {
  const valid = filterExpoTokens(tokens);
  if (valid.length === 0) {
    return { delivered: 0, failed: 0, errors: [] };
  }

  const result: SendResult = { delivered: 0, failed: 0, errors: [] };

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const chunk = valid.slice(i, i + BATCH_SIZE);
    const messages: ExpoMessage[] = chunk.map((to) => ({
      to,
      title,
      body,
      data,
      sound: "default",
      priority: "high",
      channelId: "default",
    }));

    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        result.failed += chunk.length;
        result.errors.push(`HTTP ${res.status}`);
        continue;
      }

      const json = (await res.json()) as { data: ExpoTicket[] };
      const tickets = Array.isArray(json.data) ? json.data : [];
      for (const t of tickets) {
        if (t.status === "ok") result.delivered += 1;
        else {
          result.failed += 1;
          if (t.message && !result.errors.includes(t.message)) {
            result.errors.push(t.message);
          }
        }
      }
      // If response had fewer tickets than tokens, count the missing as failed
      if (tickets.length < chunk.length) {
        result.failed += chunk.length - tickets.length;
      }
    } catch (e) {
      result.failed += chunk.length;
      result.errors.push(e instanceof Error ? e.message : "network_error");
    }
  }

  return result;
}
