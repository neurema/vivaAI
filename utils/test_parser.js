const { parseResponse, parseAnalysis, parseSummary } = require('./parser');

console.log('--- Testing parseResponse ---');
const sampleResponse = `
EVAL: Correct
SUPPORT: You explained the concept well.
QUESTION: What is the next topic?
`;

const parsedResponse = parseResponse(sampleResponse);
console.log('Input:', sampleResponse.trim());
console.log('Output:', parsedResponse);

console.log('\n--- Testing parseAnalysis ---');
const sampleAnalysis = `
Here is the analysis.

SHORT_LINES:
- Line 1
- Line 2

IMPROVEMENT_POINTS:
- Point A
- Point B
`;

const parsedAnalysis = parseAnalysis(sampleAnalysis);
console.log('Input:', sampleAnalysis.trim());
console.log('Output:', parsedAnalysis);

console.log('\n--- Testing parseSummary ---');
const sampleSummary = `
WEAK_POINTS:
- Weakness 1
- Weakness 2

STRONG_POINTS:
- Strength 1
- Strength 2

AREA_OF_IMPROVEMENT:
- Improvement 1
`;

const parsedSummary = parseSummary(sampleSummary);
console.log('Input:', sampleSummary.trim());
console.log('Output:', parsedSummary);
