import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getChatbotReply } from './chatbot.js';

const app = express();
const port = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use('/front-end', express.static(path.join(__dirname, 'front-end')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'front-end', 'index.html'));
});

app.post('/chat', async (req, res) => {
  try {
    const question = req.body?.question?.trim();
    const chatHistory = req.body?.chatHistory ?? [];

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!Array.isArray(chatHistory)) {
      return res.status(400).json({ error: 'Chat history must be an array' });
    }

    const response = await getChatbotReply(question, chatHistory);
    return res.json({ response });
  } catch (error) {
    console.error('Chat error:', error.message);
    return res.status(500).json({ error: 'Something went wrong while generating the response.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});