// A real <video> element, fed by an animated canvas (no media file needed),
// and a long page of colored tiles for scroll measurements.
const canvas = document.createElement('canvas');
canvas.width = 640;
canvas.height = 360;
const ctx = canvas.getContext('2d');
let t = 0;
function draw() {
  t++;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `hsl(${(i * 45 + t * 2) % 360} 80% 50%)`;
    ctx.fillRect(i * 80, 0, 80, 360);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(320 + Math.sin(t / 20) * 200, 180, 40, 0, Math.PI * 2);
  ctx.fill();
  requestAnimationFrame(draw);
}
draw();
const video = document.getElementById('video');
video.srcObject = canvas.captureStream(30);
video.play().catch(() => {});

const tiles = document.getElementById('tiles');
for (let i = 0; i < 200; i++) {
  const d = document.createElement('div');
  d.className = 'tile';
  d.style.background = `hsl(${(i * 37) % 360} 70% 45%)`;
  d.textContent = `Tile ${i + 1}`;
  tiles.append(d);
}
