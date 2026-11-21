/* ═══════════════════════════════════════
   auth.js — Login, Register, Logout
   Requires: state.js, utils.js
═══════════════════════════════════════ */

/* ── LOGIN ── */
function doLogin() {
  var email = v('l-email');
  var pass  = v('l-pass');
  var alId  = 'login-alert';
  if (!email || !pass) { showAl(alId, 'err', 'Fill in email and password'); return; }

  // Try MySQL API first
  if (USE_API) {
    apiCall('login', { email: email, pass: pass }, function(res) {
      if (res && res.user) { finishLogin(res.user); }
      else showAl(alId, 'err', res ? (res.message || 'Invalid credentials') : 'Server error');
    }, function(err) { showAl(alId, 'err', err); });
    return;
  }

  // Offline: check localStorage state
  if (email === S.admin.email && pass === S.admin.pass) {
    finishLogin({ ...S.admin });
    return;
  }
  var all = S.users.concat(S.dealers).concat(S.agents);
  var found = all.find(function(u) { return u.email === email && u.pass === pass; });
  if (found) { finishLogin(found); }
  else showAl(alId, 'err', 'Invalid email or password. Try demo buttons below.');
}

function finishLogin(user) {
  S.cu = user;
  saveSession(user);
  var map = {
    user:     'dashboard-user.html',
    dealer:   'dashboard-dealer.html',
    delivery: 'dashboard-delivery.html',
    admin:    'dashboard-admin.html'
  };
  window.location.href = map[user.role] || 'index.html';
}

/* ── DEMO LOGIN ── */
function dLogin(role) {
  var user;
  if (role === 'user')     user = S.users[0];
  else if (role === 'dealer')   user = S.dealers[0];
  else if (role === 'delivery') user = S.agents[0];
  else user = { ...S.admin };
  finishLogin(user);
}

/* ── LOGOUT ── */
function doLogout() {
  S.cu = null;
  clearSession();
  toast('👋 Logged out');
  setTimeout(function() { window.location.href = 'index.html'; }, 800);
}

/* ── REGISTER ── */
function switchRegTab(t) {
  ['user', 'dealer', 'delivery'].forEach(function(x) {
    var form = document.getElementById('rf-' + x);
    var btn  = document.getElementById('rt-' + x);
    if (form) form.style.display = x === t ? 'block' : 'none';
    if (btn)  btn.classList.toggle('on', x === t);
  });
}

function regAs(t) { switchRegTab(t); }

function selVeh(type) {
  ['car','bike','scooter'].forEach(function(x) {
    var el = document.getElementById('vo-' + x);
    if (el) el.classList.remove('sel');
  });
  var sel = document.getElementById('vo-' + type);
  if (sel) sel.classList.add('sel');
  window._selVeh = type;
}

function doReg(role) {
  var alId = 'reg-alert';
  var obj;

  if (role === 'user') {
    var n = v('u-name'), ph = v('u-phone'), em = v('u-email'), ps = v('u-pass'), md = v('u-model');
    if (!n || !em || !ps) { showAl(alId, 'err', 'Fill required fields'); return; }
    if (ps.length < 6)    { showAl(alId, 'err', 'Password min 6 characters'); return; }
    obj = { id:'U'+String(S.users.length+1).padStart(3,'0'), name:n, phone:ph, email:em,
            pass:ps, role:'user', vehicle: window._selVeh||'scooter', model:md||'EV', location:'Ahmedabad' };
    S.users.push(obj);

  } else if (role === 'dealer') {
    var n = v('d-name'), em = v('d-email'), ps = v('d-pass'), ph = v('d-phone'),
        ad = v('d-addr'), bt = v('d-batt'), ch = v('d-charg');
    if (!n || !em || !ps) { showAl(alId, 'err', 'Fill required fields'); return; }
    obj = { id:'D'+String(S.dealers.length+1).padStart(3,'0'), name:n, email:em, pass:ps,
            phone:ph, addr:ad, role:'dealer', bat:parseInt(bt)||20, chg:parseInt(ch)||10 };
    S.dealers.push(obj);

  } else {
    var n = v('dl-name'), em = v('dl-email'), ps = v('dl-pass'), ph = v('dl-phone'),
        ve = v('dl-veh'), ar = v('dl-area');
    if (!n || !em || !ps) { showAl(alId, 'err', 'Fill required fields'); return; }
    obj = { id:'A'+String(S.agents.length+1).padStart(3,'0'), name:n, email:em, pass:ps,
            phone:ph, vehicle:ve, area:ar, role:'delivery', online:true, done:0, earn:0 };
    S.agents.push(obj);
  }

  saveState();
  apiCall('register', obj, null, null);
  showAl(alId, 'ok', '✅ Account created! Redirecting...');
  setTimeout(function() { finishLogin(obj); }, 1400);
}
