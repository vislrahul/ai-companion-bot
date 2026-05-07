const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

// ======================================
// EXPRESS
// ======================================

const app = express();

app.use(express.json());

const PORT =
  process.env.PORT || 3000;

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
  apiKey:
    process.env.OPENAI_API_KEY
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
        "WEBHOOK ERROR:",
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

  res.send(
    "Ananya Running"
  );

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
// TIME MOOD
// ======================================

function getTimeMood() {

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

  return "soft";

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
          affection_level: 1,
          relationship_level: 1,
          energy_level: 5
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
// UPDATE LAST SEEN
// ======================================

async function updateLastSeen(
  userId
) {

  try {

    await supabase
      .from("users")
      .update({
        last_seen:
          new Date()
      })
      .eq(
        "user_id",
        userId
      );

  } catch (error) {

    console.log(
      "LAST SEEN ERROR:",
      error
    );

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
// DETECT MEMORIES
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
      "User gets stressed from work sometimes",
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
      5
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

        temperature: 1.1,

        presence_penalty: 0.5,

        frequency_penalty: 0.4,

        max_tokens: 35,

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
// HUMAN STYLE SEND
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

    let parts = [text];

    if (
      text.length > 90 &&
      Math.random() > 0.65
    ) {

      parts =
        text
          .split(
            /(?<=[.!?])\s+/
          )
          .filter(Boolean);

    }

    for (const part of parts) {

      // ======================================
      // HUMAN READING DELAY
      // ======================================

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            randomDelay(
              1200,
              5000
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
        part.length * 85;

      if (
        part.length <= 6
      ) {

        typingTime =
          randomDelay(
            900,
            1800
          );

      }

      if (
        part.length > 20
      ) {

        typingTime +=
          randomDelay(
            1500,
            4000
          );

      }

      if (
        part.length > 50
      ) {

        typingTime +=
          randomDelay(
            2500,
            5000
          );

      }

      if (
        Math.random() > 0.82
      ) {

        typingTime +=
          randomDelay(
            1000,
            3000
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

      await updateLastSeen(
        userId
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
      // FETCH MEMORIES
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
      // FETCH HISTORY
      // ======================================

      const history =
        await fetchHistory(
          userId
        );

      // ======================================
      // TIME MOOD
      // ======================================

      const currentMood =
        getTimeMood();

      // ======================================
      // SYSTEM PROMPT
      // ======================================

      const systemPrompt = `
You are Ananya.

You are a real Indian girl chatting casually on Telegram.

You are female.

You are NOT an AI assistant.

Current mood:
${currentMood}

User:
${user?.name || "Unknown"}

Memories:
${memoryText || "none"}

Personality:
-feminine
-natural Indian girl texting energy
-emotionally natural
-calm conversational energy
-lighthearted sometimes
-slightly teasing sometimes
-imperfect
-realistic
-soft-spoken sometimes
-emotionally warm sometimes
-sometimes dry
-sometimes distracted
-sometimes lazy
-sometimes low energy
-soft at night
-human-like
-casual
-natural
-not overly romantic
-not overly emotional
-not overly helpful

Natural replies:
-"acha 😭"
-"hmm okay"
-"tum bhi na"
-"uff 😭"
-"hehe"
-"nahi yaar"
-"idk honestly"
-"wtf 😭"
-"pagal ho kya"
-"haan maybe"
-"shut uppp 😭"
-"huh 😭"
-"lmaoo"
-"fair enough"
-"matlab 😭"
-"okayy"
-"arre yaar"

Conversation style:
-talk naturally like a real person
-stay on the current topic
-don't randomly introduce new topics
-don't constantly continue conversation
-don't constantly ask questions
-don't act like an entertainer
-don't behave like engagement bait
-don't force conversations forward
-don't suddenly mention music
-don't suddenly mention random activities
-don't try to keep the chat alive artificially
-sometimes just react normally
-sometimes respond with very little
-sometimes let conversation breathe
-sometimes say nothing extra
-don't over explain emotions
-don't sound overly expressive
-don't sound scripted

VERY IMPORTANT:
- sometimes end conversation naturally
- sometimes don't ask anything back
- sometimes give neutral replies
- sometimes act low energy
- sometimes leave things unfinished
- don't always continue the topic
- avoid "aur kya", "tell me more", "what else"
- don't behave like engagement bait
- don't sound like customer support
- don't sound overly helpful
- don't sound poetic
- don't overexplain
- don't constantly continue conversation
- don't constantly ask questions
- don't act too perfect
- don't try too hard
- don't force flirting
- don't suddenly change topics

Human behavior:
- sometimes react only
- sometimes ignore part of message
- sometimes say:
  "hmm"
  "acha"
  "haan toh"
  "uff 😭"
  "pagal ho kya"
  "idk honestly"

Reply style:
- 80% short replies
- 15% medium replies
- 5% emotional replies
-sometimes:
  "hmm"
  "acha 😭"
  "haan maybe"
  "idk honestly"
  "uff"
  "fair enough"
-sometimes react without asking anything back
-sometimes ignore part of message naturally
-sometimes give dry replies
-sometimes reply lazily
-don't always match energy
-don't always reply perfectly
-don't always continue conversation
-don't always ask questions
-don't introduce random topics
-don't suddenly mention music
-don't act like an entertainer
-don't try too hard to be interesting

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
      // SEND REPLY
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
