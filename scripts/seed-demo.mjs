// Seeds a demo class through the public API: a teacher, the linear-equations sample, eight learners,
// and the circles and checked work a real lesson leaves behind (two clear misconceptions, one word
// problem most learners solved after hints). Prints a link that opens the teacher dashboard on this device.
// Usage: node scripts/seed-demo.mjs [baseUrl]

const [baseUrl = "http://localhost:3000"] = process.argv.slice(2);

async function api(path, { method = "GET", body, teacherKey } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(teacherKey ? { "x-teacher-key": teacherKey } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const LOOPS = {
  1: { x: 150, y: 408, w: 285, h: 58 },
  2: { x: 150, y: 556, w: 375, h: 60 },
  3: { x: 148, y: 700, w: 255, h: 112 },
  5: { x: 140, y: 1118, w: 960, h: 108 },
};

// Who circled what, and what the tutor read there.
const ASKS = [
  ["Mali", 1, "3x + 7 = 22", "two-step equations", 3, false],
  ["Ben", 1, "3x + 7 = 22", "two-step equations", 2, true],
  ["Aom", 1, "3x + 7 = 22", "two-step equations", 3, false],
  ["Kai", 2, "5(x − 2) = 3x + 4", "equations with brackets", 3, false],
  ["Nina", 2, "5(x − 2) = 3x + 4", "equations with brackets", 4, false],
  ["Tan", 2, "5(x − 2) = 3x + 4", "equations with brackets", 2, false],
  ["Aom", 2, "5(x − 2) = 3x + 4", "equations with brackets", 3, false],
  ["June", 5, "earned 150 baht more on Saturday", "writing equations from words", 2, true],
  ["Arun", 5, "earned 150 baht more on Saturday", "writing equations from words", 3, true],
  ["Nat", 3, "x/4 + 3 = 9", "equations with fractions", 1, true],
];

// Checked work: the line the slip was on, and what A-Note said went wrong.
const CHECKS = [
  ["Mali", 1, "3x = 22 + 7", "7 was added to both sides instead of subtracted.", false],
  ["Aom", 1, "3x = 29", "7 was added instead of subtracted, so 3x should not be 29.", false],
  ["Kai", 2, "5x − 2 = 3x + 4", "The 5 was multiplied by x but not by the −2 inside the brackets.", false],
  ["Nina", 2, "5x − 2 = 3x + 4", "Only x was multiplied by 5; the −2 also needs multiplying.", false],
  ["Tan", 2, "5x − 7 = 3x + 4", "The −2 was multiplied by 5 incorrectly: 5 × −2 is not −7.", false],
  ["Ben", 1, "x = 5", "", true],
  ["June", 4, "x = 5", "", true],
];

const teacher = await api("/api/classes", { method: "POST", body: { name: "Grade 7/2 · Mathematics", teacherName: "Kru Ploy" } });
const { code, teacherKey } = teacher;
const assignment = await api(`/api/classes/${code}/assignments`, { method: "POST", teacherKey, body: { sampleId: "linear-equations" } });

const names = [...new Set([...ASKS.map((a) => a[0]), ...CHECKS.map((c) => c[0])]), "Pim"];
const students = {};
for (const name of names) students[name] = (await api(`/api/classes/${code}/join`, { method: "POST", body: { name } })).student.id;

const jitter = (box) => ({ x: box.x + Math.random() * 16 - 8, y: box.y + Math.random() * 10 - 5, w: box.w + Math.random() * 20 - 10, h: box.h + Math.random() * 10 - 5 });

for (const [name, q, circled, topic, hints, solved] of ASKS) {
  const studentId = students[name];
  const { id } = await api("/api/asks", { method: "POST", body: { code, studentId, assignmentId: assignment.id, loop: jitter(LOOPS[q]) } });
  await api(`/api/asks/${id}`, { method: "PATCH", body: { studentId, circled, topic, hintsSeen: hints, replies: solved ? 2 : 1, solved } });
}

const WORK_Y = { 1: 410, 2: 560, 4: 880 };
for (const [name, q, line, slip, correct] of CHECKS) {
  const studentId = students[name];
  const loop = { x: 560, y: WORK_Y[q], w: 320, h: 120 };
  const { id } = await api("/api/asks", { method: "POST", body: { code, studentId, assignmentId: assignment.id, loop, kind: "check" } });
  await api(`/api/asks/${id}`, { method: "PATCH", body: { studentId, circled: line, topic: `Question ${q}`, slip: slip || null, solved: correct } });
}

const seat = encodeURIComponent(JSON.stringify({ code, name: "Grade 7/2 · Mathematics", teacherKey }));
console.log(`Class ${code}: ${names.length} learners, ${ASKS.length} circles, ${CHECKS.length} checked answers`);
console.log(`Teacher dashboard (opens on this device): ${baseUrl}/teacher#seat=${seat}`);
console.log(`Learners join at ${baseUrl}/join?code=${code}`);
