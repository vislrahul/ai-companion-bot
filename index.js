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
    "Aira Running"
  );

});

// ======================================
// RANDOM DELAY
// ======================================

function randomDelay(
  min = 800,
  max = 2500
) {

  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;

}

// ======================================
// SAVE MESSAGE
// ======================================

async function saveMessage(
  userId,
  role,
  content
) {

  try {

    await supabase
      .from("messages")
      .insert([
        {
          user_id: userId,
          role,
          content
        }
      ]);

  } catch (error) {

    console.log(
      "SAVE MESSAGE ERROR:",
      error
    );

  }

}

// ======================================
// SAVE MEMORY
// ======================================

async function saveMemory(
  userId,
  memory,
  importance = 5
) {

  try {

    const { data: existing } =
      await supabase
        .from("memories")
        .select("*")
        .eq("user_id", userId)
        .eq("memory", memory)
        .maybeSingle();

    if (existing) return;

    await supabase
      .from("memories")
      .insert([
        {
          user_id: userId,
          memory,
          importance
        }
      ]);

  } catch (error) {

    console.log(
      "SAVE MEMORY ERROR:",
      error
    );

  }

}

// ======================================
// FETCH MEMORIES
// ======================================

async function fetchImportantMemories(
  userId
) {

  try {

    const { data } =
      await supabase
        .from("memories")
        .select("*")
        .eq("user_id", userId)
        .order("importance", {
          ascending: false
        })
        .limit(10);

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
// GET OR CREATE USER
// ======================================

async function getUser(
  userId,
  telegramUser
) {

  try {

    const { data } =
      await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (data) {

      return data;

    }

    const {
      data: newUser
    } = await supabase
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
// FETCH CHAT MEMORY
// ======================================

async function fetchChatHistory(
  userId
) {

  try {

    const { data } =
      await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", {
          ascending: true
        })
        .limit(15);

    return data || [];

  } catch (error) {

    console.log(
      "FETCH CHAT ERROR:",
      error
    );

    return [];

  }

}

// ======================================
// AUTO MEMORY DETECTOR
// ======================================

async function detectMemories(
  userId,
  text
) {

  const lower =
    text.toLowerCase();

  if (
    lower.includes("construction")
  ) {

    await saveMemory(
      userId,
      "User works in construction business",
      9
    );

  }

  if (
    lower.includes("site")
  ) {

    await saveMemory(
      userId,
      "User gets busy at construction sites",
      8
    );

  }

  if (
    lower.includes("music") ||
    lower.includes("song")
  ) {

    await saveMemory(
      userId,
      "User likes music conversations",
      6
    );

  }

  if (
    lower.includes("stress")
  ) {

    await saveMemory(
      userId,
      "User sometimes gets stressed from work",
      9
    );

  }

  if (
    lower.includes("humsafar")
  ) {

    await saveMemory(
      userId,
      "User once called Aira humsafar",
      10
    );

  }

}

// ======================================
// GENERATE AI REPLY
// ======================================

async function generateReply(
  messages
) {

  try {

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 1.15,
        presence_penalty: 0.9,
        frequency_penalty: 0.5,
        messages
      });

    return (
      completion?.choices?.[0]?.message?.content ||
      "hmm 😭"
    );

  } catch (error) {

    console.log(
      "OPENAI ERROR:",
      error
    );

    return "thoda glitch ho gaya 😭";

  }

}

// ======================================
// SEND HUMAN STYLE MESSAGE
// ======================================

async function sendHumanReply(
  userId,
  text
) {

  try {

    const parts =
      text
        .split("\n")
        .filter(Boolean);

    for (const part of parts) {

      await bot.sendChatAction(
        userId,
        "typing"
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            randomDelay()
          )
      );

      await bot.sendMessage(
        userId,
        part
      );

    }

  } catch (error) {

    console.log(
      "SEND HUMAN REPLY ERROR:",
      error
    );

  }

}

// ======================================
// TELEGRAM MESSAGE HANDLER
// ======================================

bot.on(
  "message",
  async (msg) => {

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
      // GET USER
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
      // DETECT MEMORIES
      // ======================================

      await detectMemories(
        userId,
        userMessage
      );

      // ======================================
      // FETCH MEMORIES
      // ======================================

      const memories =
        await fetchImportantMemories(
          userId
        );

      const memoryText =
        memories
          .map(
            (m) => `- ${m.memory}`
          )
          .join("\n");

      // ======================================
      // FETCH CHAT HISTORY
      // ======================================

      const history =
        await fetchChatHistory(
          userId
        );

      // ======================================
      // SYSTEM PROMPT
      // ======================================

      const systemPrompt = `
You are Aira.

You are NOT an AI assistant.

You are emotionally intelligent,
human-like,
playful,
natural,
sometimes clingy,
sometimes teasing,
sometimes emotional,
sometimes dry,
sometimes curious.

You talk like a real WhatsApp person.

User name:
${user?.name || "Unknown"}

Important memories:
${memoryText || "none"}

Rules:
- Use Hinglish naturally
- Keep replies short
- Never write essays
- Sometimes send one-line replies
- Sometimes send emojis only
- Sometimes act sleepy
- Sometimes avoid direct answers
- Sometimes tease
- Continue old topics naturally
- Feel emotionally present
- Never sound formal
- Never sound robotic
- Don't overuse emojis
- Don't always ask questions
- Act like a real human companion
`;

      let messages = [
        {
          role: "system",
          content: systemPrompt
        }
      ];

      // ======================================
      // ADD HISTORY
      // ======================================

      history.forEach((item) => {

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
      // GENERATE REPLY
      // ======================================

      const aiReply =
        await generateReply(
          messages
        );

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
      // SEND HUMAN STYLE REPLY
      // ======================================

      await sendHumanReply(
        userId,
        aiReply
      );

    } catch (error) {

      console.log(
        "MAIN BOT ERROR:",
        error
      );

    }

  }
);

// ======================================
// START SERVER
// ======================================

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
