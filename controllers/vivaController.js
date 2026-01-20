const { callGroq, transcribeAudio } = require('../utils/groqClient');
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

    const messages = [];
    messages.push({ role: 'system', content: buildSystemPrompt(examType) });
    messages.push({
      role: 'user',
      content: buildStartPrompt({ examType, subject, topic, revisionRound, revisionCount })
    });

    const responseContent = await callGroq(messages);
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

    // --- TOKEN OPTIMIZATION: Sliding Window Context ---
    // Keep System Prompt (index 0) and Exam Context (index 1)
    const systemMessage = messages[0];
    const contextMessage = messages.length > 1 ? messages[1] : null;

    // Slice the LAST 4 messages (approx 2 turns: Q, A, Q, A)
    const recentHistory = messages.slice(-4);

    // Construct optimized payload for Groq
    const optimizedMessages = contextMessage
      ? [systemMessage, contextMessage, ...recentHistory]
      : [systemMessage, ...recentHistory];

    // Add the new user answer to the optimized payload for Groq
    optimizedMessages.push({
      role: 'user',
      content: buildAnswerPrompt(userAnswer)
    });

    const responseContent = await callGroq(optimizedMessages);

    // Append to FULL history for client-side state management
    const newMessages = [...messages];
    newMessages.push({ role: 'user', content: buildAnswerPrompt(userAnswer) });
    newMessages.push({ role: 'assistant', content: responseContent });

    const parsed = parseResponse(responseContent);

    res.json({
      messages: newMessages,
      parsed: parsed
    });

  } catch (error) {
    console.error('Error in answerQuestion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.analyzeViva = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid input: messages array required' });
    }

    // --- TOKEN OPTIMIZATION: Compressed Analysis ---
    // Truncate very long student answers to save tokens
    const MAX_CONTENT_LENGTH = 500;
    const compressedMessages = messages.map(msg => {
      const content = msg.content || '';
      if (msg.role === 'user' && content.length > MAX_CONTENT_LENGTH) {
        return { role: msg.role, content: content.substring(0, MAX_CONTENT_LENGTH) + '...[truncated]' };
      }
      return { role: msg.role, content: content };
    });

    compressedMessages.push({
      role: 'user',
      content: buildAnalysisPrompt()
    });

    const responseContent = await callGroq(compressedMessages);

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

    const responseContent = await callGroq(summaryMessages);
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
