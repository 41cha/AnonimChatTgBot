import { CommandContext, Context } from "grammy";
import { getOwners, getPendingQuestions } from "../db.js";

/**
 * Handles both `/start` (register as owner) and `/start <owner_id>` (begin
 * asking an anonymous question).
 */
export async function handleStart(ctx: CommandContext<Context>): Promise<void> {
  const payload = ctx.match; // text after "/start " (deep-link parameter)
  const chatId = ctx.chat.id;

  if (!payload) {
    // -----------------------------------------------------------------------
    // /start with no params → register as owner
    // -----------------------------------------------------------------------
    const owners = await getOwners();

    await owners.updateOne(
      { telegram_id: chatId },
      {
        $setOnInsert: {
          telegram_id: chatId,
          username: ctx.from?.username ?? null,
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    const botUsername = ctx.me.username;
    const shareableLink = `https://t.me/${botUsername}?start=${chatId}`;

    await ctx.reply(
      `👋 Welcome! You're registered as a question owner.\n\n` +
        `Share this link with friends so they can send you anonymous questions:\n\n` +
        `🔗 ${shareableLink}`,
      { parse_mode: undefined }
    );

    return;
  }

  // -------------------------------------------------------------------------
  // /start <owner_id> → begin anonymous question flow
  // -------------------------------------------------------------------------
  const targetOwnerId = Number(payload);

  if (Number.isNaN(targetOwnerId)) {
    await ctx.reply("❌ This link is invalid.");
    return;
  }

  // Don't let owners ask themselves questions
  if (targetOwnerId === chatId) {
    await ctx.reply(
      "🙃 You can't send yourself an anonymous question!\n\n" +
        "Share your link with friends instead."
    );
    return;
  }

  // Validate that owner_id exists
  const owners = await getOwners();
  const owner = await owners.findOne({ telegram_id: targetOwnerId });

  if (!owner) {
    await ctx.reply("❌ This link is invalid.");
    return;
  }

  // Mark this anon user as "about to ask a question to targetOwnerId"
  const pending = await getPendingQuestions();
  await pending.updateOne(
    { anon_chat_id: chatId },
    {
      $set: {
        anon_chat_id: chatId,
        target_owner_id: targetOwnerId,
        created_at: new Date(),
      },
    },
    { upsert: true }
  );

  await ctx.reply("✍️ Type your anonymous question below:");
}
