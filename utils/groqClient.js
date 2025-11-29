const axios = require('axios');
require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set in environment variables');
  }

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
          'Authorization': `Bearer ${GROQ_API_KEY}`,
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
