const { callGroq } = require('../utils/groqClient');
const { 
  buildSystemPrompt, 
  buildStartPrompt, 
  buildAnswerPrompt, 
  buildAnalysisPrompt 
} = require('../utils/promptBuilder');
const { parseResponse, parseAnalysis } = require('../utils/parser');

exports.startViva = async (req, res) => {
  try {
    const { examType, subject, topic, revisionRound, revisionCount } = req.body;

    if (!examType || !subject || !topic || !revisionRound || revisionCount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const messages = [];
    messages.push({ role: 'system', content: buildSystemPrompt() });
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
