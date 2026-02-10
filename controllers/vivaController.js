const { callLLM, transcribeAudio, getTokenStats, resetTokenStats } = require('../utils/llmClient');
const {
  buildSystemPrompt,
  buildStartPrompt,
  buildAnswerPrompt,
  buildAnalysisPrompt,
  buildTeachModeSummaryPrompt
} = require('../utils/promptBuilder');
const { parseResponse, parseAnalysis, parseSummary } = require('../utils/parser');

exports.startViva = async (req, res) => {
  try {
    const { examType, subject, topic, revisionRound, revisionCount, teacherInstructions } = req.body;

    if (!examType || !subject || !topic || !revisionRound || revisionCount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // --- CONTEXT IN START PROMPT ---
    const context = { subject, topic, revisionRound, revisionCount, teacherInstructions };

    const messages = [];
    messages.push({ role: 'system', content: buildSystemPrompt(examType) });
    messages.push({
      role: 'user',
      content: buildStartPrompt(context)
    });

    const { content: responseContent } = await callLLM(messages, { context: 'Start Viva' });
    messages.push({ role: 'assistant', content: responseContent });

    const parsed = parseResponse(responseContent);

    res.json({
      messages: messages,
      parsed: parsed
    });

  } catch (error) {
    console.error('Error in startViva:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.answerQuestion = async (req, res) => {
  try {
    const { messages, userAnswer } = req.body;

    if (!messages || !Array.isArray(messages) || userAnswer === undefined) {
      return res.status(400).json({ error: 'Invalid input: messages array and userAnswer required' });
    }

    // We send the full history to maintain context.

    // Clone the messages array and add the new user answer
    const groqMessages = [...messages];
    groqMessages.push({
      role: 'user',
      content: buildAnswerPrompt(userAnswer)
    });

    // --- SLIDING WINDOW FIX ---
    // 1. Grab the permanent System Prompt (Index 0)
    const systemMsg = groqMessages[0];

    // 2. Grab the Exam Context (Index 1) - e.g. "Topic is Thermodynamics"
    const contextMsg = groqMessages[1];

    // 3. Grab ONLY the last 2 exchanges (Last 4 messages) from the REST
    // We strictly skip index 0 & 1, then slice the tail.
    const rawHistory = groqMessages.slice(2);
    // If history is small, take it all; otherwise take last 4 items (2 turns)
    const recentHistory = rawHistory.length > 4 ? rawHistory.slice(-4) : rawHistory;

    // 4. Rebuild the payload for the AI
    const optimizedHistory = [
      systemMsg,
      contextMsg,
      ...recentHistory
    ];

    const { content: responseContent } = await callLLM(optimizedHistory, { context: 'Answer Question' });

    // Append assistant response for the full history
    groqMessages.push({ role: 'assistant', content: responseContent });

    const parsed = parseResponse(responseContent);

    res.json({
      messages: groqMessages,
      parsed: parsed
    });

  } catch (error) {
    console.error('Error in answerQuestion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.analyzeViva = async (req, res) => {
  try {
    const { performanceLog, topic, subject, examType } = req.body;

    // --- DUAL-HISTORY STRATEGY: Metadata Log Analysis ---
    // The client sends a compressed performanceLog instead of full chat history.
    // Format: [{ q: 1, evaluation: "Correct", topic: "...", userAnswer: "..." }, ...]

    if (!performanceLog || !Array.isArray(performanceLog)) {
      return res.status(400).json({ error: 'Invalid input: performanceLog array required' });
    }

    const analysisPrompt = buildAnalysisPrompt(performanceLog, topic, subject, examType);
    const analysisMessages = [{ role: 'user', content: analysisPrompt }];

    const { content: responseContent } = await callLLM(analysisMessages, { context: 'Analyze Viva' });
    const analysis = parseAnalysis(responseContent);

    res.json(analysis);

  } catch (error) {
    console.error('Error in analyzeViva:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.summarizeTeachSession = async (req, res) => {
  try {
    const { transcription, topic, subject, examType, language } = req.body;

    if (!transcription || !topic) {
      return res.status(400).json({ error: 'Missing required fields: transcription and topic' });
    }

    const prompt = buildTeachModeSummaryPrompt(transcription, topic, subject, examType, language);
    const summaryMessages = [{ role: 'user', content: prompt }];

    console.log('Generating summary for topic:', topic);

    const { content: responseContent } = await callLLM(summaryMessages, { context: 'Teach Session Summary' });
    const parsed = parseSummary(responseContent);

    res.json(parsed);

  } catch (error) {
    console.error('Error in summarizeTeachSession:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.transcribe = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const transcription = await transcribeAudio(req.file.buffer, req.file.originalname);
    res.json({ transcription });

  } catch (error) {
    console.error('Error in transcribe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- TOKEN STATS ENDPOINTS (for testing/monitoring) ---
exports.getStats = (req, res) => {
  const stats = getTokenStats();
  res.json(stats);
};

exports.resetStats = (req, res) => {
  resetTokenStats();
  res.json({ message: 'Token stats reset successfully' });
};
