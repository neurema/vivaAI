const { parseResponse, parseAnalysis } = require('./parser');

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
