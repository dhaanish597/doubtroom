import { after } from "next/server";
import { apiError, apiJson } from "@/lib/api-response";
import { actorForNexconnUser } from "@/lib/auth/actor";
import { nexconnEnvSchema } from "@/lib/nexconn/config-env";
import { NexconnError } from "@/lib/nexconn/server";
import { sentMessages, taRequestFromMessage, verifyWebhookSignature, type SentMessage } from "@/lib/nexconn/webhook";
import { adminSupabase } from "@/lib/supabase/admin";
import { acceptTaRequest } from "@/lib/ta/accept";

export const maxDuration = 45;

/** Records a delivery in the webhook_events ledger. Returns false when this message was already seen. */
async function firstDelivery(message: SentMessage): Promise<boolean> {
  const { data, error } = await adminSupabase().from("webhook_events").upsert({
    msg_uid: message.messageId, channel_type: message.channelType, channel_id: message.channelId,
    from_user_id: message.userId, msg_type: message.messageType,
  }, { onConflict: "msg_uid", ignoreDuplicates: true }).select("msg_uid");
  if (error) {
    // reserve_ta_request still dedupes per message, so a ledger failure must not drop the TA answer.
    console.warn("Could not record webhook delivery", { code: error.code });
    return true;
  }
  return data.length > 0;
}

/** TA answers run one after another inside a 45 s function; the browser relay covers any beyond this cap. */
const MAX_TA_RUNS_PER_DELIVERY = 3;

async function handle(message: SentMessage, taBudget: { left: number }) {
  if (!await firstDelivery(message)) return;
  const body = taRequestFromMessage(message);
  if (!body || taBudget.left <= 0) return;
  taBudget.left -= 1;
  const actor = await actorForNexconnUser(message.userId);
  if (!actor) return;
  const accepted = await acceptTaRequest(actor, body);
  if (!accepted.ok) {
    console.info("Webhook TA request ignored", { code: accepted.code });
    return;
  }
  if (!accepted.duplicate) {
    console.info("TA triggered by webhook", { mode: body.mode });
    await accepted.run();
  }
}

// Nexconn message:send webhook (Console: Chat > Chat settings > Webhooks).
// Every sent message lands in webhook_events; doubts and @TA mentions trigger the TA.
// The browser relay (/api/ta/ask) remains as a fallback, and reserve_ta_request answers each message once.
export async function POST(request: Request) {
  const env = nexconnEnvSchema.safeParse(process.env);
  if (!env.success) return apiError(503, "NOT_CONFIGURED", "Webhook is not configured");
  if (!verifyWebhookSignature(request.headers, { appKey: env.data.NEXCONN_APP_KEY, appSecret: env.data.NEXCONN_APP_SECRET })) {
    return apiError(401, "UNAUTHORIZED", "Invalid webhook signature");
  }
  const messages = sentMessages(await request.json().catch(() => null));
  // Nexconn times out after 5 s, so acknowledge first and do the work after the response.
  if (messages.length) {
    after(async () => {
      const taBudget = { left: MAX_TA_RUNS_PER_DELIVERY };
      for (const message of messages) {
        try {
          await handle(message, taBudget);
        } catch (error) {
          console.error("Webhook message handling failed", { code: error instanceof NexconnError ? error.errorCode : undefined });
        }
      }
    });
  }
  return apiJson({ ok: true });
}
