/* ═══════════════════════════════════════
   admin.js — Admin dashboard logic
   Requires: state.js, utils.js, maps.js
═══════════════════════════════════════ */

function dsAdmin(sec, sideEl) {
  document.querySelectorAll('[id^="ad-"]').forEach(function(s){ s.classList.remove('on'); });
  var target = document.getElementById('ad-' + sec);
  if (target) target.classList.add('on');
  document.querySelectorAll('.sidebar .sitem').forEach(function(i){ i.classList.remove('on'); });
  if (sideEl) sideEl.classList.add('on');
  if (sec === 'home')    refreshAdm();
  if (sec === 'users')   renderAdmUsers();
  if (sec === 'dealers') renderAdmDealers();
  if (sec === 'allreq')  renderAdmReqs();
  if (sec === 'agents')  renderAdmAgents();
 if (sec === 'sysmap')  fetchAdminData(function(){ setTimeout(initSysMap, 100); });
}

function refreshAdm() {
  el('a-users',    S.users.length);
  el('a-dealers',  S.dealers.length);
  el('a-agents',   S.agents.length);
  el('a-reqs',     S.reqs.length);
  el('a-live-pend',S.reqs.filter(function(r){ return r.status==='pending'; }).length);
  el('a-live-del', S.reqs.filter(function(r){ return r.status==='on_the_way'; }).length);
}

function renderAdmUsers() {
  var tbl = document.getElementById('a-users-tbl');
  if (!tbl) return;
  tbl.innerHTML = S.users.map(function(u){
    return '<tr>'
      +'<td style="color:var(--amber)">'+u.id+'</td>'
      +'<td>'+u.name+'</td>'
      +'<td style="color:var(--text3)">'+u.email+'</td>'
      +'<td>'+(u.model||'—')+'</td>'
      +'<td><span class="badge b-user">User</span></td>'
      +'<td><button class="btn btn-red btn-sm" onclick="toast(\'User blocked\')">Block</button></td>'
      +'</tr>';
  }).join('');
}

function renderAdmDealers() {
  var tbl = document.getElementById('a-dealers-tbl');
  if (!tbl) return;
  tbl.innerHTML = S.dealers.map(function(d){
    return '<tr>'
      +'<td style="color:var(--amber)">'+d.id+'</td>'
      +'<td>'+d.name+'</td>'
      +'<td style="color:var(--text3)">'+(d.addr||'—')+'</td>'
      +'<td>🔋'+d.bat+' 🔌'+d.chg+'</td>'
      +'<td><span class="badge b-delivered">Verified</span></td>'
      +'<td><button class="btn btn-red btn-sm" onclick="toast(\'Dealer suspended\')">Suspend</button></td>'
      +'</tr>';
  }).join('');
}

function renderAdmReqs() {
  var tbl = document.getElementById('a-reqs-tbl');
  if (!tbl) return;
  if (!S.reqs.length) {
    tbl.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text3);">No requests yet</td></tr>';
    return;
  }
  tbl.innerHTML = S.reqs.slice().reverse().map(function(r){
    return '<tr>'
      +'<td style="color:var(--amber)">'+r.id+'</td>'
      +'<td>'+r.uname+'</td>'
      +'<td>'+stypeLabel(r.stype)+'</td>'
      +'<td style="font-size:0.8rem;color:var(--text3);">'+r.loc.substring(0,35)+'...</td>'
      +'<td>'+r.priority+'</td>'
      +'<td><span class="badge b-'+(r.status==='on_the_way'?'transit':r.status)+'">'+r.status.replace('_',' ')+'</span></td>'
      +'<td style="color:var(--text3)">'+r.time+'</td>'
      +'</tr>';
  }).join('');
}

function renderAdmAgents() {
  var tbl = document.getElementById('a-agents-tbl');
  if (!tbl) return;
  tbl.innerHTML = S.agents.map(function(a){
    return '<tr>'
      +'<td style="color:var(--amber)">'+a.id+'</td>'
      +'<td>'+a.name+'</td>'
      +'<td style="color:var(--text3)">'+(a.phone||'—')+'</td>'
      +'<td>'+a.vehicle+'</td>'
      +'<td>'+(a.area||'—')+'</td>'
      +'<td><span class="badge '+(a.online?'b-delivered':'b-rejected')+'">'+(a.online?'Online':'Offline')+'</span></td>'
      +'</tr>';
  }).join('');
}

/* ── FETCH ALL DATA FROM DB FOR ADMIN ── */
/* ── FETCH ALL DATA FROM DB FOR ADMIN ── */
function fetchAdminData(callback) {
  if (!USE_API) { if (callback) callback(); return; }
  var done = 0;
  function check() { done++; if (done === 2 && callback) callback(); }

  fetch(API_BASE + '/stats.php?role=admin')
    .then(function(r){ return r.json(); })
    .then(function(res){
      if (res && res.stats) {
        el('a-users',    res.stats.users);
        el('a-dealers',  res.stats.dealers);
        el('a-agents',   res.stats.agents);
        el('a-reqs',     res.stats.reqs);
        el('a-live-pend',res.stats.pending);
        el('a-live-del', res.stats.on_way);
      }
      check();
    })
    .catch(function(){ check(); });

  fetch(API_BASE + '/requests_sync.php?role=admin')
    .then(function(r){ return r.json(); })
    .then(function(res){
      if (res && res.reqs) { S.reqs = res.reqs; saveState(); }
      check();
    })
    .catch(function(){ check(); });
}

function _drawAdmReqs() {
  var tbl = document.getElementById('a-reqs-tbl');
  if (!tbl) return;
  if (!S.reqs.length) {
    tbl.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text3);">No requests yet</td></tr>';
    return;
  }
  tbl.innerHTML = S.reqs.slice().reverse().map(function(r){
    return '<tr>'
      +'<td style="color:var(--amber)">'+r.id+'</td>'
      +'<td>'+r.uname+'</td>'
      +'<td>'+stypeLabel(r.stype)+'</td>'
      +'<td style="font-size:0.8rem;color:var(--text3);">'+r.loc.substring(0,35)+'...</td>'
      +'<td>'+r.priority+'</td>'
      +'<td><span class="badge b-'+(r.status==='on_the_way'?'transit':r.status)+'">'+r.status.replace('_',' ')+'</span></td>'
      +'<td style="color:var(--text3)">'+r.time+'</td>'
      +'</tr>';
  }).join('');
}

function refreshAdm() {
  fetchAdminData(function() {});
}

function renderAdmReqs() {
  fetchAdminData(function() { _drawAdmReqs(); });
}

/* Auto refresh every 8s */
setInterval(function() {
  var active = document.querySelector('[id^="ad-"].on');
  if (!active) return;
  var sec = active.id.replace('ad-','');
  if (sec === 'home')   refreshAdm();
  if (sec === 'allreq') renderAdmReqs();
}, 8000);