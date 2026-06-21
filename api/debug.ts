export default function (req: any, res: any) {
  res.status(200).send(`
    BOT_TOKEN: ${!!process.env.BOT_TOKEN}
    MONGODB_URI: ${!!process.env.MONGODB_URI}
    WEBHOOK_SECRET: ${!!process.env.WEBHOOK_SECRET}
  `);
}
