const axios = require('axios');
require('dotenv').config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const GROQ_API_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(/[\s,]+/)
  .map((key) => key.trim())
  .filter(Boolean);

let currentKeyIndex = 0;

// Rotate through the configured Groq API keys so requests distribute evenly.
function getNextApiKey() {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error('GROQ_API_KEY or GROQ_API_KEYS must be set in environment variables');
  }

  const apiKey = GROQ_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
  console.log(`Using Groq API key index: ${currentKeyIndex}`);
  return apiKey;
}

async function callGroq(messages) {
  const apiKey = getNextApiKey();

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: messages,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error('No content received from Groq API');
    }
  } catch (error) {
    console.error('Error calling Groq API:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = { callGroq };
