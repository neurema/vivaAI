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

    // Append user answer
    const newMessages = [...messages];
    newMessages.push({
      role: 'user',
      content: buildAnswerPrompt(userAnswer)
    });

    const responseContent = await callGroq(newMessages);
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

    const newMessages = [...messages];
    newMessages.push({
      role: 'user',
      content: buildAnalysisPrompt()
    });

    const responseContent = await callGroq(newMessages);
    // We don't necessarily need to return the messages history for analysis, just the result

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
