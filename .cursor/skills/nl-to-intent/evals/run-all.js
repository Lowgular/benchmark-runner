// const { readFileSync } = require('fs');

// const evaluatedPath = process.argv[2];
// console.log('Running evals for', evaluatedPath);

// function tokenize(str) {
//   return str.toLowerCase().replace(/['"]/g, '').split(/\s+/);
// }

// function score(expected, actual) {
//   const expectedTokens = tokenize(expected);
//   const actualTokens = new Set(tokenize(actual));
//   const matches = expectedTokens.filter((t) => actualTokens.has(t)).length;
//   return matches / expectedTokens.length;
// }

// function runEvals(evaluatedPath) {
//   const PASS_THRESHOLD = 0.9;
//   const evals = JSON.parse(readFileSync(evaluatedPath, 'utf8'));
//   const results = evals.map((e) => ({
//     level: e.level,
//     user: e.user,
//     score: score(e.expected, e.actual),
//     pass: score(e.expected, e.actual) >= PASS_THRESHOLD,
//   }));

//   const passed = results.filter((r) => r.pass).length;
//   console.log(`Results: ${passed}/${results.length} passed\n`);
//   results
//     .filter((r) => !r.pass)
//     .forEach((r) => {
//       console.log(`[level ${r.level}] score ${r.score.toFixed(2)} — ${r.user}`);
//     });
// }

// runEvals(evaluatedPath);
