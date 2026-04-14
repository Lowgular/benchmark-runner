const { runSingleEval } = require('./scorer.js');

const actual = process.argv[2];
const expected = process.argv[3];
console.log('Scoring test data for', actual, expected);

console.log(runSingleEval(actual, expected));
