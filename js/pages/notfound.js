import { boot, icon } from '../ui.js';
boot({ page: '404.html', title: 'Not found', gated: false, render(view) { view.innerHTML = `<div class="empty">${icon('target')}<h2>Missed!</h2><p>That page doesn’t exist.</p><a class="btn primary" href="index.html">Go home</a></div>`; } });
