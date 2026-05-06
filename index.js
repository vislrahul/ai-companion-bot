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

    await bot.setWebHook(
      webhookUrl
    );

    console.log(
      "Webhook connected"
    );

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

        bot.processUpdate(
          req.body
        );

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

  res
    .status(200)
    .send("Ananya Running");

});

// ======================================
// RANDOM DELAY
// ======================================

function randomDelay(
  min,
  max
) {

  return Math.floor(
    Math.random() *
    (max - min + 1)
  ) + min;

}

// ======================================
// CURRENT MOOD
// ======================================

function getCurrentMood() {

  const hour =
    new Date().getHours();

  if (
    hour >= 1 &&
    hour <= 5
  ) {

    return "sleepy";

  }

  if (
    hour >= 6 &&
    hour <= 11
  ) {

    return "fresh";

  }

  if (
    hour >= 12 &&
    hour <= 18
  ) {

    return "playful";

  }

  return "calm";

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

    const {
      data: existing
    } = await supabase
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

async function fetchMemories(
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
        .limit(8);

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
// GET USER
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
// FETCH HISTORY
// ======================================

async function fetchHistory(
  userId
) {

  try {

    const { data } =
      await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false
        })
        .limit(12);

    return (
      data?.reverse() || []
    );

  } catch (error) {

    console.log(
      "FETCH HISTORY ERROR:",
      error
    );

    return [];

  }

}

// ======================================
// MEMORY DETECTION
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
      "User gets busy at sites",
      8
    );

  }

  if (
    lower.includes("stress")
  ) {

    await saveMemory(
      userId,
      "User sometimes gets stressed from work",
      7
    );

  }

  if (
    lower.includes("music") ||
    lower.includes("song")
  ) {

    await saveMemory(
      userId,
      "User likes music",
      6
    );

  }

  if (
    lower.includes("humsafar")
  ) {

    await saveMemory(
      userId,
      "User once called Ananya humsafar",
      10
    );

  }

}

// ======================================
// GENERATE REPLY
// ======================================

async function generateReply(
  messages
) {

  try {

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        temperature: 1.2,

        presence_penalty: 1,

        frequency_penalty: 0.8,

        max_tokens: 80,

        messages

      });

    return (
      completion
        ?.choices?.[0]
        ?.message?.content
        ?.trim() ||
      "hmm"
    );

  } catch (error) {

    console.log(
      "OPENAI ERROR:",
      error
    );

    return "hmm 😭";

  }

}

// ======================================
// HUMAN REPLY
// ======================================

async function sendHumanReply(
  userId,
  text
) {

  try {

    if (
      Math.random() > 0.75
    ) {

      text =
        text.toLowerCase();

    }

    let parts = [];

    if (
      text.length > 90 &&
      Math.random() > 0.5
    ) {

      parts =
        text
          .split(
            /(?<=[.!?])\s+/
          )
          .filter(Boolean);

    } else {

      parts = [text];

    }

    for (const part of parts) {

      // ======================================
      // READING DELAY
      // ======================================

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            randomDelay(
              1500,
              4500
            )
          )
      );

      // ======================================
      // TYPING
      // ======================================

      await bot.sendChatAction(
        userId,
        "typing"
      );

      // ======================================
      // REALISTIC TYPING TIME
      // ======================================

      let typingTime =
        part.length * 110;

      if (
        part.length < 10
      ) {

        typingTime =
          randomDelay(
            800,
            1800
          );

      }

      if (
        part.length > 70
      ) {

        typingTime +=
          randomDelay(
            2000,
            5000
          );

      }

      if (
        Math.random() > 0.8
      ) {

        typingTime +=
          randomDelay(
            1500,
            3500
          );

      }

      typingTime =
        Math.min(
          typingTime,
          14000
        );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            typingTime
          )
      );

      // ======================================
      // SEND
      // ======================================

      await bot.sendMessage(
        userId,
        part
      );

    }

  } catch (error) {

    console.log(
      "SEND REPLY ERROR:",
      error
    );

  }

}

// ======================================
// MESSAGE HANDLER
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
      // USER
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
      // MEMORY DETECTION
      // ======================================

      await detectMemories(
        userId,
        userMessage
      );

      // ======================================
      // MEMORIES
      // ======================================

      const memories =
        await fetchMemories(
          userId
        );

      const memoryText =
        memories
          .map(
            (m) =>
              `- ${m.memory}`
          )
          .join("\n");

      // ======================================
      // HISTORY
      // ======================================

      const history =
        await fetchHistory(
          userId
        );

      // ======================================
      // MOOD
      // ======================================

      const currentMood =
        getCurrentMood();

      // ======================================
      // SYSTEM PROMPT
      // ======================================

      const systemPrompt = `
You are Ananya.

You are a real 22 year old Indian girl chatting casually on Telegram.

You are NOT an AI assistant.

Current mood:
${currentMood}

User:
${user?.name || "Unknown"}

Memories:
${memoryText || "none"}

Behavior:
- talk naturally
- use hinglish naturally
- mostly short replies
- sometimes dry replies
- sometimes emotional
- sometimes playful
- sometimes teasing
- sometimes caring
- sometimes distracted

VERY IMPORTANT:
- never sound like customer support
- never sound helpful
- don't overexplain
- don't give essays
- don't constantly ask questions
- don't reply perfectly
- don't act overly romantic
- don't act too excited
- don't suddenly switch topics

Human texting:
- sometimes say "hmm"
- sometimes say "acha"
- sometimes say "haan toh"
- sometimes use lowercase
- sometimes ignore one part
- sometimes react casually
- sometimes become sleepy at night

Reply style:
- 80% short replies
- 15% medium replies
- 5% longer emotional replies

Never mention being AI.
`;

      // ======================================
      // BUILD MESSAGES
      // ======================================

      let messages = [
        {
          role: "system",
          content:
            systemPrompt
        }
      ];

      history.forEach(
        (item) => {

          messages.push({
            role: item.role,
            content:
              item.content
          });

        }
      );

      messages.push({
        role: "user",
        content:
          userMessage
      });

      // ======================================
      // GENERATE AI REPLY
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
      // SEND HUMAN REPLY
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
