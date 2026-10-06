// Some sites (and some frameworks) rebuild <html>'s children, or strip
// elements they don't know. Huefinch must put its filter back each time.
let rounds = 0;
function strip() {
  rounds++;
  // Everything in <html> except head and body goes.
  for (const el of [...document.documentElement.children]) {
    if (el !== document.head && el !== document.body) el.remove();
  }
  if (rounds === 3) document.documentElement.replaceChildren(document.head, document.body);
  if (rounds < 6) setTimeout(strip, 50);
  else document.getElementById('status').textContent = 'Done';
}
addEventListener('load', () => setTimeout(strip, 50));
