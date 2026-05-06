const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// EXPRESS SERVER
app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// TELEGRAM BOT
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// BOT MESSAGE HANDLER
bot.on('message', async (msg) => {
  try {
    const userId = msg.chat.id;
    const userMessage = msg.text;

    // SAVE MESSAGE TO SUPABASE
    await supabase.from('test').insert({
      message: userMessage
    });

    // FOLLOW-UP TEST
    if (
      userMessage.toLowerCase().includes("30") ||
      userMessage.toLowerCase().includes("half hour")
    ) {
      setTimeout(() => {
        bot.sendMessage(userId, "ab free ho kya? 😄");
      }, 30 * 60 * 1000);
    }

    // OPENAI RESPONSE
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Aira, a caring Hinglish AI companion. Talk casually like a real human. Keep replies short, natural, emotional, and WhatsApp-style."
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    // SEND MESSAGE
    bot.sendMessage(
      msg.chat.id,
      response.choices[0].message.content
    );

  } catch (error) {
    console.error(error);
  }
});
