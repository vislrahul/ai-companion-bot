const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// SUPABASE
const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_KEY
);

// OPENAI
const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

// TELEGRAM BOT
const bot = new TelegramBot(process.env.BOT_TOKEN);

// WEBHOOK
const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.BOT_TOKEN}`;

bot.setWebHook(webhookUrl);

app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {
bot.processUpdate(req.body);
res.sendStatus(200);
});

// TEST ROUTE
app.get('/', (req, res) => {
res.send('Bot is running');
});

// BOT MESSAGE HANDLER
bot.on('message', async (msg) => {
try {
const userId = String(msg.chat.id);
const userMessage = msg.text;

```
console.log("MESSAGE RECEIVED:", userMessage);

// SAVE USER MESSAGE
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

// FETCH MEMORY
const { data: memoryData, error: memoryError } = await supabase
  .from('test')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10);

if (memoryError) {
  console.log("MEMORY FETCH ERROR:", memoryError);
}

// SYSTEM PROMPT
let messages = [
  {
    role: "system",
    content:
      "You are Aira, a caring Hinglish AI companion. Talk casually like a real human. Keep replies short, emotional, natural, and WhatsApp-style."
  }
];

// OLD MEMORY
if (memoryData) {
  memoryData.reverse().forEach((item) => {
    messages.push({
      role: item.role,
      content: item.content
    });
  });
}

// CURRENT MESSAGE
messages.push({
  role: "user",
  content: userMessage
});

// FOLLOW-UP MESSAGE
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
```

} catch (error) {
console.error("MAIN ERROR:", error);
}
});

// START SERVER
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
