function tokenize(str) {
  return str.toLowerCase().replace(/['"]/g, '').split(/\s+/);
}

function score(expected, actual) {
  const expectedTokens = tokenize(expected);
  const actualTokens = new Set(tokenize(actual));
  const matches = expectedTokens.filter((t) => actualTokens.has(t)).length;
  return matches / expectedTokens.length;
}

function runSingleEval(actual, expected, PASS_THRESHOLD = 0.9) {
  const s = score(expected, actual);
  return {
    score: s,
    pass: s >= PASS_THRESHOLD,
  };
}

module.exports = { runSingleEval, score, tokenize };
