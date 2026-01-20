const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

// --- CONFIGURATION ---
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TEXT_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';

const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const AUDIO_MODEL = 'whisper-large-v3-turbo';

// --- PRICING CONFIGURATION (per million tokens) ---
// Approximate pricing for common models on OpenRouter
const MODEL_PRICING = {
    'meta-llama/llama-3.3-70b-instruct': { input: 0.1, output: 0.1 }, // Example pricing
    'default': { input: 0.1, output: 0.1 }
};

function getModelPricing() {
    return MODEL_PRICING[TEXT_MODEL] || MODEL_PRICING['default'];
}

function calculateCost(promptTokens, completionTokens) {
    const pricing = getModelPricing();
    const inputCost = (promptTokens / 1_000_000) * pricing.input;
    const outputCost = (completionTokens / 1_000_000) * pricing.output;
    return {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost
    };
}

// API KEYS
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
    .split(/[\s,]+/)
    .map((key) => key.trim())
    .filter(Boolean);

let currentGroqKeyIndex = 0;

function getNextGroqKey() {
    if (GROQ_API_KEYS.length === 0) {
        throw new Error('GROQ_API_KEY or GROQ_API_KEYS must be set for audio transcription');
    }
    currentGroqKeyIndex = (currentGroqKeyIndex + 1) % GROQ_API_KEYS.length;
    return { apiKey: GROQ_API_KEYS[currentGroqKeyIndex], index: currentGroqKeyIndex };
}

// --- CUMULATIVE TOKEN TRACKING ---
const tokenStats = {
    byContext: {},
    total: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, calls: 0, cost: 0 }
};

function trackTokenUsage(context, usage) {
    const costInfo = calculateCost(usage.prompt_tokens, usage.completion_tokens);

    if (!tokenStats.byContext[context]) {
        tokenStats.byContext[context] = {
            prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, calls: 0, cost: 0
        };
    }
    tokenStats.byContext[context].prompt_tokens += usage.prompt_tokens;
    tokenStats.byContext[context].completion_tokens += usage.completion_tokens;
    tokenStats.byContext[context].total_tokens += usage.total_tokens;
    tokenStats.byContext[context].calls += 1;
    tokenStats.byContext[context].cost += costInfo.totalCost;

    tokenStats.total.prompt_tokens += usage.prompt_tokens;
    tokenStats.total.completion_tokens += usage.completion_tokens;
    tokenStats.total.total_tokens += usage.total_tokens;
    tokenStats.total.calls += 1;
    tokenStats.total.cost += costInfo.totalCost;
}

function getTokenStats() {
    return {
        ...tokenStats,
        currentModel: TEXT_MODEL
    };
}

function resetTokenStats() {
    tokenStats.byContext = {};
    tokenStats.total = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, calls: 0, cost: 0 };
}

function logTokenUsage(context, usage, durationMs = 0) {
    const costInfo = calculateCost(usage.prompt_tokens, usage.completion_tokens);
    console.log(`📊 [${context}] Usage & Cost (${TEXT_MODEL}):`);
    console.log(`   Input:    ${usage.prompt_tokens} tokens | Cost: $${costInfo.inputCost.toFixed(6)}`);
    console.log(`   Output:   ${usage.completion_tokens} tokens | Cost: $${costInfo.outputCost.toFixed(6)}`);
    console.log(`   Duration: ${durationMs}ms`);
    console.log(`   Total:    ${usage.total_tokens} tokens | Cost: $${costInfo.totalCost.toFixed(6)}`);
    trackTokenUsage(context, usage);
}

// --- MAIN FUNCTIONS ---

async function callLLM(messages, options = {}) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY must be set in environment variables');
    }

    const { temperature = 0.6, context = 'API Call' } = options;

    try {
        const startTime = Date.now();
        console.log(`🤖 Calling OpenRouter (${TEXT_MODEL})...`);

        const response = await axios.post(
            OPENROUTER_API_URL,
            {
                model: TEXT_MODEL,
                messages: messages,
                temperature: temperature,
                // Optional: Add more OpenRouter specific headers or body params here if needed
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://neurema.com', // Optional, required by OpenRouter for rankings
                    'X-Title': 'VivaAI', // Optional
                },
            }
        );

        const durationMs = Date.now() - startTime;

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const content = response.data.choices[0].message.content || '';
            const usage = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

            logTokenUsage(context, usage, durationMs);
            return { content, usage };
        }

        throw new Error('No content received from OpenRouter API');

    } catch (error) {
        const errorMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error(`❌ Error calling OpenRouter API:`, errorMessage);
        throw error;
    }
}

async function transcribeAudio(buffer, filename) {
    // Uses Groq for transcription (kept from original implementation)
    const totalKeys = GROQ_API_KEYS.length;
    if (totalKeys === 0) {
        throw new Error('GROQ_API_KEY or GROQ_API_KEYS must be set for transcription');
    }

    let lastError;
    // Simple retry mechanism across keys
    for (let attempt = 0; attempt < totalKeys; attempt++) {
        const { apiKey, index } = getNextGroqKey();

        try {
            console.log(`Using Groq API key index: ${index} for transcription`);

            const form = new FormData();
            form.append('file', buffer, filename || 'audio.m4a');
            form.append('model', AUDIO_MODEL);

            const response = await axios.post(GROQ_AUDIO_URL, form, {
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

module.exports = { callLLM, transcribeAudio, getTokenStats, resetTokenStats };
