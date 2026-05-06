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

const REQUIRED_ENV = [
  "BOT_TOKEN",
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "RENDER_EXTERNAL_URL"
];

for (const envName of REQUIRED_ENV) {

  if (!process.env[envName]) {

    console.error(
      `Missing environment variable: ${envName}`
    );

    process.exit(1);

  }

}

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

    console.log("Webhook connected");
    console.log(webhookUrl);

  } catch (error) {

    console.log(
      "WEBHOOK SETUP ERROR:",
      error
    );

  }

}

setupWebhook();

// ======================================
// WEBHOOK ROUTE
// ======================================

app.post(
  `/bot${process.env.BOT_TOKEN}`,
  async (req, res) => {

    try {

      if (req.body) {

        bot.processUpdate(req.body);

      }

      res.sendStatus(200);

    } catch (error) {

      console.log(
        "WEBHOOK PROCESS ERROR:",
        error
      );

      res.sendStatus(200);

    }

  }
);

// ======================================
// HEALTH CHECK ROUTE
// ======================================

app.get("/", (req, res) => {

  res.status(200).send(
    "AI Companion Bot Running"
  );

});

// ======================================
// SAVE MESSAGE FUNCTION
// ======================================

async function saveMessage(
  userId,
  role,
  content
) {

  try {

    const { error } = await supabase
      .from("test")
      .insert([
        {
          user_id: userId,
          role: role,
          content: content
        }
      ]);

    if (error) {

      console.log(
        "SUPABASE SAVE ERROR:",
        error
      );

    }

  } catch (error) {

    console.log(
      "SAVE MESSAGE FUNCTION ERROR:",
      error
    );

  }

}

// ======================================
// FETCH MEMORY FUNCTION
// ======================================

async function fetchMemory(userId) {

  try {

    const {
      data,
      error
    } = await supabase
      .from("test")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true
      })
      .limit(20);

    if (error) {

      console.log(
        "MEMORY FETCH ERROR:",
        error
      );

      return [];

    }

    return data || [];

  } catch (error) {

    console.log(
      "FETCH MEMORY FUNCTION ERROR:",
      error
    );

    return [];

  }

}

// ======================================
// CREATE AI RESPONSE
// ======================================

async function generateReply(messages) {

  try {

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages
      });

    return (
      completion?.choices?.[0]?.message?.content ||
      "Hey 😅 Thoda issue aa gaya."
    );

  } catch (error) {

    console.log(
      "OPENAI ERROR:",
      error
    );

    return "Hey 😅 Thoda technical issue aa gaya.";

  }

}

// ======================================
// TELEGRAM MESSAGE HANDLER
// ======================================

bot.on("message", async (msg) => {

  try {

    // Ignore non-text messages
    if (!msg.text) return;

    const userId =
      String(msg.chat.id);

    const userMessage =
      msg.text.trim();

    console.log(
      "NEW MESSAGE:",
      userMessage
    );

    // ======================================
    // SAVE USER MESSAGE
    // ======================================

    await saveMessage(
      userId,
      "user",
      userMessage
    );

    // ======================================
    // FETCH OLD MEMORY
    // ======================================

    const memory =
      await fetchMemory(userId);

    // ======================================
    // SYSTEM PROMPT
    // ======================================

    let messages = [
      {
        role: "system",
        content:
          `You are Aira, a caring Hinglish AI companion.

Rules:
- Talk like a real human friend
- Use short replies
- Emotional and natural tone
- Cute WhatsApp style
- Use Hinglish naturally
- Be caring and supportive
- Never sound robotic`
      }
    ];

    // ======================================
    // ADD OLD MEMORY
    // ======================================

    if (memory.length > 0) {

      memory.forEach((item) => {

        messages.push({
          role: item.role,
          content: item.content
        });

      });

    }

    // ======================================
    // ADD CURRENT USER MESSAGE
    // ======================================

    messages.push({
      role: "user",
      content: userMessage
    });

    // ======================================
    // FOLLOW-UP REMINDER
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
    // GENERATE AI RESPONSE
    // ======================================

    const aiReply =
      await generateReply(messages);

    console.log(
      "AI REPLY:",
      aiReply
    );

    // ======================================
    // SAVE AI REPLY
    // ======================================

    await saveMessage(
      userId,
      "assistant",
      aiReply
    );

    // ======================================
    // SEND REPLY
    // ======================================

    await bot.sendMessage(
      userId,
      aiReply
    );

  } catch (error) {

    console.log(
      "MAIN BOT ERROR:",
      error
    );

  }

});

// ======================================
// START SERVER
// ======================================

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
