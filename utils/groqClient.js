const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const PROMPT_CACHING_MODELS = [
  'moonshotai/kimi-k2-instruct-0905',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-safeguard-20b'
];
const PROMPT_CACHING_ENABLED = PROMPT_CACHING_MODELS.includes(MODEL);

// --- PRICING CONFIGURATION (per million tokens) ---
// Official Groq pricing. Cached tokens get 50% discount.
const MODEL_PRICING = {
  // GPT-OSS models (prompt caching supported)
  'openai/gpt-oss-20b': { input: 0.075, output: 0.30 },
  'openai/gpt-oss-120b': { input: 0.15, output: 0.60 },
  'openai/gpt-oss-safeguard-20b': { input: 0.075, output: 0.30 },
  // Kimi K2 models (prompt caching supported)
  'moonshotai/kimi-k2-instruct-0905': { input: 1.00, output: 3.00 },
  // Llama 4 models
  'llama-4-scout-17bx16e-instruct': { input: 0.11, output: 0.34 },
  'llama-4-maverick-17bx128e-instruct': { input: 0.20, output: 0.60 },
  'llama-guard-4-12b': { input: 0.20, output: 0.20 },
  // Llama 3 models
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  // Qwen
  'qwen3-32b': { input: 0.29, output: 0.59 },
  // Mixtral
  'mixtral-8x7b-32768': { input: 0.27, output: 0.27 },
  // Default fallback
  'default': { input: 0.50, output: 1.00 }
};

function getModelPricing() {
  return MODEL_PRICING[MODEL] || MODEL_PRICING['default'];
}

function calculateCost(promptTokens, completionTokens, cachedTokens = 0) {
  const pricing = getModelPricing();
  // Non-cached input tokens
  const nonCachedInputTokens = promptTokens - cachedTokens;
  // Cached tokens get 50% discount
  const inputCost = ((nonCachedInputTokens / 1_000_000) * pricing.input) +
    ((cachedTokens / 1_000_000) * pricing.input * 0.5);
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return {
    inputCost: inputCost,
    outputCost: outputCost,
    totalCost: inputCost + outputCost,
    savings: (cachedTokens / 1_000_000) * pricing.input * 0.5 // Money saved from caching
  };
}

const GROQ_API_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(/[\s,]+/)
  .map((key) => key.trim())
  .filter(Boolean);

let currentKeyIndex = 0;
let lastKeyChangeTime = Date.now();
const KEY_STICKY_DURATION_MS = 60000; // Stick to same key for 1 minute for cache continuity

// Get API key with sticky selection for cache continuity
// Only rotates after sticky duration or on rate limit
function getNextApiKey(forceRotate = false) {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error('GROQ_API_KEY or GROQ_API_KEYS must be set in environment variables');
  }

  const now = Date.now();

  // Rotate key if forced (rate limit) or sticky duration expired
  if (forceRotate || (now - lastKeyChangeTime > KEY_STICKY_DURATION_MS)) {
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
    lastKeyChangeTime = now;
  }

  const apiKey = GROQ_API_KEYS[currentKeyIndex];
  return { apiKey, index: currentKeyIndex };
}

// --- CUMULATIVE TOKEN TRACKING (with cache and cost support) ---
const tokenStats = {
  byContext: {},
  total: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, calls: 0, cost: 0, savings: 0 }
};

function trackTokenUsage(context, usage) {
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;
  const costInfo = calculateCost(usage.prompt_tokens, usage.completion_tokens, cachedTokens);

  // Track by context
  if (!tokenStats.byContext[context]) {
    tokenStats.byContext[context] = {
      prompt_tokens: 0, completion_tokens: 0, total_tokens: 0,
      cached_tokens: 0, calls: 0, cost: 0, savings: 0
    };
  }
  tokenStats.byContext[context].prompt_tokens += usage.prompt_tokens;
  tokenStats.byContext[context].completion_tokens += usage.completion_tokens;
  tokenStats.byContext[context].total_tokens += usage.total_tokens;
  tokenStats.byContext[context].cached_tokens += cachedTokens;
  tokenStats.byContext[context].calls += 1;
  tokenStats.byContext[context].cost += costInfo.totalCost;
  tokenStats.byContext[context].savings += costInfo.savings;

  // Track global total
  tokenStats.total.prompt_tokens += usage.prompt_tokens;
  tokenStats.total.completion_tokens += usage.completion_tokens;
  tokenStats.total.total_tokens += usage.total_tokens;
  tokenStats.total.cached_tokens += cachedTokens;
  tokenStats.total.calls += 1;
  tokenStats.total.cost += costInfo.totalCost;
  tokenStats.total.savings += costInfo.savings;
}

