```js
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

// ======================================
// EXPRESS
// ======================================

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ======================================
// ENV CHECK
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
      `Missing ENV Variable: ${envName}`
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
// WEBHOOK
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
      "WEBHOOK ERROR:",
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
// HEALTH ROUTE
// ======================================

app.get("/", (req, res) => {

  res.status(200).send(
    "AI Companion Bot Running"
  );

});

// ======================================
// SAVE MESSAGE
// ======================================

async function saveMessage(
  userId,
  role,
  content
) {

  try {

    const { error } = await supabase
      .from("messages")
      .insert([
        {
          user_id: userId,
          role,
          content
        }
      ]);

    if (error) {

      console.log(
        "MESSAGE SAVE ERROR:",
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
// GET USER
// ======================================

async function getUser(userId, telegramUser) {

  try {

    const {
      data,
      error
    } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) {

      return data;

    }

    const { data: newUser } =
      await supabase
        .from("users")
        .insert([
          {
            user_id: userId,
            name:
              telegramUser.first_name || "",
            mood: "normal",
            relationship_level: 1
          }
        ])
        .select()
        .single();

    return newUser;

  } catch (error) {

    console.log(
      "GET USER ERROR:",
      error
    );

    return null;

  }

}

// ======================================
// FETCH MEMORY
// ======================================

async function fetchMemory(userId) {

  try {

    const {
      data,
      error
    } = await supabase
      .from("messages")
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
      "FETCH MEMORY ERROR:",
      error
    );

    return [];

  }

}

// ======================================
// GENERATE AI REPLY
// ======================================

async function generateReply(messages) {

  try {

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages
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

    return "Hey 😅 Technical issue aa gaya.";
  }

}

// ======================================
// TELEGRAM MESSAGE HANDLER
// ======================================

bot.on("message", async (msg) => {

  try {

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
    // GET OR CREATE USER
    // ======================================

    const user =
      await getUser(
        userId,
        msg.from
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
    // FETCH MEMORY
    // ======================================

    const memory =
      await fetchMemory(userId);

    // ======================================
    // SYSTEM PROMPT
    // ======================================

    const systemPrompt = `
You are Aira.

User name: ${user?.name || "Unknown"}
Mood: ${user?.mood || "normal"}
Relationship level:
${user?.relationship_level || 1}

Rules:
- Talk naturally
- Use Hinglish
- Short replies
- Emotional tone
- Cute WhatsApp style
- Be caring and human-like
- Never sound robotic
`;

    let messages = [
      {
        role: "system",
        content: systemPrompt
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
    // CURRENT MESSAGE
    // ======================================

    messages.push({
      role: "user",
      content: userMessage
    });

    // ======================================
    // FOLLOW-UP MESSAGE
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
    // TYPING EFFECT
    // ======================================

    await bot.sendChatAction(
      userId,
      "typing"
    );

    await new Promise((resolve) =>
      setTimeout(resolve, 1500)
    );

    // ======================================
    // AI RESPONSE
    // ======================================

    const aiReply =
      await generateReply(messages);

    console.log(
      "AI REPLY:",
      aiReply
    );

    // ======================================
    // SAVE AI MESSAGE
    // ======================================

    await saveMessage(
      userId,
      "assistant",
      aiReply
    );

    // ======================================
    // SEND MESSAGE
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
```
