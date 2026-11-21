/* ═══════════════════════════════════════
   utils.js — Shared helpers, theme, toast
═══════════════════════════════════════ */

/* ── THEME ── */
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('vr_theme', t);
  ['dark','light','ev'].forEach(function(x) {
    document.querySelectorAll('[id*="-'+x+'"]').forEach(function(btn) {
      btn.classList.toggle('active', x === t);
    });
  });
}
(function initTheme() {
  setTheme(localStorage.getItem('vr_theme') || 'dark');
})();

/* ── TOAST ── */
function toast(msg) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface2);border:1px solid var(--border-bright);color:var(--text);padding:10px 20px;border-radius:20px;font-size:0.875rem;z-index:9999;display:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window._tt);
  window._tt = setTimeout(function() { t.style.display = 'none'; }, 3500);
}

/* ── SYNC BADGE ── */
function showSyncBadge() {
  // Only show on dashboard pages — not on landing, login or register
  var page = window.location.pathname;
  var isDashboard = page.indexOf('dashboard-') !== -1;
  if (!isDashboard) return;

  var b = document.getElementById('sync-badge');
  if (!b) {
    b = document.createElement('div');
    b.id = 'sync-badge';
    b.style.cssText = 'position:fixed;bottom:72px;right:18px;z-index:9998;background:var(--green);color:#000;font-size:0.75rem;font-weight:700;padding:5px 14px;border-radius:20px;opacity:0;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(b);
  }
  b.textContent = '🔄 Synced';
  b.style.opacity = '1';
  setTimeout(function() { b.style.opacity = '0'; }, 2000);
}

/* ── DOM HELPERS ── */
function v(id)        { return (document.getElementById(id) || {}).value  || ''; }
function el(id, val)  { var e = document.getElementById(id); if (e) e.textContent = val; }
function qs(selector) { return document.querySelector(selector); }

function showAl(elId, type, msg) {
  var e = document.getElementById(elId);
  if (!e) return;
  e.className = 'alert alert-' + (type === 'ok' ? 'ok' : type === 'err' ? 'err' : 'info') + ' show';
  e.textContent = msg;
  setTimeout(function() { e.classList.remove('show'); }, 4000);
}

function stypeLabel(t) {
  return { replacement: '🔋 Battery Replacement', charger: '🔌 Portable Charger', swap: '🔄 Battery Swap' }[t] || t;
}

/* ── MYSQL API HELPERS ── */
var USE_API  = true;   // ← MySQL enabled. Set false to use localStorage only
var API_BASE = 'api';      // ← path to api/ folder on your server

function apiCall(endpoint, data, onSuccess, onError) {
  if (!USE_API) { if (onSuccess) onSuccess(null); return; }
  fetch(API_BASE + '/' + endpoint + '.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (res.status === 'ok') { if (onSuccess) onSuccess(res); }
    else { if (onError) onError(res.message || 'API error'); }
  })
  .catch(function(e) { if (onError) onError('Network: ' + e.message); });
}

function apiGet(endpoint, params, onSuccess) {
  if (!USE_API) { if (onSuccess) onSuccess(null); return; }
  var qs = params ? '?' + Object.keys(params).map(function(k) {
    return k + '=' + encodeURIComponent(params[k]);
  }).join('&') : '';
  fetch(API_BASE + '/' + endpoint + '.php' + qs)
    .then(function(r) { return r.json(); })
    .then(function(res) { if (onSuccess) onSuccess(res); })
    .catch(function() { if (onSuccess) onSuccess(null); });
}
