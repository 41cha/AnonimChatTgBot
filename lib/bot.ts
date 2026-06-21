import { Bot } from "grammy";
import { handleStart } from "./handlers/start.js";
import { handleMessage } from "./handlers/message.js";
import { handleReplyCallback } from "./handlers/reply.js";

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