function getTokenStats() {
  const stats = { byContext: {}, total: { ...tokenStats.total } };
  const pricing = getModelPricing();

  // Calculate averages, cache hit rate, and cost per context
  for (const [ctx, data] of Object.entries(tokenStats.byContext)) {
    const cacheHitRate = data.prompt_tokens > 0
      ? Math.round((data.cached_tokens / data.prompt_tokens) * 100)
      : 0;
    stats.byContext[ctx] = {
      ...data,
      avgPrompt: data.calls > 0 ? Math.round(data.prompt_tokens / data.calls) : 0,
      avgCompletion: data.calls > 0 ? Math.round(data.completion_tokens / data.calls) : 0,
      avgTotal: data.calls > 0 ? Math.round(data.total_tokens / data.calls) : 0,
      cacheHitRate: cacheHitRate,
      costUSD: data.cost,
      savingsUSD: data.savings
    };
  }

  // Calculate global averages, cache hit rate, and cost
  stats.total.avgPrompt = stats.total.calls > 0 ? Math.round(stats.total.prompt_tokens / stats.total.calls) : 0;
  stats.total.avgCompletion = stats.total.calls > 0 ? Math.round(stats.total.completion_tokens / stats.total.calls) : 0;
  stats.total.avgTotal = stats.total.calls > 0 ? Math.round(stats.total.total_tokens / stats.total.calls) : 0;
  stats.total.cacheHitRate = stats.total.prompt_tokens > 0
    ? Math.round((stats.total.cached_tokens / stats.total.prompt_tokens) * 100)
    : 0;
  stats.total.costUSD = stats.total.cost;
  stats.total.savingsUSD = stats.total.savings;
  stats.total.costWithoutCaching = stats.total.cost + stats.total.savings; // What it would have cost without caching

  stats.promptCachingEnabled = PROMPT_CACHING_ENABLED;
  stats.currentModel = MODEL;
  stats.pricing = pricing;

  return stats;
}

function resetTokenStats() {
  tokenStats.byContext = {};
  tokenStats.total = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, calls: 0, cost: 0, savings: 0 };
}

// Helper function to log token usage to console (with cache info)
function logTokenUsage(context, usage) {
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;
  const cacheHitRate = usage.prompt_tokens > 0
    ? Math.round((cachedTokens / usage.prompt_tokens) * 100)
    : 0;

  console.log(`📊 [${context}] Token Usage:`);
  console.log(`   ├─ Prompt: ${usage.prompt_tokens}`);
  if (cachedTokens > 0) {
    console.log(`   ├─ Cached: ${cachedTokens} (🟢 ${cacheHitRate}% cache hit)`);
  }
  console.log(`   ├─ Completion: ${usage.completion_tokens}`);
  console.log(`   └─ Total: ${usage.total_tokens}`);

  // Track for cumulative stats
  trackTokenUsage(context, usage);
}

async function callGroq(messages, options = {}) {
  const totalKeys = GROQ_API_KEYS.length;

  if (totalKeys === 0) {
    throw new Error('GROQ_API_KEY or GROQ_API_KEYS must be set in environment variables');
  }

  let lastError;
  const { temperature = 0.6, context = 'API Call' } = options;
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000; // 2 seconds base delay

  for (let keyAttempt = 0; keyAttempt < totalKeys; keyAttempt++) {
    // First attempt uses sticky key, subsequent attempts force rotation
    const { apiKey, index } = getNextApiKey(keyAttempt > 0);

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          console.log(`🔄 Retry ${retry}/${MAX_RETRIES} for key ${index}...`);
        } else if (keyAttempt === 0) {
          console.log(`Using Groq API key index: ${index}`);
        } else {
          console.log(`Switching to Groq API key index: ${index}`);
        }

        const response = await axios.post(
          GROQ_API_URL,
          {
            model: MODEL,
            messages: messages,
            temperature: temperature,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
          }
        );

        if (response.data && response.data.choices && response.data.choices.length > 0) {
          const content = response.data.choices[0].message.content || '';
          const usage = response.data.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          };

          // Log token usage
          logTokenUsage(context, usage);

          return { content, usage };
        }

        throw new Error('No content received from Groq API');
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data || error.message;

        // Handle rate limiting (429)
        if (statusCode === 429) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, retry); // Exponential backoff: 2s, 4s, 8s
          const retryAfter = error.response?.headers?.['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delayMs;

          console.warn(`⚠️ Rate limited (429). Waiting ${waitTime / 1000}s before retry...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue; // Retry with same key
        }

        console.error(`❌ Error calling Groq API with key index ${index}:`, errorMessage);
        break; // Try next key for other errors
      }
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

module.exports = { callGroq, transcribeAudio, getTokenStats, resetTokenStats };
