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

console.log('\n--- Testing parseSummary (Plaintext Input) ---');
const sampleSummary = `
WEAK_POINTS

<Error>: "It lowers BP" → Correction: It increases BP via vasoconstriction
<Vague Point>: "Giving fluids" → Refinement: "Fluid resuscitation with RL"

BLIND_SPOTS

<Missed Concept>: Golden Hour concept [PYQ]

STRONG_POINTS

<Specific accurate fact>: Explained ATLS protocol well

METRICS

Accuracy Score: 85%
Concepts Mastered: 12
Concepts Confused: 2
Concepts Missed: 1

AREA_OF_IMPROVEMENT

The 5-Minute Upgrade: Revise Shock classification table in Harrison.
Read about massive transfusion protocol.
`;

const parsedSummary = parseSummary(sampleSummary);
console.log('Input:', sampleSummary.trim());
console.log('Output:', JSON.stringify(parsedSummary, null, 2));

if (parsedSummary.raw) {
    console.error('FAIL: raw field should not be present');
} else {
    console.log('PASS: raw field successfully removed');
}
