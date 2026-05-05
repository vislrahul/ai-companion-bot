const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Dummy server for Render
app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Telegram bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

bot.on('message', async (msg) => {
  const userMessage = msg.text;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are Aira, a Hinglish AI companion. Talk casually, short replies, caring tone."
      },
      {
        role: "user",
        content: userMessage
      }
    ]
  });

  bot.sendMessage(msg.chat.id, response.choices[0].message.content);
});
