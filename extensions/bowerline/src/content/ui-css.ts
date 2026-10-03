/** Scoped styles for the in-page UI (adopted by the closed shadow root only). */
export const UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.toolbar, .editor, .card, .toast, .marker {
  pointer-events: auto;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: normal;
  text-transform: none;
}
.toolbar {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  background: #18214D;
  color: #fff;
  border-radius: 999px;
  box-shadow: 0 10px 28px rgba(24, 33, 77, 0.28), 0 2px 6px rgba(24, 33, 77, 0.18);
  font-size: 13px;
  line-height: 1;
  animation: pop 120ms ease-out;
  white-space: nowrap;
}
.swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid rgba(24, 33, 77, 0.0);
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.swatch[aria-pressed="true"] { box-shadow: 0 0 0 2px #18214D, 0 0 0 4px #fff; }
.swatch:hover { transform: scale(1.08); }
.sep { width: 1px; height: 20px; background: rgba(255, 255, 255, 0.28); margin: 0 2px; }
.btn {
  appearance: none;
  background: transparent;
  color: inherit;
  border: 0;
  margin: 0;
  padding: 6px 7px;
  border-radius: 8px;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}
.toolbar .btn:hover, .toast .btn:hover { background: rgba(255, 255, 255, 0.14); }
.arrow {
  position: absolute;
  bottom: -5px;
  width: 10px;
  height: 10px;
  background: #18214D;
  transform: rotate(45deg);
  border-radius: 2px;
}
.toolbar.below .arrow { bottom: auto; top: -5px; }
button:focus-visible, textarea:focus-visible {
  outline: 2px solid #FFE14D;
  outline-offset: 2px;
}
.editor {
  position: fixed;
  width: 300px;
  padding: 12px;
  background: #fff;
  color: #18214D;
  border: 1px solid #DCE1EC;
  border-left: 4px solid var(--tint);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(24, 33, 77, 0.22);
  font-size: 13px;
  line-height: 1.4;
  animation: pop 120ms ease-out;
}
.editor-head { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 8px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--tint); box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
textarea {
  display: block;
  width: 100%;
  min-height: 72px;
  resize: vertical;
  padding: 8px 10px;
  border: 1px solid #DCE1EC;
  border-radius: 10px;
  font: inherit;
  color: inherit;
  background: #F4F6FB;
}
textarea:focus { outline: 2px solid #2C3870; outline-offset: 0; background: #fff; }
.editor-actions { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.hint { flex: 1; color: #5D6690; font-size: 11.5px; }
.btn.ghost { color: #2C3870; }
.btn.ghost:hover { background: #F4F6FB; }
.btn.primary { background: #18214D; color: #fff; padding: 7px 12px; }
.btn.primary:hover { background: #2C3870; }
.editor button:focus-visible, .editor textarea:focus-visible { outline-color: #2C3870; }
.marker {
  position: fixed;
  width: 15px;
  height: 15px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 5px;
  border: 1.5px solid #18214D;
  background: var(--tint);
  color: #18214D;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(24, 33, 77, 0.3);
}
.marker:hover { transform: scale(1.12); }
.marker:focus-visible { outline: 2px solid #2C3870; outline-offset: 2px; }
.card {
  position: fixed;
  max-width: 260px;
  padding: 10px 14px 12px;
  background: color-mix(in srgb, var(--tint) 30%, #fff);
  color: #18214D;
  border-left: 4px solid color-mix(in srgb, var(--tint) 80%, #18214D);
  border-radius: 4px 10px 10px 4px;
  box-shadow: 0 10px 26px rgba(24, 33, 77, 0.18);
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  animation: pop 120ms ease-out;
}
.card-label { font-weight: 700; font-size: 12px; margin-bottom: 3px; color: #18214D; }
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 10px 14px;
  background: #18214D;
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(24, 33, 77, 0.3);
  font-size: 13.5px;
  line-height: 1.4;
}
.btn.link { color: #FFE14D; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
@keyframes pop { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.toast { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .toolbar, .editor, .card { animation: none; }
  .swatch:hover, .marker:hover { transform: none; }
}
@media (forced-colors: active) {
  .toolbar, .editor, .card, .toast { border: 1px solid CanvasText; }
}
`;
