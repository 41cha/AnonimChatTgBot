import { Context } from "grammy";
import { ObjectId } from "mongodb";
import {
  getQuestions,
  getReplySessions,
  getPendingQuestions,
  Question,
} from "../db";

/**
 * Handles the "Reply" inline button callback.
 *
 * callback_data contains ONLY the question _id (as a hex string) — no sender
 * information is ever exposed to the owner.
 */
export async function handleReplyCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Validate ObjectId format
  let questionId: ObjectId;
  try {
    questionId = new ObjectId(data);
  } catch {
    await ctx.answerCallbackQuery({ text: "Invalid question reference." });
    return;
  }

  // Verify the question exists and belongs to this owner
  const questions = await getQuestions();
  const question = await questions.findOne({
    _id: questionId,
    owner_id: chatId,
  });

  if (!question) {
    await ctx.answerCallbackQuery({ text: "Question not found." });
    return;
  }

  if (question.answered) {
    await ctx.answerCallbackQuery({
      text: "You already replied to this question.",
    });
    return;
  }

  // Upsert a reply session for this owner
  const sessions = await getReplySessions();
  await sessions.updateOne(
    { owner_id: chatId },
    {
      $set: {
        owner_id: chatId,
        pending_question_id: questionId,
        created_at: new Date(), // reset TTL
      },
    },
    { upsert: true }
  );

  await ctx.answerCallbackQuery();
  await ctx.reply("✏️ Type your reply:");
}

/**
 * Handles an owner's text reply to an anonymous question.
 *
 * Called from the message handler when the sender has an active reply_session.
 *
 * @returns `true` if the message was handled as a reply, `false` otherwise.
 */
export async function handleReplyText(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  if (!chatId || !ctx.message?.text) return false;

  const sessions = await getReplySessions();
  const session = await sessions.findOne({ owner_id: chatId });

  if (!session) return false;

  // Fetch the original question to get anon_chat_id
  const questions = await getQuestions();
  const question = await questions.findOne({
    _id: session.pending_question_id,
  });

  if (!question) {
    await sessions.deleteOne({ owner_id: chatId });
    await ctx.reply("⚠️ Could not find the original question. Session cleared.");
    return true;
  }

  // Send the reply to the anonymous sender
  try {
    await ctx.api.sendMessage(
      question.anon_chat_id,
      `💬 You received a reply to your question:\n\n` +
        `❓ *Your question:*\n${escapeMarkdown(question.text)}\n\n` +
        `💬 *Reply:*\n${escapeMarkdown(ctx.message.text)}`,
      { parse_mode: "MarkdownV2" }
    );
  } catch {
    // The anonymous sender may have blocked the bot
    await ctx.reply(
      "⚠️ Could not deliver your reply — the sender may have blocked the bot."
    );
    await sessions.deleteOne({ owner_id: chatId });
    return true;
  }

  // Mark question as answered
  await questions.updateOne(
    { _id: question._id },
    { $set: { answered: true, answered_at: new Date() } }
  );

  // Clean up the session
  await sessions.deleteOne({ owner_id: chatId });

  await ctx.reply("✅ Your reply has been sent!");
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes special characters for Telegram MarkdownV2.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
