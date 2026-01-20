require('dotenv').config();
const { callLLM } = require('./llmClient');

async function testConnection() {
    if (!process.env.OPENROUTER_API_KEY) {
        console.error('❌ Error: OPENROUTER_API_KEY is missing in .env');
        process.exit(1);
    }

    console.log('Testing OpenRouter connection...');
    try {
        const messages = [{ role: 'user', content: 'Say "Hello, OpenRouter!"' }];
        const { content, usage } = await callLLM(messages, { context: 'Test Connection' });

        console.log('\n✅ Success!');
        console.log('Response:', content);
        console.log('Usage:', usage);
    } catch (error) {
        console.error('\n❌ Connection failed:', error.message);
    }
}

testConnection();
