import { webhookCallback } from "grammy";
import { bot } from "../lib/bot";

/**
 * Vercel serverless entry point.
 *
 * Telegram sends updates here as POST requests. The WEBHOOK_SECRET is verified
 * via the `X-Telegram-Bot-Api-Secret-Token` header by grammY's
 * webhookCallback under the hood.
 */
export default webhookCallback(bot, "express", {
  secretToken: process.env.WEBHOOK_SECRET,
});
