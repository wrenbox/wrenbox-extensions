// A tiny client-side router: pushState navigation that re-renders the whole
// <body> content, the way many single-page apps do.
const views = {
  overview:
    '<div class="panel"><h1>Overview</h1><p class="sub">All systems</p><div class="dots"><div class="dot"><i style="background:#2f9e44"></i>Healthy</div><div class="dot"><i style="background:#d6303a"></i>Failing</div></div></div>',
  alerts:
    '<div class="panel"><h1>Alerts</h1><p style="color:#d6303a">2 critical</p><p style="color:#2f9e44">14 resolved</p></div>',
};
function render() {
  const route = location.pathname.split('/').pop() || 'overview';
  document.getElementById('app').innerHTML = views[route] ?? views.overview;
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-route]');
  if (!a) return;
  e.preventDefault();
  history.pushState({}, '', a.href);
  render();
});
addEventListener('popstate', render);
render();
