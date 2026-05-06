const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(express.json({
  limit: '10mb'
}));

app.use(express.urlencoded({
  extended: true
}));

const PORT = process.env.PORT || 3000;

// =======================
// SUPABASE
// =======================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// =======================
// OPENAI
// =======================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =======================
// TELEGRAM BOT
// =======================

const bot = new TelegramBot(
  process.env.BOT_TOKEN
);

// =======================
// WEBHOOK
// =======================

const webhookUrl =
  `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.BOT_TOKEN}`;

bot.deleteWebHook()
  .then(() => {
    return bot.setWebHook(webhookUrl);
  })
  .then(() => {
    console.log("Webhook set successfully");
  })
  .catch((err) => {
    console.log("WEBHOOK ERROR:", err);
  });

// =======================
// TELEGRAM WEBHOOK ROUTE
// =======================

app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {

  try {

    if (req.body) {
      bot.processUpdate(req.body);
    }

    res.sendStatus(200);

  } catch (error) {

    console.log("WEBHOOK PROCESS ERROR:", error);

    res.sendStatus(200);

  }

});

// =======================
// TEST ROUTE
// =======================

app.get('/', (req, res) => {
  res.send('Bot is running');
});

// =======================
// BOT MESSAGE HANDLER
// =======================

bot.on('message', async (msg) => {

  try {

    if (!msg.text) return;

    const userId = String(msg.chat.id);
    const userMessage = msg.text;

    console.log("MESSAGE RECEIVED:", userMessage);

    // =======================
    // SAVE USER MESSAGE
    // =======================

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

    // =======================
    // FETCH MEMORY
    // =======================

    const {
      data: memoryData,
      error: memoryError
    } = await supabase
      .from('test')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', {
        ascending: true
      })
      .limit(10);

    if (memoryError) {
      console.log("MEMORY FETCH ERROR:", memoryError);
    }

    // =======================
    // SYSTEM PROMPT
    // =======================

    let messages = [
      {
        role: "system",
        content:
          "You are Aira, a caring Hinglish AI companion. Talk casually like a real human friend. Keep replies short, emotional, natural, cute, and WhatsApp-style. Understand emotions properly."
      }
    ];

    // =======================
    // ADD OLD MEMORY
    // =======================

    if (memoryData && memoryData.length > 0) {

      memoryData.forEach((item) => {

        messages.push({
          role: item.role,
          content: item.content
        });

      });

    }

    // =======================
    // CURRENT MESSAGE
    // =======================

    messages.push({
      role: "user",
      content: userMessage
    });

    // =======================
    // FOLLOW-UP MESSAGE
    // =======================

    if (
      userMessage.toLowerCase().includes("30") ||
      userMessage.toLowerCase().includes("half hour")
    ) {

      setTimeout(async () => {

        try {

          await bot.sendMessage(
            userId,
            "ab free ho kya? 😄"
          );

        } catch (err) {

          console.log("FOLLOW UP ERROR:", err);

        }

      }, 30 * 60 * 1000);

    }

    // =======================
    // OPENAI RESPONSE
    // =======================

    const response =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages
      });

    const aiReply =
      response.choices[0].message.content;

    console.log("AI REPLY:", aiReply);

    // =======================
    // SAVE AI REPLY
    // =======================

    const { error: aiSaveError } =
      await supabase
        .from('test')
        .insert([
          {
            user_id: userId,
            role: 'assistant',
            content: aiReply
          }
        ]);

    if (aiSaveError) {
      console.log("AI SAVE ERROR:", aiSaveError);
    }

    // =======================
    // SEND MESSAGE
    // =======================

    await bot.sendMessage(
      userId,
      aiReply
    );

  } catch (error) {

    console.log("MAIN ERROR:", error);

  }

});

// =======================
// START SERVER
// =======================

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
