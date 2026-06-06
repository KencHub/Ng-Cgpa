// ── queryMatcher.js ───────────────────────────────────────────────────────────
// Matches a user query to the best knowledge base entry using weighted scoring.
//
// Scoring algorithm:
//   For each KB entry, iterate its keywords array:
//     Multi-word phrase match in normalised query: +4 (strongest signal)
//     Single-word keyword exact match in query:    +2
//     Partial match (prefix overlap between query token and keyword): +1
//   Raw score is multiplied by the entry's weight field.
//
// The entry with the highest weighted score is returned, provided it exceeds
// the minimum threshold. Below the threshold returns null (no match).
//
// No external dependencies. No state. Pure function.

const MIN_SCORE = 1;

// Common words excluded from partial matching to avoid false positives.
const STOP_WORDS = new Set([
   "what", "how", "does", "will", "can", "the", "my", "your",
  "with", "from", "this", "that", "have", "for", "are", "not",
  "when", "were", "which", "about", "would", "could", "should",
  "just", "like", "some", "than", "then", "also", "very", "much",
  "more", "still", "only", "even", "into", "onto", "upon", "after",
  "before", "during", "while", "since", "its", "too", "all",
  "being", "been", "has", "was", "did",
]);


// ── Normalise ─────────────────────────────────────────────────────────────────

function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ── Tokenise ──────────────────────────────────────────────────────────────────

function tokenise(text) {
  return normalise(text)
    .split(" ")
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}


// ── matchQuery ────────────────────────────────────────────────────────────────

/**
 * Returns the best matching knowledge base entry for the given user message.
 *
 * @param   {string} userMessage
 * @param   {Array}  knowledgeBase  Array of KB entries (id, keywords, weight, generateResponse)
 * @returns {Object|null}           Best matching entry, or null if no match
 */
export function matchQuery(userMessage, knowledgeBase) {
  if (!userMessage || !Array.isArray(knowledgeBase)) return null;

  const normQuery   = normalise(userMessage);
  const queryTokens = tokenise(userMessage);

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of knowledgeBase) {
    if (!Array.isArray(entry.keywords) || entry.keywords.length === 0) continue;

    let rawScore = 0;

    for (const keyword of entry.keywords) {
      const normKW = normalise(keyword);

      // Multi-word phrase match — strongest signal, scored and move on
      if (normKW.includes(" ")) {
        if (normQuery.includes(normKW)) {
          rawScore += 4;
          continue;
        }
        // Partial phrase: check if most words of the phrase appear in the query
        const phraseWords = normKW.split(" ").filter(w => !STOP_WORDS.has(w));
        if (phraseWords.length >= 2) {
          const hits = phraseWords.filter(w => normQuery.includes(w)).length;
          if (hits >= Math.ceil(phraseWords.length * 0.75)) {
            rawScore += 2;
          }
        }
        continue;
      }

      // Single-word keyword: exact substring match in query
      if (normQuery.includes(normKW)) {
        rawScore += 2;
        continue;
      }

      // Partial match: query token starts with keyword or keyword starts with token
      for (const token of queryTokens) {
        if (
          token.length > 3 &&
          (token.startsWith(normKW) || normKW.startsWith(token))
        ) {
          rawScore += 1;
          break; // Count each keyword at most once via partial match
        }
      }
    }

    const weightedScore = rawScore * (entry.weight || 1);

    if (weightedScore > bestScore) {
      bestScore = weightedScore;
      bestEntry = entry;
    }
  }

  return bestScore >= MIN_SCORE ? bestEntry : null;
}