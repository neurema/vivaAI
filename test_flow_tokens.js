/**
 * Automated Flow Tester for Viva AI
 * Simulates full Viva sessions and collects token usage statistics.
 * 
 * Usage: node test_flow_tokens.js [numSessions]
 * Example: node test_flow_tokens.js 3
 */

const axios = require('axios');

const BASE_URL = process.env.VIVA_API_URL || 'http://localhost:7981/api';
const NUM_SESSIONS = parseInt(process.argv[2]) || 1;
const QUESTIONS_PER_SESSION = 12; // Stop after 12 Q&A cycles

// Sample answers to simulate student responses
const SAMPLE_ANSWERS = [
    "I think it's related to the underlying pathology causing inflammation",
    "The first-line treatment would be conservative management",
    "We should order imaging studies like CT or MRI",
    "The differential diagnosis includes several conditions",
    "Blood tests would show elevated markers",
    "The prognosis depends on early intervention",
    "I would start with empirical therapy",
    "The mechanism involves receptor binding",
    "This is a classic presentation of the disease",
    "We need to rule out complications first",
    "The gold standard investigation is biopsy",
    "I don't know"
];

// Token usage tracker
const tokenStats = {
    startViva: [],
    answerQuestion: [],
    analyzeViva: [],
    total: []
};

function getRandomAnswer() {
    return SAMPLE_ANSWERS[Math.floor(Math.random() * SAMPLE_ANSWERS.length)];
}

async function startViva() {
    const response = await axios.post(`${BASE_URL}/viva/start`, {
        examType: 'NEET PG',
        subject: 'Medicine',
        topic: 'Cardiology - Heart Failure',
        revisionRound: 1,
        revisionCount: 0
    });
    return response.data;
}

async function answerQuestion(messages, userAnswer) {
    const response = await axios.post(`${BASE_URL}/viva/answer`, {
        messages,
        userAnswer
    });
    return response.data;
}

async function analyzeViva(performanceLog) {
    const response = await axios.post(`${BASE_URL}/viva/analysis`, {
        performanceLog,
        topic: 'Cardiology - Heart Failure',
        subject: 'Medicine',
        examType: 'NEET PG'
    });
    return response.data;
}

async function runSingleSession(sessionNum) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 SESSION ${sessionNum} STARTED`);
    console.log(`${'='.repeat(60)}`);

    const performanceLog = [];
    let sessionTokens = { prompt: 0, completion: 0, total: 0 };

    try {
        // Step 1: Start Viva
        console.log('\n🚀 Starting Viva...');
        const startData = await startViva();
        let messages = startData.messages;
        let parsed = startData.parsed;

        console.log(`   Q1: ${parsed.question?.substring(0, 80)}...`);

        // Step 2: Answer Questions Loop
        for (let q = 1; q <= QUESTIONS_PER_SESSION; q++) {
            if (parsed.isFinished) {
                console.log(`\n✅ Session ended by AI at Q${q}`);
                break;
            }

            const userAnswer = getRandomAnswer();
            console.log(`\n💬 Q${q} Answer: "${userAnswer.substring(0, 40)}..."`);

            // Small delay to prevent rate limiting
            await new Promise(r => setTimeout(r, 500));

            const answerData = await answerQuestion(messages, userAnswer);
            messages = answerData.messages;
            parsed = answerData.parsed;

            // Build performance log for analysis
            performanceLog.push({
                q: q,
                evaluation: parsed.evaluation || 'Unknown',
                userAnswer: userAnswer.substring(0, 100)
            });

            console.log(`   ➡️ Eval: ${parsed.evaluation || 'N/A'}`);

            if (parsed.question && !parsed.isFinished) {
                console.log(`   ➡️ Next Q: ${parsed.question.substring(0, 60)}...`);
            }
        }

        // Step 3: Analyze Viva
        console.log('\n📊 Running Analysis...');
        const analysis = await analyzeViva(performanceLog);
        console.log(`   Short Lines: ${analysis.shortLines?.substring(0, 80)}...`);

        console.log(`\n✅ SESSION ${sessionNum} COMPLETED`);
        return { success: true, questionsAnswered: performanceLog.length };

    } catch (error) {
        console.error(`\n❌ SESSION ${sessionNum} FAILED:`, error.response?.data || error.message);
        return { success: false, questionsAnswered: 0 };
    }
}

async function resetStats() {
    try {
        await axios.post(`${BASE_URL}/viva/stats/reset`);
        console.log('✅ Token stats reset');
    } catch (e) {
        console.log('⚠️ Could not reset stats (endpoint may not exist)');
    }
}

async function fetchStats() {
    try {
        const response = await axios.get(`${BASE_URL}/viva/stats`);
        return response.data;
    } catch (e) {
        console.log('⚠️ Could not fetch stats (endpoint may not exist)');
        return null;
    }
}

function printStatsTable(stats) {
    console.log(`\n${'═'.repeat(90)}`);
    console.log('📊 TOKEN USAGE & BILLING STATISTICS');
    console.log(`${'═'.repeat(90)}`);

    // Model and caching info
    console.log(`\n🤖 Model: ${stats.currentModel}`);
    if (stats.pricing) {
        console.log(`💰 Pricing: $${stats.pricing.input}/M input, $${stats.pricing.output}/M output`);
    }
    if (stats.promptCachingEnabled) {
        console.log(`✅ Prompt Caching: ENABLED (50% discount on cached tokens)`);
    } else {
        console.log(`⚠️  Prompt Caching: NOT AVAILABLE for this model`);
        console.log(`   Supported models: moonshotai/kimi-k2-instruct-0905, openai/gpt-oss-*`);
    }

    console.log('\n┌────────────────────────┬────────┬────────┬────────┬────────┬────────┬────────┬──────────┐');
    console.log('│ Context                │ Calls  │ Prompt │ Cached │ Compl  │ Total  │ Cache% │ Cost USD │');
    console.log('├────────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼──────────┤');

    for (const [ctx, data] of Object.entries(stats.byContext)) {
        const ctxName = ctx.substring(0, 22).padEnd(22);
        const calls = String(data.calls).padStart(6);
        const prompt = String(data.prompt_tokens).padStart(6);
        const cached = String(data.cached_tokens || 0).padStart(6);
        const compl = String(data.completion_tokens).padStart(6);
        const total = String(data.total_tokens).padStart(6);
        const cacheRate = String((data.cacheHitRate || 0) + '%').padStart(6);
        const cost = ('$' + (data.costUSD || 0).toFixed(6)).padStart(9);
        console.log(`│ ${ctxName} │${calls} │${prompt} │${cached} │${compl} │${total} │${cacheRate} │${cost} │`);
    }

    console.log('├────────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼──────────┤');
    const t = stats.total;
    const totalCached = String(t.cached_tokens || 0).padStart(6);
    const totalCacheRate = String((t.cacheHitRate || 0) + '%').padStart(6);
    const totalCost = ('$' + (t.costUSD || 0).toFixed(6)).padStart(9);
    console.log(`│ ${'TOTAL'.padEnd(22)} │${String(t.calls).padStart(6)} │${String(t.prompt_tokens).padStart(6)} │${totalCached} │${String(t.completion_tokens).padStart(6)} │${String(t.total_tokens).padStart(6)} │${totalCacheRate} │${totalCost} │`);
    console.log('└────────────────────────┴────────┴────────┴────────┴────────┴────────┴────────┴──────────┘');

    // Cost summary
    console.log(`
