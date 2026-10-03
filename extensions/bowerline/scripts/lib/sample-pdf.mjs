/** The sample PDF offered on the onboarding page and in the empty viewer. */
import { makePdf } from './pdf-writer.mjs';

export function samplePdf() {
  return makePdf({
    title: 'Spaced retrieval study (Bowerline sample)',
    seed: 'bowerline-sample-v1',
    pages: [
      [
        { text: 'Spaced retrieval study', size: 22, bold: true },
        {
          text: 'A Bowerline sample PDF. Select any sentence and press H, or pick a colour in the toolbar.',
          size: 11,
          gap: 4,
        },
        { text: '1. Introduction', size: 15, bold: true, gap: 18 },
        {
          text: 'Students often reread their notes before an exam because rereading feels productive. The text becomes familiar, and familiarity is easily mistaken for knowing. This study asked a simple question: does pulling ideas back out of memory beat reading them again?',
        },
        {
          text: 'Four cohorts of students read the same short passages. Half then reread the passages; the other half closed the text and wrote down everything they could recall.',
        },
        { text: '2. Method', size: 15, bold: true, gap: 12 },
        {
          text: 'Each session lasted twenty minutes. Retrieval sessions were spaced two days apart for one group and run back to back for another. Recall was tested after one week and again after one month.',
        },
      ],
      [
        { text: '3. Results', size: 15, bold: true },
        {
          text: 'Across all four cohorts, students who practised retrieval recalled more material after one week than students who restudied the same passages for an equal time. The retrieval group retained 61% of key ideas at seven days, compared with 38% for the restudy group.',
        },
        {
          text: 'The advantage held when feedback was removed, although it narrowed. Participants consistently predicted the opposite outcome: most believed rereading had helped them more, despite scoring lower.',
        },
        {
          text: 'Spacing the retrieval sessions produced a further gain. Sessions separated by two days outperformed sessions completed back to back, and the gap widened at the one-month test.',
        },
      ],
      [
        { text: '4. Discussion', size: 15, bold: true },
        {
          text: 'These results suggest that the feeling of fluency during rereading is a poor guide to later memory. Instructors may get more value from short, frequent recall exercises than from additional reading assignments.',
        },
        {
          text: 'Limitations include the short study materials and the use of a single subject area. Future work should test longer texts and examine whether the benefit transfers to applied problems.',
        },
        {
          text: 'Taken together, the findings support building retrieval into routine study rather than treating it as a separate review stage before exams.',
        },
        {
          text: 'This sample is fictional and exists to demonstrate Bowerline.',
          size: 10,
          gap: 24,
        },
      ],
    ],
  });
}
