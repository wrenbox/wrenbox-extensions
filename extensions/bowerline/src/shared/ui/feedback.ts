/** Toasts, downloads and clipboard helpers for extension pages. */
import { h } from './dom';

let current: { node: HTMLElement; timer: number } | null = null;

export function toast(message: string, action?: { label: string; run(): void }, ms = 5000): void {
  if (current) {
    window.clearTimeout(current.timer);
    current.node.remove();
  }
  const node = h(
    'div',
    { class: 'toast', role: 'status', 'aria-live': 'polite' },
    h('span', { text: message }),
  );
  if (action) {
    node.append(
      h('button', {
        type: 'button',
        text: action.label,
        onClick: () => {
          action.run();
          node.remove();
          current = null;
        },
      }),
    );
  }
  document.body.append(node);
  current = { node, timer: window.setTimeout(() => node.remove(), ms) };
}

/** Saves text as a file with a Blob and <a download>: no downloads permission needed. */
export function downloadText(text: string, fileName: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: fileName, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Reads a user-chosen file as text. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
