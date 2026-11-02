import "server-only";
import type { AnswerKey } from "@/lib/store/types";

// Answer keys for the sample worksheets. Server-only: learners never receive them, but the tutor
// uses them so its hints and checks lead to the right answer.

const item = (n: number, prompt: string, answer: string, steps: string[], skill: string) => ({ n, prompt, answer, steps, skill, verified: true });

export const SAMPLE_KEYS: Record<string, AnswerKey> = {
  "linear-equations": {
    items: [
      item(1, "3x + 7 = 22", "x = 5", ["Subtract 7 from both sides: 3x = 15", "Divide both sides by 3: x = 5"], "two-step equations"),
      item(2, "5(x − 2) = 3x + 4", "x = 7", ["Expand: 5x − 10 = 3x + 4", "Subtract 3x: 2x − 10 = 4", "Add 10: 2x = 14", "Divide by 2: x = 7"], "equations with brackets"),
      item(3, "x/4 + 3 = 9", "x = 24", ["Subtract 3: x/4 = 6", "Multiply both sides by 4: x = 24"], "equations with fractions"),
      item(4, "2x − 3 = −x + 12", "x = 5", ["Add x to both sides: 3x − 3 = 12", "Add 3: 3x = 15", "Divide by 3: x = 5"], "variables on both sides"),
      item(
        5,
        "A som tam stall earned 150 baht more on Saturday than on Sunday. Over both days it earned 1,250 baht. How much did it earn on Sunday?",
        "550 baht",
        ["Let Sunday be s, so Saturday is s + 150", "s + (s + 150) = 1250", "2s = 1100", "s = 550"],
        "writing equations from words",
      ),
      item(6, "The rectangle (sides x + 3 cm and 8 cm) has a perimeter of 46 cm. Find x.", "x = 12", ["Perimeter = 2(x + 3) + 2(8) = 46", "2x + 6 + 16 = 46", "2x = 24", "x = 12"], "perimeter equations"),
    ],
  },
  "simple-circuits": {
    items: [
      item(1, "Is Circuit 1 a series circuit or a parallel circuit? How can you tell?", "Series: there is only one path, so the current goes through A and B one after the other.", ["Trace the wire from the battery", "There is a single loop with no branches"], "series vs parallel"),
      item(2, "The switch in Circuit 1 is open. Do bulbs A and B light up? Why?", "No. An open switch breaks the only path, so no current flows.", ["An open switch makes a gap", "Current needs a complete loop"], "open and closed circuits"),
      item(3, "In Circuit 1 the switch is closed and bulb A breaks. What happens to B?", "B goes out, because a broken bulb breaks the single series path.", ["A broken bulb is a gap in the loop", "In series there is no other path"], "series circuits"),
      item(4, "In Circuit 2, bulb C breaks. Does bulb D stay on? Explain.", "Yes. C and D are in parallel, so D still has its own complete path.", ["Find the branches in Circuit 2", "Each bulb has its own loop back to the battery"], "parallel circuits"),
      item(5, "Which kind of circuit is better for the lights in a house? Why?", "Parallel, so each light works on its own and one broken bulb doesn't turn the others off.", ["Think about what happens when one bulb breaks", "Compare series and parallel"], "applying circuit types"),
    ],
  },
  "mangrove-reading": {
    items: [
      item(1, 'What does the word "tangled" tell you about the roots?', "They are twisted together and grow in a messy, crossing mass.", ["Find 'tangled' in the first paragraph", "Picture roots that cross over each other"], "vocabulary in context"),
      item(2, "Why can mangrove trees breathe when the tide is high?", "Their roots rise above the mud like stilts, so part of them stays out of the water.", ["Find the sentence about breathing", "Look at what the roots do"], "finding details"),
      item(3, 'The writer calls mangroves "a natural sea wall". What does this mean?', "They protect the shore like a wall by slowing down waves during storms.", ["What does a sea wall do?", "Find what the roots do to waves"], "figurative language"),
      item(4, "Find one cause and its effect in the second paragraph.", "Cause: mangroves were cleared for shrimp farms. Effect: the shore eroded quickly.", ["Look for 'without the trees'", "Ask: what happened, and why?"], "cause and effect"),
    ],
  },
};
