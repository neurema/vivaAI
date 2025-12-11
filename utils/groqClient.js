const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const GROQ_API_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(/[\s,]+/)
  .map((key) => key.trim())
  .filter(Boolean);

let currentKeyIndex = 0;

// Rotate through the configured Groq API keys so requests distribute evenly and failover cleanly.
function getNextApiKey() {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error('GROQ_API_KEY or GROQ_API_KEYS must be set in environment variables');
  }

  const selectedIndex = currentKeyIndex;
  const apiKey = GROQ_API_KEYS[selectedIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
  return { apiKey, index: selectedIndex };
}

async function callGroq(messages) {
  const totalKeys = GROQ_API_KEYS.length;

  if (totalKeys === 0) {
    throw new Error('GROQ_API_KEY or GROQ_API_KEYS must be set in environment variables');
  }

  let lastError;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const { apiKey, index } = getNextApiKey();

    try {
      console.log(`Using Groq API key index: ${index}`);

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
      }

      throw new Error('No content received from Groq API');
    } catch (error) {
      lastError = error;
      const errorMessage = error.response ? error.response.data : error.message;
      console.error(`Error calling Groq API with key index ${index}:`, errorMessage);
    }
  }

  throw lastError || new Error('Failed to call Groq API with the configured keys');
}

async function transcribeAudio(buffer, filename) {
  const totalKeys = GROQ_API_KEYS.length;
  if (totalKeys === 0) {
    throw new Error('GROQ_API_KEY or GROQ_API_KEYS must be set in environment variables');
  }

  let lastError;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const { apiKey, index } = getNextApiKey();

    try {
      console.log(`Using Groq API key index: ${index} for transcription`);

      const form = new FormData();
      form.append('file', buffer, filename || 'audio.m4a');
      form.append('model', 'whisper-large-v3-turbo');

      const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders()
        }
      });

      return response.data.text;

    } catch (error) {
      lastError = error;
      const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error(`Error calling Groq Transcription API with key index ${index}:`, errorMessage);
    }
  }

  throw lastError || new Error('Failed to transcribe audio with configured keys');
}

module.exports = { callGroq, transcribeAudio };
