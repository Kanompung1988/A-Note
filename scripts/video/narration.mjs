// The demo video, scene by scene: what the voiceover says, the label on screen, and which Meta models
// are at work. voice.mjs speaks `say`; compose.mjs shows `label`, `models` and the captions.

export const VOICE = {
  id: "Xb7hH8MSUJpSbSDYk0k2", // ElevenLabs premade "Alice": clear, engaging educator
  model: "eleven_multilingual_v2",
  settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true, speed: 1.06 },
};

// Each scene's voice starts LEAD seconds in and the picture holds TAIL seconds after it ends.
export const LEAD = 0.45;
export const TAIL = 0.9;

// Spoken text that should read differently in the captions.
export const CAPTION_FIXES = [["SAM three point one", "SAM 3.1"]];

export const SCENES = [
  {
    id: "hook",
    card: true,
    // card cues: an element turns on when the voice reaches this phrase
    cues: { teacher: "one teacher", forty: "forty", ones: "The ones", finds: "and the teacher finds" },
    say: "In Thailand, one teacher often has forty learners. The ones who need help most never raise their hand, and the teacher finds out at the test, weeks later.",
  },
  {
    id: "title",
    card: true,
    cues: { platform: "AI-powered", teachers: "for teachers", learners: "and learners", meta: "built on" },
    say: "This is A-Note: an AI-powered classroom learning platform, for teachers and learners, built on Meta's models.",
  },
  {
    id: "create",
    side: "teacher",
    label: "Create a worksheet in one line",
    models: ["Muse Spark", "Muse Image", "Muse Wonder"],
    say: "For teachers, a worksheet starts with one line. Muse Spark writes the questions and a private answer key. Muse Image draws the scene. Then Muse Wonder solves every question again, on its own, so only answers both models agree on reach the class. Review it, and assign it in one tap.",
  },
  {
    id: "ask",
    side: "learner",
    label: "Circle to ask",
    models: ["SAM 3.1", "Muse Spark", "Muse Image"],
    say: "For learners, it's a worksheet and a pen. Stuck? Draw a circle. SAM three point one outlines exactly what they meant, and the tutor pins a hint right on the page: one step at a time, and never the answer, even when they ask for it. Tap Show me, and Muse Image draws the idea.",
  },
  {
    id: "check",
    side: "learner",
    label: "Check my work",
    models: ["Muse Spark"],
    say: "Finished? Check my work. A-Note reads the handwriting line by line, and circles the first slip in red pen, just like a teacher would: a nudge, not the answer. Fix it, check again, and every line gets a tick. Then hand it in, and the page follows them to any device.",
  },
  {
    id: "dashboard",
    side: "teacher",
    label: "The live class dashboard",
    models: ["SAM 3.1", "Muse Spark"],
    say: "Every circle and every checked answer lands on the teacher's live dashboard: where the class is stuck, who slipped, and who has handed in. Open any page, see the working, and send a note back.",
  },
  {
    id: "copilot",
    side: "teacher",
    label: "The class co-pilot",
    models: ["Muse Spark · tool calling", "Muse Wonder"],
    say: "Then, the co-pilot: an agent built on Muse Spark tool calling. It reads the class, groups learners by misconception, and writes practice for each group. It can't skip verification: its own tool refuses any sheet Muse Wonder can't confirm. Practice goes only to the learners who need it, with a ten-minute plan for tomorrow.",
  },
  {
    id: "foryou",
    side: "learner",
    label: "Practice made for them",
    models: ["Muse Spark", "Muse Wonder"],
    say: "Next lesson, those learners find it waiting: made for them.",
  },
  {
    id: "platform",
    side: "both",
    label: "A full classroom",
    models: [],
    say: "And around it, a full classroom: a real whiteboard, worksheets from any photo or PDF, and every learner's progress, with the skills to practise next.",
  },
  {
    id: "trust",
    card: true,
    cues: { check: "checking", zero: "leaked zero", slip: "found the exact" },
    say: "Five Meta models, checking each other. In our eval, the tutor leaked zero answers out of twelve, and found the exact slip ten times out of ten.",
  },
  {
    id: "close",
    card: true,
    tail: 2.6,
    cues: { heard: "Every learner", sharper: "Every lesson", try: "Try it" },
    say: "A-Note. Every learner heard. Every lesson sharper. Try it today, no sign-up needed.",
  },
];
