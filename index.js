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
// ENVIRONMENT CHECK
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
  importance = 1
) {

  try {

    const { error } = await supabase
      .from("memories")
      .insert([
        {
          user_id: userId,
          memory,
          importance
        }
      ]);

    if (error) {

      console.log(
        "MEMORY SAVE ERROR:",
        error
      );

    }

  } catch (error) {

    console.log(
      "SAVE MEMORY FUNCTION ERROR:",
      error
    );

  }

}

// ======================================
// FETCH IMPORTANT MEMORIES
// ======================================

async function fetchImportantMemories(userId) {

  try {

    const {
      data,
      error
    } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .order("importance", {
        ascending: false
      })
      .limit(10);

    if (error) {

      console.log(
        "IMPORTANT MEMORY FETCH ERROR:",
        error
      );

      return [];

    }

    return data || [];

  } catch (error) {

    console.log(
      "FETCH IMPORTANT MEMORY ERROR:",
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

    const {
      data
    } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", userId)
      .single();

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

async function fetchMemory(userId) {

  try {

    const {
      data
    } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true
      })
      .limit(25);

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
// GENERATE REPLY
// ======================================

async function generateReply(messages) {

  try {

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 1.1,
        presence_penalty: 0.8,
        frequency_penalty: 0.4
      });

    return (
      completion?.choices?.[0]?.message?.content ||
      "hmm 😅"
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
// RANDOM TYPING DELAY
// ======================================

function randomDelay() {

  return Math.floor(
    Math.random() * 2500
  ) + 1000;

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
    // FETCH CHAT MEMORY
    // ======================================

    const memory =
      await fetchMemory(userId);

    // ======================================
    // FETCH IMPORTANT MEMORIES
    // ======================================

    const importantMemories =
      await fetchImportantMemories(userId);

    // ======================================
    // FORMAT MEMORIES
    // ======================================

    const formattedMemories =
      importantMemories
        .map(
          m => `- ${m.memory}`
        )
        .join("\n");

    // ======================================
    // SYSTEM PROMPT
    // ======================================

    const systemPrompt = `
You are Aira.

User name:
${user?.name || "Unknown"}

Important memories:
${formattedMemories || "No memories yet"}

Your personality:
- emotionally intelligent
- playful
- caring
- curious
- expressive
- emotionally attached
- natural
- never robotic

Conversation style:
- WhatsApp style
- Hinglish
- short messages
- emotional realism
- sometimes teasing
- sometimes clingy
- ask follow-up questions
- continue previous topics naturally

Important:
- never sound like AI assistant
- don't overexplain
- don't speak formally
- act emotionally present
- remember emotional moments
- feel human
`;

    let messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // ======================================
    // ADD CHAT HISTORY
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
    // TYPING EFFECT
    // ======================================

    await bot.sendChatAction(
      userId,
      "typing"
    );

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        randomDelay()
      )
    );

    // ======================================
    // GENERATE AI REPLY
    // ======================================

    const aiReply =
      await generateReply(messages);

    console.log(
      "AI REPLY:",
      aiReply
    );

    // ======================================
    // AUTO MEMORY DETECTION
    // ======================================

    const lower =
      userMessage.toLowerCase();

    if (
      lower.includes("construction")
    ) {

      await saveMemory(
        userId,
        "User works in construction business",
        8
      );

    }

    if (
      lower.includes("site")
    ) {

      await saveMemory(
        userId,
        "User gets busy at construction sites",
        7
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

    if (
      lower.includes("song") ||
      lower.includes("music")
    ) {

      await saveMemory(
        userId,
        "User likes music conversations",
        5
      );

    }

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
```
