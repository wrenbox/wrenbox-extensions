/** Controls shared by the popup and the settings page. */
import { AMOUNT_LABEL, MODE_LABEL, TYPE_LABEL, TYPE_TERM } from '../labels';
import { CVD_TYPES, IDENTITY, feColorMatrixValues, type Mat3, type Mode } from '../matrix';
import { amountOf, type Settings } from '../settings';
import { h, svg } from './dom';

// --- Switch ---------------------------------------------------------------------

export interface SwitchControl {
  /** The <label class="switch"> to place in a row. */
  el: HTMLElement;
  input: HTMLInputElement;
  set(on: boolean, disabled?: boolean): void;
}

/**
 * A checkbox with role="switch". Its knob position shows the state; a hidden
 * "On"/"Off" word, linked with aria-describedby, says it in words.
 */
export function switchControl(
  id: string,
  label: string,
  onToggle: (on: boolean) => void,
): SwitchControl {
  const state = h('span', { class: 'sr-only', id: `${id}-state` }, 'Off');
  const input = h('input', {
    type: 'checkbox',
    role: 'switch',
    id,
    'aria-label': label,
    'aria-describedby': `${id}-state`,
  });
  const el = h('label', { class: 'switch' }, input, state);
  const sync = () => {
    state.textContent = input.checked ? 'On' : 'Off';
  };
  input.addEventListener('change', () => {
    sync();
    onToggle(input.checked);
  });
  return {
    el,
    input,
    set(on, disabled = false) {
      input.checked = on;
      input.disabled = disabled;
      sync();
    },
  };
}

// --- Color vision controls -----------------------------------------------------------

export interface VisionControls {
  el: HTMLElement;
  update(s: Settings): void;
}

/**
 * Mode (Correct colors / Simulate), type (red-, green-, blue-weak) and the
 * Strength / Severity slider. Every change is reported at once, so the page
 * filter follows the slider live.
 */
export function visionControls(
  prefix: string,
  onChange: (patch: Partial<Settings>) => void,
): VisionControls {
  let current: Settings | null = null;

  const modeInputs = (['correct', 'simulate'] as Mode[]).map((m) =>
    h('input', {
      type: 'radio',
      name: `${prefix}-mode`,
      value: m,
      onchange: () => onChange({ mode: m }),
    }),
  );
  const mode = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Mode' },
    ...modeInputs.map((input, i) =>
      h('label', null, input, MODE_LABEL[i === 0 ? 'correct' : 'simulate']),
    ),
  );

  const typeLegend = h('p', { class: 'field-label', id: `${prefix}-type-label` });
  const typeInputs = CVD_TYPES.map((t) =>
    h('input', {
      type: 'radio',
      name: `${prefix}-type`,
      value: t,
      onchange: () => onChange({ type: t }),
    }),
  );
  const types = h(
    'div',
    { class: 'options', role: 'radiogroup', 'aria-labelledby': `${prefix}-type-label` },
    ...typeInputs.map((input, i) => {
      const t = CVD_TYPES[i]!;
      return h(
        'label',
        { class: 'option' },
        input,
        h('span', null, TYPE_LABEL[t]),
        h('span', { class: 'term' }, TYPE_TERM[t]),
      );
    }),
  );

  const sliderLabel = h('label', { class: 'field-label', for: `${prefix}-amount` });
  const slider = h('input', { type: 'range', id: `${prefix}-amount`, min: 0, max: 100, step: 5 });
  let pending: number | null = null;
  const paint = () => {
    const v = Number(slider.value);
    slider.style.setProperty('--fill', `${v}%`);
    slider.setAttribute('aria-valuetext', `${v}%`);
    if (current) sliderLabel.textContent = `${AMOUNT_LABEL[current.mode]}: ${v}%`;
  };
  slider.addEventListener('input', () => {
    paint();
    // At most one write per frame while dragging.
    if (pending !== null) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      if (!current) return;
      const v = Number(slider.value);
      onChange(current.mode === 'simulate' ? { severity: v } : { strength: v });
    });
  });

  const el = h(
    'div',
    { class: 'vision' },
    mode,
    typeLegend,
    types,
    h('div', { class: 'amount' }, sliderLabel, slider),
  );
  return {
    el,
    update(s) {
      current = s;
      modeInputs.forEach((i) => (i.checked = i.value === s.mode));
      typeInputs.forEach((i) => (i.checked = i.value === s.type));
      typeLegend.textContent = s.mode === 'simulate' ? 'Simulate this vision' : 'My color vision';
      if (document.activeElement !== slider || pending === null) slider.value = String(amountOf(s));
      paint();
    },
  };
}

// --- A recoloring preview inside an extension page --------------------------------

/**
 * Huefinch's own pages aren't web pages, so the content script doesn't run on
 * them. Previews use the same SVG filter technique on part of the page.
 * Several matrices are applied in order, each clamped, like the browser does
 * with chained filter primitives (e.g. correct, then simulate).
 */
export class PreviewFilter {
  readonly url: string;
  private readonly filter: SVGElement;

  constructor(id: string) {
    this.url = `url(#${id})`;
    this.filter = svg('filter', { id, 'color-interpolation-filters': 'linearRGB' });
    const box = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true' }, this.filter);
    (box as SVGSVGElement).style.position = 'absolute';
    document.body.append(box);
  }

  set(matrices: Mat3[]): void {
    // An empty SVG filter would paint nothing at all; identity shows the original.
    if (!matrices.length) matrices = [IDENTITY];
    this.filter.replaceChildren(
      ...matrices.map((m) =>
        svg('feColorMatrix', { type: 'matrix', values: feColorMatrixValues(m) }),
      ),
    );
  }
}
