/** User-facing words for modes and types, in one place (US spelling). */
import type { CvdType, Mode } from './matrix';

export const TYPE_LABEL: Record<CvdType, string> = {
  protan: 'Red-weak',
  deutan: 'Green-weak',
  tritan: 'Blue-weak',
};

/** The medical term for each type, shown small next to the plain name. */
export const TYPE_TERM: Record<CvdType, string> = {
  protan: 'protan',
  deutan: 'deutan',
  tritan: 'tritan',
};

export const TYPE_COLOR_WORD: Record<CvdType, string> = {
  protan: 'red',
  deutan: 'green',
  tritan: 'blue',
};

export const MODE_LABEL: Record<Mode, string> = {
  correct: 'Correct colors',
  simulate: 'Simulate',
};

export const AMOUNT_LABEL: Record<Mode, string> = {
  correct: 'Strength',
  simulate: 'Severity',
};

/**
 * The pill shown on the page in Simulate mode: "Simulating green-blind vision"
 * at full severity, "Simulating green-weak vision (60%)" below it.
 */
export function simulationLabel(type: CvdType, severity: number): string {
  const word = TYPE_COLOR_WORD[type];
  if (severity >= 100) return `Simulating ${word}-blind vision`;
  return `Simulating ${word}-weak vision (${Math.round(severity)}%)`;
}
