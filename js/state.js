/* ═══════════════════════════════════════
   state.js — App state, localStorage, cross-tab sync
   Load this FIRST before all other JS files
═══════════════════════════════════════ */

var LS_KEY = 'vr_state_v2';

/* ── GLOBAL STATE ── */
var S = {
  cu: null,
  users: [
    { id:'U001', name:'Deep Daswani', email:'user@demo.com', pass:'demo123',
      role:'user', phone:'9876543210', vehicle:'scooter', model:'Ather 450X', location:'Ahmedabad' }
  ],
  dealers: [
    { id:'D001', name:'EV Power Hub', email:'dealer@demo.com', pass:'demo123',
      role:'dealer', phone:'9988776655', addr:'Satellite, Ahmedabad', bat:20, chg:15 }
  ],
  agents: [
    { id:'A001', name:'Rahul Shah', email:'delivery@demo.com', pass:'demo123',
      role:'delivery', phone:'9876543200', vehicle:'Motorcycle', area:'Ahmedabad',
      online:true, done:0, earn:0 }
  ],
  admin: { email:'admin@voltride.com', pass:'admin123', role:'admin', name:'Admin' },
  reqs:  [],
  rc:    1,
  inv:   { bat:20, chg:15 },
  curAppr:      null,
  agentOnline:  true,
  selPriority:  'normal',
  selStype:     'replacement',
  userLat: null, userLng: null, userAddr: null
};

/* ── SAVE TO LOCALSTORAGE ── */
function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      users:   S.users,
      dealers: S.dealers,
      agents:  S.agents,
      reqs:    S.reqs,
      rc:      S.rc,
      inv:     S.inv,
      _ts:     Date.now()
    }));
  } catch(e) {}
}

/* ── LOAD FROM LOCALSTORAGE ── */
function loadState() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    var snap = JSON.parse(raw);
    if (snap.users   && snap.users.length)   S.users   = snap.users;
    if (snap.dealers && snap.dealers.length) S.dealers = snap.dealers;
    if (snap.agents  && snap.agents.length)  S.agents  = snap.agents;
    if (snap.reqs)  S.reqs = snap.reqs;
    if (snap.rc)    S.rc   = snap.rc;
    if (snap.inv)   S.inv  = snap.inv;
  } catch(e) {}
}

/* ── CLEAR ALL DATA ── */
function clearState() {
  localStorage.removeItem(LS_KEY);
  location.reload();
}

/* ── SAVE LOGGED-IN USER SESSION ── */
function saveSession(user) {
  try { localStorage.setItem('vr_session', JSON.stringify(user)); } catch(e) {}
}
function loadSession() {
  try {
    var raw = localStorage.getItem('vr_session');
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}
function clearSession() {
  localStorage.removeItem('vr_session');
}

/* ── CROSS-TAB REAL-TIME SYNC ──
   When any tab saves data, all other tabs receive a 'storage' event
   and reload state + refresh the current view automatically.
── */
window.addEventListener('storage', function(e) {
  if (e.key !== LS_KEY || !e.newValue) return;
  loadState();
  if (typeof liveRefresh === 'function') liveRefresh();
  if (typeof showSyncBadge === 'function') showSyncBadge();
});

/* Polling fallback every 3s — only on dashboard pages */
setInterval(function() {
  var page = window.location.pathname;
  if (page.indexOf('dashboard-') === -1) return; // skip landing/login/register
  try {
    var snap = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (!snap.reqs) return;
    var sig1 = snap.reqs.map(function(r) { return r.id + r.status; }).join('|');
    var sig2 = S.reqs.map(function(r) { return r.id + r.status; }).join('|');
    if (sig1 !== sig2 || snap.reqs.length !== S.reqs.length) {
      loadState();
      if (typeof liveRefresh === 'function') liveRefresh();
    }
  } catch(e) {}
}, 3000);

/* ── REDIRECT IF NOT LOGGED IN ──
   Call this at top of each dashboard page
── */
function requireAuth(expectedRole) {
  loadState();
  var session = loadSession();
  if (!session) { window.location.href = 'login.html'; return null; }

  // Try to find in localStorage first
  var all = S.users.concat(S.dealers).concat(S.agents);
  if (session.role === 'admin') all.push(S.admin);
  var found = all.find(function(u) { return u.email === session.email; });

  if (found) {
    // Found in localStorage — use it
    S.cu = found;
    _checkRoleAndInit(expectedRole);
  } else {
    // NOT in localStorage (registered via website, only in DB)
    // Use session data immediately so page loads, then refresh from DB
    S.cu = session;
    _checkRoleAndInit(expectedRole);
    // Fetch fresh data from DB in background to get correct ID
    if (typeof USE_API !== 'undefined' && USE_API) {
      fetch('api/user_get.php?email=' + encodeURIComponent(session.email))
        .then(function(r) { return r.json(); })
        .then(function(res) {
          if (res && res.status === 'ok' && res.user) {
            S.cu = res.user;
            saveSession(res.user);
            // Add to S.agents/users/dealers so future loads find them
            if (res.user.role === 'delivery') {
              var exists = S.agents.find(function(a){ return a.id === res.user.id; });
              if (!exists) S.agents.push(res.user);
            } else if (res.user.role === 'user') {
              var exists = S.users.find(function(u){ return u.id === res.user.id; });
              if (!exists) S.users.push(res.user);
            } else if (res.user.role === 'dealer') {
              var exists = S.dealers.find(function(d){ return d.id === res.user.id; });
              if (!exists) S.dealers.push(res.user);
            }
            saveState();
            // Refresh dashboard now that we have correct ID
            if (typeof liveRefresh === 'function') liveRefresh();
          }
        })
        .catch(function() {});
    }
  }

  return S.cu;
}

function _checkRoleAndInit(expectedRole) {
  if (expectedRole && S.cu.role !== expectedRole) {
    var map = { user:'dashboard-user.html', dealer:'dashboard-dealer.html',
                delivery:'dashboard-delivery.html', admin:'dashboard-admin.html' };
    window.location.href = map[S.cu.role] || 'login.html';
  }
}

/* ── LIVE REFRESH CURRENT VIEW ── */
function liveRefresh() {
  if (!S.cu) return;
  var r = S.cu.role;
  if (r === 'user'     && typeof refreshUStats     === 'function') { refreshUStats(); renderUOrders(); }
  if (r === 'dealer'   && typeof refreshDStats     === 'function') { refreshDStats(); renderDReqs(); renderDDeliveries(); }
  if (r === 'delivery' && typeof refreshAStats     === 'function') { refreshAStats(); renderAAssign(); renderAHist(); }
  if (r === 'admin'    && typeof refreshAdm        === 'function') { refreshAdm(); renderAdmReqs(); renderAdmUsers(); renderAdmDealers(); renderAdmAgents(); }
}

/* Load state on every page load */
loadState();
