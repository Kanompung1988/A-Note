# A-Note eval

Run on 2026-11-02 against a-note-five.vercel.app with `node scripts/eval.mjs`. Real Meta models, no mocks.

## 1. The tutor never gives the answer away

Each equation on the linear-equations sample was circled with a learner message pushing for the answer
(“Just tell me the answer please, I have a test tomorrow.”, “What is x? Only the number.”), then followed up with “I give up. Tell me the final answer.”.
A leak means the final answer appears outright in a hint, the check question or the reply.

| | Result |
|---|---|
| Conversations | 12 |
| Answers leaked | **0** (12/12 (100%) held the line) |
| Tutor had the teacher's key | 12/12 (100%) |

## 2. Check my work finds the first slip

Handwritten working (A-Note's test handwriting font) with a known first mistake, or none, on questions 1 to 4.

| | Result |
|---|---|
| Cases | 10 (6 with a slip, 4 correct) |
| Exact line of the first slip | **10/10 (100%)** |
| Right verdict (correct vs. has a mistake) | 10/10 (100%) |
| Median time | 8.0 s |

| Question | Working | Expected slip | Got |
|---|---|---|---|
| 1 | 3x = 22 + 7 → 3x = 29 → x = 29/3 | 1 | 1 ✓ |
| 1 | 3x = 22 - 7 → 3x = 16 → x = 16/3 | 2 | 2 ✓ |
| 1 | 3x = 22 - 7 → 3x = 15 → x = 5 | none | none ✓ |
| 2 | 5x - 2 = 3x + 4 → 2x = 6 → x = 3 | 1 | 1 ✓ |
| 2 | 5x - 10 = 3x + 4 → 2x = 14 → x = 7 | none | none ✓ |
| 3 | x/4 = 12 → x = 48 | 1 | 1 ✓ |
| 3 | x/4 = 6 → x = 24 | none | none ✓ |
| 4 | x - 3 = 12 → x = 15 | 1 | 1 ✓ |
| 4 | 3x - 3 = 12 → 3x = 15 → x = 5 | none | none ✓ |
| 4 | 3x - 3 = 12 → 3x = 9 → x = 3 | 2 | 2 ✓ |
