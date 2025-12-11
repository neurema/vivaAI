require('dotenv').config();

const BytezModule = require('bytez.js');
const Bytez = BytezModule.default || BytezModule;
const axios = require('axios');
const FormData = require('form-data');

const BYTEZ_MODEL_ID = 'Qwen/Qwen3Guard-Gen-8B';

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

      const sdk = new Bytez(apiKey);
      const model = sdk.model(BYTEZ_MODEL_ID);

      const { error, output } = await model.run(messages);

      if (error) {
        const normalizedError = typeof error === 'string' ? error : error.message || JSON.stringify(error);
        throw new Error(normalizedError);
      }

      const normalizedOutput = normalizeOutput(output);

      if (!normalizedOutput) {
        throw new Error('No content received from Bytez API');
      }

      return normalizedOutput;
    } catch (error) {
      lastError = error;
      const errorMessage = error.response ? error.response.data : error.message;
      console.error(`Error calling Bytez API with key index ${index}:`, errorMessage);
    }
  }

  throw lastError || new Error('Failed to call Groq API with the configured keys');
}

function normalizeOutput(output) {
  if (!output) {
    return '';
  }

  if (typeof output === 'string') {
    return output;
  }

  if (Array.isArray(output)) {
    const pieces = output
      .map((item) => extractContent(item))
      .filter((text) => Boolean(text && text.trim()));

    return pieces.join('').trim();
  }

  if (typeof output === 'object') {
    return extractContent(output) || '';
  }

  return String(output);
}

function extractContent(item) {
  if (!item) {
    return '';
  }

  if (typeof item === 'string') {
    return item;
  }

  if (Array.isArray(item)) {
    return item.map((nested) => extractContent(nested)).join('');
  }

  if (typeof item === 'object') {
    if (typeof item.content === 'string') {
      return item.content;
    }

    if (Array.isArray(item.content)) {
      return item.content.map((nested) => extractContent(nested)).join('');
    }

    if (typeof item.text === 'string') {
      return item.text;
    }
  }

  return '';
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
