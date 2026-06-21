import { Context, InlineKeyboard } from "grammy";
import { getQuestions, getPendingQuestions } from "../db";
import { handleReplyText } from "./reply";

/**
 * Handles all incoming text messages.
 *
 * Routing priority:
 *  1. Owner replying to a question (active reply_session) → delegate to reply handler
 *  2. Anonymous user sending a question (active pending_question) → save & forward
 *  3. Otherwise → show help
 */
export async function handleMessage(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;

  if (!chatId || !text) return;

  // 1. Check if this user is an owner replying to a question
  const handled = await handleReplyText(ctx);
  if (handled) return;

  // 2. Check if this user has a pending anonymous question target
  const pending = await getPendingQuestions();
  const pendingDoc = await pending.findOne({ anon_chat_id: chatId });

  if (pendingDoc) {
    // Save the anonymous question
    const questions = await getQuestions();
    const result = await questions.insertOne({
      owner_id: pendingDoc.target_owner_id,
      anon_chat_id: chatId,
      text: text,
      answered: false,
      created_at: new Date(),
      answered_at: null,
    });

    // Build inline keyboard with Reply button (callback_data = question _id only)
    const keyboard = new InlineKeyboard().text(
      "💬 Reply",
      result.insertedId.toHexString()
    );

    // Forward the question to the owner — ZERO identifying info about the sender
    try {
      await ctx.api.sendMessage(
        pendingDoc.target_owner_id,
        `📩 *New anonymous question:*\n\n${escapeMarkdown(text)}`,
        {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        }
      );
    } catch {
      // Owner may have blocked the bot
      await ctx.reply(
        "⚠️ Could not deliver your question — the recipient may have blocked the bot."
      );
      await pending.deleteOne({ _id: pendingDoc._id });
      return;
    }

    // Clean up the pending marker
    await pending.deleteOne({ _id: pendingDoc._id });

    await ctx.reply("Your question was sent anonymously ✅");
    return;
  }

  // 3. No active context — show help
  await ctx.reply(
    "👋 Hi! Here's how to use this bot:\n\n" +
      "• Send /start to register and get your shareable link\n" +
      "• Open someone's link to send them an anonymous question\n" +
      "• Tap the Reply button under a question to respond"
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
