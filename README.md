# AnonBot — Multi-Owner Anonymous Q&A Telegram Bot

A serverless Telegram bot that lets **any user** become a question owner. Owners get a personal shareable link — friends open it and send anonymous questions through the bot.

## How It Works

1. **Any user** sends `/start` → registers as an owner, receives their shareable link
2. **Owner** shares `https://t.me/<bot_username>?start=<owner_id>` with friends
3. **Friend** opens the link → prompted to type an anonymous question
4. **Question** is saved in MongoDB and forwarded to the owner with **zero identifying info**
5. **Owner** taps the **Reply** button → types their reply → it's sent back to the anonymous sender

## Tech Stack

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Bot        | [grammY](https://grammy.dev)      |
| Database   | MongoDB (Atlas Free Tier M0)      |
| Hosting    | Vercel (serverless, webhook mode) |
| Language   | TypeScript                        |

## Project Structure

```
api/
  webhook.ts          ← Vercel serverless entry point
lib/
  bot.ts              ← Bot instance + handler registration
  db.ts               ← MongoDB connection (cached for warm starts)
  handlers/
    start.ts          ← /start and /start <owner_id>
    message.ts        ← Anonymous questions + routing
    reply.ts          ← Reply button callback + answer delivery
```

## Setup

### 1. Prerequisites

- Node.js 18+
- A [Telegram Bot Token](https://core.telegram.org/bots#botfather) from @BotFather
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (Free Tier M0 works fine)
- A [Vercel](https://vercel.com) account

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example env file:

```bash
cp .env.example .env
```

Fill in the values:

| Variable         | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `BOT_TOKEN`      | Telegram bot token from @BotFather                                          |
| `MONGODB_URI`    | MongoDB Atlas connection string (e.g. `mongodb+srv://user:pass@cluster...`) |
| `WEBHOOK_SECRET` | Any random string for webhook verification (e.g. `openssl rand -hex 32`)   |

### 4. Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Deploy (follow prompts to link your project)
vercel

# Set environment variables in Vercel
vercel env add BOT_TOKEN
vercel env add MONGODB_URI
vercel env add WEBHOOK_SECRET

# Redeploy with env vars
vercel --prod
```

### 5. Set the Webhook

After deploying, run this **once** to tell Telegram where to send updates:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<your-project>.vercel.app/api/webhook",
    "secret_token": "<YOUR_WEBHOOK_SECRET>"
  }'
```

Replace:
- `<YOUR_BOT_TOKEN>` with your actual bot token
- `<your-project>` with your Vercel project domain
- `<YOUR_WEBHOOK_SECRET>` with the same secret you set in env vars

You should get a response like:

```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

### 6. Verify

To confirm the webhook is set:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

## Testing the Flow

1. Open your bot in Telegram and send `/start`
2. Copy the shareable link the bot gives you
3. Open the link in a **different** Telegram account (or ask a friend)
4. Type a question when prompted
5. Check that the owner receives it with a **Reply** button
6. Owner taps Reply, types an answer
7. The anonymous sender receives the reply

## Security & Anonymity

- The anonymous sender's **name, username, and chat_id are never exposed** to the owner
- The Reply button's `callback_data` contains **only** the question's database `_id`
- Invalid owner links are rejected with a generic "This link is invalid" message
- Webhook requests are verified via Telegram's `X-Telegram-Bot-Api-Secret-Token` header
- Reply sessions auto-expire after **10 minutes** (MongoDB TTL index)
- Pending question markers auto-expire after **5 minutes** (MongoDB TTL index)

## Design Decisions

| Decision | Rationale |
| --- | --- |
| `pending_questions` collection | Serverless functions are stateless — `/start <owner_id>` and the next text message are separate invocations. An in-memory map doesn't survive, so we persist a short-lived marker in MongoDB with a 5-minute TTL. |
| No Mongoose | Spec requirement — the `mongodb` driver is lighter for simple collections. |
| `std/http` adapter | grammY's `webhookCallback("std/http")` is compatible with Vercel's serverless runtime (Web Standards Request/Response). |
| `maxDuration: 10` | MongoDB Atlas Free Tier cold starts can be slow. 10 seconds gives enough headroom while keeping Telegram happy. |

## License

MIT