💵 BILLING SUMMARY:
   ┌─────────────────────────────────────────────────┐
   │ Total Cost (with caching):     $${(t.costUSD || 0).toFixed(6).padStart(10)}  │
   │ Cost without caching:          $${(t.costWithoutCaching || t.costUSD || 0).toFixed(6).padStart(10)}  │
   │ Savings from caching:          $${(t.savingsUSD || 0).toFixed(6).padStart(10)}  │
   │ Cost per Viva Session:         $${((t.costUSD || 0) / (NUM_SESSIONS || 1)).toFixed(6).padStart(10)}  │
   └─────────────────────────────────────────────────┘

📈 TOKEN AVERAGES:
   • Avg Prompt Tokens/Call:     ${t.avgPrompt}
   • Avg Completion Tokens/Call: ${t.avgCompletion}
   • Avg Total Tokens/Call:      ${t.avgTotal}
   • Overall Cache Hit Rate:     ${t.cacheHitRate || 0}%
`);
}

async function main() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║          VIVA AI - AUTOMATED FLOW TESTER                   ║
║          Token Usage Statistics Collector                  ║
╚════════════════════════════════════════════════════════════╝

🎯 Sessions to run: ${NUM_SESSIONS}
🔗 API Base URL: ${BASE_URL}
📝 Questions per session: ${QUESTIONS_PER_SESSION}
`);

    // Reset stats before starting
    await resetStats();

    const sessionResults = [];

    for (let i = 1; i <= NUM_SESSIONS; i++) {
        const result = await runSingleSession(i);
        sessionResults.push(result);

        // Small delay between sessions
        if (i < NUM_SESSIONS) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Fetch and display stats
    const stats = await fetchStats();
    if (stats) {
        printStatsTable(stats);
    }

    // Summary Report
    console.log(`${'═'.repeat(70)}`);
    console.log('� SESSION SUMMARY');
    console.log(`${'═'.repeat(70)}`);

    const successfulSessions = sessionResults.filter(r => r.success).length;
    const totalQuestions = sessionResults.reduce((sum, r) => sum + r.questionsAnswered, 0);

    console.log(`
Sessions Run:        ${NUM_SESSIONS}
Successful:          ${successfulSessions}
Failed:              ${NUM_SESSIONS - successfulSessions}
Total Questions:     ${totalQuestions}
Avg Q/Session:       ${(totalQuestions / successfulSessions || 0).toFixed(1)}
`);
}

main().catch(console.error);
