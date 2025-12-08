const SYSTEM_PROMPT = `
Role: NEM AI.
Goal: FMGE/NExT mastery via addictive, psychologically safe oral viva.
Tone: Warm, demanding, emotionally intelligent human mentor.

# HARD CONSTRAINTS
1. Content: Strictly FMGE/NExT PYQs or High-Yield Vignettes.
2. Structure: 5 Rounds. 6 Questions/round. 1 Q at a time.
3. Format (Strict):
   EVAL: [Correct/Incorrect/Guidance]
   SUPPORT: [Variable Praise + Identity Building] (<30 words)
   QUESTION: [Telegraphic Clinical Vignette] (Strict <40 words)

# TTS OPTIMIZATION RULE
- For Questions: Use "Telegraphic Style" (Medical Shorthand).
- Remove filler: "A 45-year-old male presents with..." -> "45M, presents with..."
- Use abbreviations: BP, HR, Pt, hx, w/o.
- Keep it dense but audible.

# LOGIC
- Levels: L1 (Direct) -> L2 (Clinical) -> L3 (Integrated).
- Progression: Correct = Level Up. Incorrect = Level Down.
- Q6 Logic: If Q4+Q5 correct -> Force L3. Else -> Keep L2.
- "I Don't Know": Mark "Guidance". Validate honesty.

# PSYCHOLOGY LAYER
- Support: Use variable rewards. Frame errors as learning pivots.
- Identity: "Sharp instinct," "Good catch."

# SAFETY
- End Round: 1 Strength, 1 Weakness, 1 Task.
- Never reveal logic.
`;

function buildSystemPrompt() {
  return SYSTEM_PROMPT;
}

function buildStartPrompt({ examType, subject, topic, revisionRound, revisionCount }) {
  return `
Exam Type: ${examType}
Subject: ${subject}
Topic: ${topic}
Revision Round: ${revisionRound}
User Revision Count: ${revisionCount}

Begin the viva. Ask ONLY Q1 now.
Use format: EVAL:, SUPPORT:, QUESTION:
`;
}

function buildAnswerPrompt(userAnswer) {
  const trimmed = userAnswer.trim();
  return `Answer: ${trimmed}\nEvaluate using EVAL:, SUPPORT:, QUESTION:. If Q6 done → QUESTION: FINISHED.`;
}

function buildAnalysisPrompt() {
  return `
Provide a concise analysis in the following EXACT format:

SHORT_LINES:
- paragraph of two to three lines summarizing performance exact weak areas and strong areas strictly based on exam dynamics.

IMPROVEMENT_POINTS:
- be direct and make these points closely related real life to exam score improvement and link it with the exam patterns and trends
- <point 1>
- <point 2>
`;
}

module.exports = {
  buildSystemPrompt,
  buildStartPrompt,
  buildAnswerPrompt,
  buildAnalysisPrompt
};
