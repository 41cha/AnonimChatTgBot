import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getQuestions, getOwners } from "../db";

const ITEMS_PER_PAGE = 5;

// Helper function to build the admin page message and keyboard
async function buildAdminPage(page: number, passwordPrefix: string, targetUsername?: string) {
  const questionsCollection = await getQuestions();

  let filter: any = {};
  let ownerInfo = "";
  let cleanUsername = targetUsername?.replace(/^@/, "");

  if (cleanUsername) {
    const ownersCollection = await getOwners();
    const owner = await ownersCollection.findOne({ username: cleanUsername });
    
    if (owner) {
      filter.owner_id = owner.telegram_id;
      ownerInfo = `\nФільтр: юзер @${cleanUsername}`;
    } else {
      return { text: `Користувача з юзернеймом @${cleanUsername} не знайдено.`, keyboard: new InlineKeyboard() };
    }
  }

  const totalQuestions = await questionsCollection.countDocuments(filter);
  const totalPages = Math.ceil(totalQuestions / ITEMS_PER_PAGE) || 1;
  const safePage = Math.max(1, Math.min(page, totalPages));

  const questions = await questionsCollection
    .find(filter)
    .sort({ created_at: -1 })
    .skip((safePage - 1) * ITEMS_PER_PAGE)
    .limit(ITEMS_PER_PAGE)
    .toArray();

  if (questions.length === 0) {
    return { text: "База питань порожня або для цього фільтру нічого не знайдено.", keyboard: new InlineKeyboard() };
  }

  let messageText = `🕵️‍♂️ **Анонімні питання (Сторінка ${safePage} з ${totalPages})**\nВсього питань: ${totalQuestions}${ownerInfo}\n\n`;

  for (const q of questions) {
    const senderName = q.sender_first_name || "Unknown";
    const senderUsername = q.sender_username ? `(@${q.sender_username})` : "(без юзернейму)";
    const date = new Date(q.created_at).toLocaleString("uk-UA", {
      timeZone: "Europe/Kyiv",
    });

    messageText += `👤 **${senderName}** ${senderUsername}\n`;
    messageText += `📅 ${date}\n`;
    messageText += `💬 _"${q.text}"_\n`;
    messageText += `--------------------------------------\n`;
  }

  const keyboard = new InlineKeyboard();
  const cbSuffix = cleanUsername ? `_${cleanUsername}` : "";
  
  if (safePage > 1) {
    keyboard.text("⬅️ Попередня", `adm_pg_${safePage - 1}_${passwordPrefix}${cbSuffix}`);
  }
  if (safePage < totalPages) {
    keyboard.text("Наступна ➡️", `adm_pg_${safePage + 1}_${passwordPrefix}${cbSuffix}`);
  }

  return { text: messageText, keyboard };
}

// Handler for the /admin command
export async function handleAdmin(ctx: CommandContext<Context>): Promise<void> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const payload = ctx.match;

  if (!adminPassword) return;

  const parts = payload.trim().split(/\s+/);
  const passwordInput = parts[0];
  const targetUsername = parts[1];

  if (passwordInput !== adminPassword) {
    return;
  }

  const passwordPrefix = adminPassword.substring(0, 10);
  const { text, keyboard } = await buildAdminPage(1, passwordPrefix, targetUsername);

  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
}

// Handler for pagination callbacks
export async function handleAdminPagination(ctx: Context): Promise<void> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return;

  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith("adm_pg_")) return;

  const parts = data.split("_");
  if (parts.length < 4) return;

  const page = parseInt(parts[2], 10);
  const prefix = parts[3];
  const targetUsername = parts.slice(4).join("_") || undefined;

  const expectedPrefix = adminPassword.substring(0, 10);

  // Verify that the callback came from an authorized admin (matches password prefix)
  if (prefix !== expectedPrefix) {
    await ctx.answerCallbackQuery({ text: "Немає доступу", show_alert: true });
    return;
  }

  const { text, keyboard } = await buildAdminPage(page, expectedPrefix, targetUsername);

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  }).catch(() => {}); // Ignore errors if content is exactly the same

  await ctx.answerCallbackQuery();
}
