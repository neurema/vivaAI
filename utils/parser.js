function parseResponse(content) {
  const raw = content.trim();

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
  const start = text.indexOf(header);
  if (start === -1) return '';

  const startContent = start + header.length;
  // Look for double newline as delimiter, or just take the rest
  const end = text.indexOf('\n\n', startContent);

  const section = (end === -1)
    ? text.substring(startContent).trim()
    : text.substring(startContent, end).trim();

  return section;
}

function parseAnalysis(content) {
  const shortLines = extractSection(content, 'SHORT_LINES:');
  const improvementPoints = extractSection(content, 'IMPROVEMENT_POINTS:');

  return {
    shortLines,
    improvementPoints
  };
}


function parseSummary(content) {
  const weakPoints = extractSection(content, 'WEAK_POINTS:');
  const strongPoints = extractSection(content, 'STRONG_POINTS:');
  const areaOfImprovement = extractSection(content, 'AREA_OF_IMPROVEMENT:');

  return {
    weakPoints,
    strongPoints,
    areaOfImprovement
  };
}

module.exports = {

  parseResponse,
  parseAnalysis,
  parseSummary
};
