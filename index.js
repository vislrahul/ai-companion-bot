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
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    autoStart: false
  }
});

bot.startPolling({
  restart: true
});

// OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// BOT MESSAGE HANDLER
bot.on('message', async (msg) => {
  try {
    const userId = String(msg.chat.id);
    const userMessage = msg.text;

    console.log("MESSAGE RECEIVED:", userMessage);

    // SAVE USER MESSAGE TO SUPABASE
    const { error: saveError } = await supabase
      .from('test')
      .insert([
        {
          user_id: userId,
          role: 'user',
          content: userMessage
        }
      ]);

    if (saveError) {
      console.log("SUPABASE SAVE ERROR:", saveError);
    }

    // GET OLD MEMORY
    const { data: memoryData, error: memoryError } = await supabase
      .from('test')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (memoryError) {
      console.log("MEMORY FETCH ERROR:", memoryError);
    }

    // FORMAT MEMORY
    let messages = [
      {
        role: "system",
        content:
          "You are Aira, a caring Hinglish AI companion. Talk casually like a real human. Keep replies short, emotional, natural, and WhatsApp-style."
      }
    ];

    if (memoryData) {
      memoryData.reverse().forEach((item) => {
        messages.push({
          role: item.role,
          content: item.content
        });
      });
    }

    // ADD CURRENT MESSAGE
    messages.push({
      role: "user",
      content: userMessage
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
      messages: messages
    });

    const aiReply = response.choices[0].message.content;

    // SAVE AI REPLY
    await supabase
      .from('test')
      .insert([
        {
          user_id: userId,
          role: 'assistant',
          content: aiReply
        }
      ]);

    // SEND REPLY
    bot.sendMessage(userId, aiReply);

  } catch (error) {
    console.error("MAIN ERROR:", error);
  }
});
