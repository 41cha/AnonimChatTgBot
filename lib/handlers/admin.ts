import { CommandContext, Context } from "grammy";
import { getQuestions } from "../db";

export async function handleAdmin(ctx: CommandContext<Context>): Promise<void> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const payload = ctx.match; // The text after /admin (e.g. "/admin mypassword" -> payload is "mypassword")

  if (!adminPassword || payload !== adminPassword) {
    // Silently ignore if password doesn't match
    return;
  }

  const questionsCollection = await getQuestions();

  // Fetch the last 10 questions sorted by created_at descending
  const recentQuestions = await questionsCollection
    .find({})
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();

  if (recentQuestions.length === 0) {
    await ctx.reply("База питань порожня.");
    return;
  }

  let messageText = "🕵️‍♂️ **Останні 10 анонімних питань:**\n\n";

  for (const q of recentQuestions) {
    const senderName = q.sender_first_name || "Unknown";
    const senderUsername = q.sender_username ? `(@${q.sender_username})` : "(без юзернейму)";
    const date = new Date(q.created_at).toLocaleString("uk-UA");

    messageText += `👤 **${senderName}** ${senderUsername}\n`;
    messageText += `📅 ${date}\n`;
    messageText += `💬 _"${q.text}"_\n`;
    messageText += `--------------------------------------\n`;
  }

  await ctx.reply(messageText, { parse_mode: "Markdown" });
}
