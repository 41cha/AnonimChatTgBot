import { webhookCallback } from "grammy";
import { bot } from "../lib/bot";

/**
 * Vercel serverless entry point.
 *
 * Telegram sends updates here as POST requests. The WEBHOOK_SECRET is verified
 * via the `X-Telegram-Bot-Api-Secret-Token` header by grammY's
 * webhookCallback under the hood.
 */
const handler = webhookCallback(bot, "express", {
  secretToken: process.env.WEBHOOK_SECRET,
});

export default async function (req: any, res: any) {
  try {
    await handler(req, res);
  } catch (error: any) {
    console.error("Webhook error:", error);
    res.status(500).send({ error: error.message, stack: error.stack });
  }
}
