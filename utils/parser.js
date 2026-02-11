function parseResponse(content) {
  const raw = content.trim();

  // 1. Try JSON Parsing
  try {
    // Extract JSON if it's wrapped in markdown code blocks
    let jsonStr = raw;
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    const parsed = JSON.parse(jsonStr);

    // Validate structure (basic check)
    if (parsed && typeof parsed === 'object') {
      return {
        evaluation: parsed.eval || parsed.evaluation || '',
        support: parsed.support || '',
        question: parsed.question || '',
        isFinished: parsed.isFinished === true, // Ensure boolean
        raw: raw
      };
    }
  } catch (e) {
    // JSON parsing failed, proceed to fallback
    // console.log("JSON Parse failed, falling back to regex", e);
  }

  // 2. Fallback: Regex Parsing (Legacy)
  const evalMatch = raw.match(/^EVAL:\s*(.*)$/m);
  const evalText = evalMatch ? evalMatch[1].trim() : '';

  const supportMatch = raw.match(/^SUPPORT:\s*(.*)$/m);
  const supportText = supportMatch ? supportMatch[1].trim() : '';

  const qMatch = raw.match(/^QUESTION:\s*(.*)$/m);
  let question = '';
  let isFinished = false;

  if (qMatch) {
    const text = qMatch[1].trim();
    if (text.toUpperCase() === 'FINISHED') {
      isFinished = true;
    } else {
      question = text;
    }
  }

  return {
    evaluation: evalText,
    support: supportText,
    question: question,
    isFinished: isFinished,
    raw: raw
  };
}

function extractSection(text, header) {
  // normalize header to be just the word part for regex, e.g. "WEAK_POINTS"
  const coreHeader = header.replace(/[:*]/g, '').trim();

  // Regex to find the header. 
  // Matches: 
  // 1. Optional stars/markdown: (\*\*|##|\s)*
  // 2. The core header (case insensitive for safety): coreHeader
  // 3. Optional stars/markdown/colon: (\*\*|:|\s)*
  // 4. End of line
  const headerRegex = new RegExp(`(?:\\*\\*|##|\\s)*${coreHeader}(?:\\*\\*|:|\\s)*$`, 'im');

  const match = text.match(headerRegex);
  if (!match) return '';

  const startContent = match.index + match[0].length;
  const rest = text.substring(startContent);

  // We need to stop at the next significant header.
  // The known headers are:
  const headers = [
    'WEAK_POINTS',
    'BLIND_SPOTS',
    'STRONG_POINTS',
    'METRICS',
    'AREA_OF_IMPROVEMENT',
    'SHORT_LINES',
    'IMPROVEMENT_POINTS'
  ];

  // Construct a regex that finds any of these headers at the start of a line
  // (allowing for markdown symbols like **, ##, etc.)
  // Lookahead for newline before it to ensure it's a header
  const headerPattern = headers.map(h => `(?:\\*\\*|##|\\s)*${h}(?:\\*\\*|:|\\s)*`).join('|');
  const nextHeaderRegex = new RegExp(`^\\s*(${headerPattern})(?:$|\\r\\n|\\n)`, 'im');

  // Search line by line to maximize safety
  const lines = rest.split('\n');
  let accumulatedLength = 0;

  for (let i = 0; i < lines.length; i++) {
    // Check if this line looks like a header (but skip empty lines)
    if (lines[i].trim().length > 0 && nextHeaderRegex.test(lines[i])) {
      // It's a header, stop here
      break;
    }
    accumulatedLength += lines[i].length + 1; // +1 for the newline char we split on
  }

  return rest.substring(0, accumulatedLength).trim();
}

function parseAnalysis(content) {
  const shortLines = extractSection(content, 'SHORT_LINES');
  const improvementPoints = extractSection(content, 'IMPROVEMENT_POINTS');

  return {
    shortLines,
    improvementPoints
  };
}


function parseSummary(content) {
  const weakPoints = extractSection(content, 'WEAK_POINTS');
  const blindSpots = extractSection(content, 'BLIND_SPOTS');
  const strongPoints = extractSection(content, 'STRONG_POINTS');
  const metricsRaw = extractSection(content, 'METRICS');
  const areaOfImprovement = extractSection(content, 'AREA_OF_IMPROVEMENT');

  const metrics = {};
  if (metricsRaw) {
    const lines = metricsRaw.split('\n');
    lines.forEach(line => {
      // Handle lines like: "- **Accuracy Score:** **35 %**" or "Accuracy Score: 35%"
      // Remove generic markdown clutter
      const cleanLine = line.replace(/[*_#]/g, '').trim();

      // Match "Key: Value"
      const match = cleanLine.match(/^-?\s*([^:]+):\s*(.*)$/);
      if (match) {
        // camelCase key
        const rawKey = match[1].trim();
        const value = match[2].trim();

        const key = rawKey
          .toLowerCase()
          .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
        metrics[key] = value;
      }
    });
  }

  return {
    weakPoints,
    blindSpots,
    strongPoints,
    metrics,
    areaOfImprovement
  };
}

module.exports = {

  parseResponse,
  parseAnalysis,
  parseSummary
};
