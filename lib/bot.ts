import { Bot } from "grammy";
import { handleStart } from "./handlers/start";
import { handleMessage } from "./handlers/message";
import { handleReplyCallback } from "./handlers/reply";
import { handleAdmin, handleAdminPagination } from "./handlers/admin";

// ---------------------------------------------------------------------------
// Bot instance
// ---------------------------------------------------------------------------

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is not set");
}

export const bot = new Bot(BOT_TOKEN);

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

// /admin (must be registered before /start or generic text handlers)
bot.command("admin", handleAdmin);

// Admin pagination callbacks
bot.on("callback_query:data").filter(
  (ctx) => ctx.callbackQuery.data.startsWith("adm_pg_"),
  handleAdminPagination
);

// /start and /start <owner_id>
bot.command("start", handleStart);

// Inline "Reply" button callbacks (callback_data = question ObjectId hex string)
bot.on("callback_query:data", handleReplyCallback);

// All text messages (anonymous questions + owner replies)
bot.on("message:text", handleMessage);

// Catch-all error handler
bot.catch((err) => {
  console.error("Bot error:", err);
});
