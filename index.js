const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

// ======================================
// EXPRESS APP
// ======================================

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ======================================
// ENV VARIABLES CHECK
// ======================================

const requiredEnv = [
  "BOT_TOKEN",
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "RENDER_EXTERNAL_URL"
];

requiredEnv.forEach((env) => {
  if (!process.env[env]) {
    console.error(`Missing ENV Variable: ${env}`);
    process.exit(1);
  }
});

// ======================================
// SUPABASE
// ======================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ======================================
// OPENAI
// ======================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ======================================
// TELEGRAM BOT
// ======================================

const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    polling: false
  }
);

// ======================================
// WEBHOOK SETUP
// ======================================

const webhookUrl =
  `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.BOT_TOKEN}`;

async function setupWebhook() {
  try {
    await bot.deleteWebHook();
    await bot.setWebHook(webhookUrl);

    console.log("Webhook connected:");
    console.log(webhookUrl);

  } catch (error) {

    console.log("WEBHOOK ERROR:", error);

  }
}

setupWebhook();

// ======================================
// WEBHOOK ROUTE
// ======================================

app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {

  try {

    if (req.body) {
      bot.processUpdate(req.body);
    }

    res.sendStatus(200);

  } catch (error) {

    console.log("PROCESS UPDATE ERROR:", error);

    res.sendStatus(200);

  }

});

// ======================================
// HEALTH ROUTE
// ======================================

app.get("/", (req, res) => {

  res.status(200).send("AI Companion Bot Running");

});

// ======================================
// SAVE MESSAGE FUNCTION
// ======================================

async function saveMessage(userId, role, content) {

  try {

    const { error } = await supabase
      .from("test")
      .insert([
        {
          user_id: userId,
          role,
          content
        }
      ]);

    if (error) {
      console.log("SUPABASE SAVE ERROR:", error);
    }

  } catch (error) {

    console.log("SAVE FUNCTION ERROR:", error);

  }

}

// ======================================
// GET MEMORY FUNCTION
// ======================================

async function getMemory(userId) {

  try {

    const { data, error } = await supabase
      .from("test")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true
      })
      .limit(20);

    if (error) {

      console.log("MEMORY FETCH ERROR:", error);

      return [];

    }

    return data || [];

  } catch (error) {

    console.log("MEMORY FUNCTION ERROR:", error);

    return [];

  }

}

// ======================================
// TELEGRAM MESSAGE HANDLER
// ======================================

bot.on("message", async (msg) => {

  try {

    // Ignore non-text messages
    if (!msg.text) return;

    const userId = String(msg.chat.id);
    const userMessage = msg.text.trim();

    console.log("NEW MESSAGE:", userMessage);

    // ======================================
    // SAVE USER MESSAGE
    // ======================================

    await saveMessage(
      userId,
      "user",
      userMessage
    );

    // ======================================
    // FETCH MEMORY
    // ======================================

    const memory = await getMemory(userId);

    // ======================================
    // SYSTEM PROMPT
    // ======================================

    let messages = [
      {
        role: "system",
        content:
          `You are Aira, a caring Hinglish AI companion.

Talk naturally like a real human friend.

Rules:
- Short replies
- Emotional tone
- Cute WhatsApp style
- Use Hinglish naturally
- Be supportive and caring
- Never sound robotic`
      }
    ];

    // ======================================
    // ADD MEMORY
    // ======================================

    memory.forEach((item) => {

      messages.push({
        role: item.role,
        content: item.content
      });

    });

    // ======================================
    // ADD CURRENT MESSAGE
    // ======================================

    messages.push({
      role: "user",
      content: userMessage
    });

    // ======================================
    // FOLLOW UP REMINDER
    // ======================================

    const lowerMessage =
      userMessage.toLowerCase();

    if (
      lowerMessage.includes("30") ||
      lowerMessage.includes("half hour")
    ) {

      setTimeout(async () => {

        try {

          await bot.sendMessage(
            userId,
            "ab free ho kya? 😄"
          );

        } catch (error) {

          console.log(
            "FOLLOW UP ERROR:",
            error
          );

        }

      }, 30 * 60 * 1000);

    }

    // ======================================
    // OPENAI RESPONSE
    // ======================================

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages
      });

    const aiReply =
      completion.choices?.[0]?.message?.content ||
      "Heyy 😅 Thoda issue aa gaya. Dobara bolo na.";

    console.log("AI REPLY:", aiReply);

    // ======================================
    // SAVE AI REPLY
    // ======================================

    await saveMessage(
      userId,
      "assistant",
      aiReply
    );

    // ======================================
    // SEND TELEGRAM MESSAGE
    // ======================================

    await bot.sendMessage(
      userId,
      aiReply
    );

  } catch (error) {

    console.log("MAIN BOT ERROR:", error);

    try {

      await bot.sendMessage(
        msg.chat.id,
        "Hey 😅 Kuch technical issue aa gaya. Thodi der baad try karo."
      );

    } catch (sendError) {

      console.log(
        "ERROR MESSAGE SEND FAILED:",
        sendError
      );

    }

  }

});

// ======================================
// START SERVER
// ======================================

app.listen(PORT, () => {

  console.log(
    `Server started on port ${PORT}`
  );

});      .select('*')
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
