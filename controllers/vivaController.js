const { callGroq, transcribeAudio, getTokenStats, resetTokenStats } = require('../utils/groqClient');
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
    const { examType, subject, topic, revisionRound, revisionCount } = req.body;

    if (!examType || !subject || !topic || !revisionRound || revisionCount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // --- CACHE OPTIMIZATION: Include context in system prompt ---
    // By putting subject/topic in the system message, it becomes part of the cached prefix
    // All subsequent turns in this session will reuse this cached system message
    const context = { subject, topic, revisionRound, revisionCount };

    const messages = [];
    messages.push({ role: 'system', content: buildSystemPrompt(examType, context) });
    messages.push({
      role: 'user',
      content: buildStartPrompt()
    });

    const { content: responseContent } = await callGroq(messages, { context: 'Start Viva' });
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

    // --- CACHE-OPTIMIZED: Keep consistent growing message array ---
    // Groq prompt caching requires EXACT prefix match.
    // Sliding window was breaking cache by changing the prefix each turn.
    // Now we send the full history to maintain the same prefix.

    // Clone the messages array and add the new user answer
    const groqMessages = [...messages];
    groqMessages.push({
      role: 'user',
      content: buildAnswerPrompt(userAnswer)
    });

    const { content: responseContent } = await callGroq(groqMessages, { context: 'Answer Question' });

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

    const { content: responseContent } = await callGroq(analysisMessages, { context: 'Analyze Viva' });
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

    const { content: responseContent } = await callGroq(summaryMessages, { context: 'Teach Session Summary' });
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
