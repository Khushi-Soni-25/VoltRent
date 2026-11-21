/* ═══════════════════════════════════════
   dealer.js — Dealer dashboard
   Requires: state.js, utils.js
═══════════════════════════════════════ */

/* ── SYNC REQUESTS FROM DB ──────────────────────────────────────
   When USE_API=true  → fetch from MySQL via requests_sync.php
   When USE_API=false → use S.reqs from localStorage directly
   Either way, callback() is always called so render never hangs
──────────────────────────────────────────────────────────────── */
function syncReqs(callback) {
  if (!USE_API) {
    if (callback) callback();
    return;
  }
  fetch(API_BASE + '/requests_sync.php?role=dealer')
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res && res.status === 'ok' && Array.isArray(res.reqs)) {
        S.reqs = res.reqs;
        saveState();
      }
      if (callback) callback();
    })
    .catch(function(err) {
      console.warn('syncReqs failed:', err);
      if (callback) callback(); // still render from localStorage
    });
}

/* ── SECTION SWITCH ─────────────────────────────────────────── */
function dsDealer(sec, sideEl) {
  document.querySelectorAll('[id^="ds-"]').forEach(function(s) { s.classList.remove('on'); });
  var target = document.getElementById('ds-' + sec);
  if (target) target.classList.add('on');
  document.querySelectorAll('.sidebar .sitem').forEach(function(i) { i.classList.remove('on'); });
  if (sideEl) sideEl.classList.add('on');

  syncReqs(function() {
    if (sec === 'home')       { _renderDStats(); _renderDIncoming(); }
    if (sec === 'requests')     renderDReqs();
    if (sec === 'inventory')    renderDInventory();
    if (sec === 'deliveries')   renderDDeliveries();
    if (sec === 'map')          setTimeout(initDealerMap, 100);
  });
}

/* ── STATS ──────────────────────────────────────────────────── */
function refreshDStats() {
  syncReqs(function() { _renderDStats(); _renderDIncoming(); });
}

function _renderDStats() {
  var pend  = S.reqs.filter(function(r) { return r.status === 'pending'; });
 var appr  = S.reqs.filter(function(r) { 
  return r.status === 'approved' || r.status === 'on_the_way' || r.status === 'Approved'; 
});
  var done  = S.reqs.filter(function(r) { return r.status === 'delivered'; });
  var total = S.reqs.length;
  el('dd-tot',  total);
  el('dd-pend', pend.length);
  el('dd-appr', done.length);
  el('dd-done', done.length);
  el('dd-bat',  S.inv.bat);
  el('dd-chg',  S.inv.chg);
  var batBar = document.getElementById('ib-bar');
  var chgBar = document.getElementById('ic-bar');
  if (batBar) batBar.style.width = Math.min(100, (S.inv.bat / 25) * 100) + '%';
  if (chgBar) chgBar.style.width = Math.min(100, (S.inv.chg / 20) * 100) + '%';
}

/* ── INCOMING (home section quick view) ─────────────────────── */
function _renderDIncoming() {
  var box = document.getElementById('d-incoming');
  if (!box) return;
  var pending = S.reqs.filter(function(r) { return r.status === 'pending'; });
  if (!pending.length) {
    box.innerHTML = '<div class="empty"><div class="eico">✅</div>No pending requests right now</div>';
    return;
  }
  // Show max 3 on home, with approve button
  box.innerHTML = pending.slice(0, 3).map(function(r) {
    return '<div class="rcard">'
      + '<div class="rcard-top"><div class="rcard-id">' + r.id + '</div><span class="badge b-pending">🕐 Pending</span></div>'
      + '<div class="rcard-meta">'
        + '<div class="rmeta-item"><span class="rmeta-key">Customer</span>' + r.uname + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Service</span>' + stypeLabel(r.stype) + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Location</span><span style="font-size:0.78rem;">' + r.loc.substring(0, 55) + '</span></div>'
      + '</div>'
      + '<div class="rcard-actions">'
        + '<button class="btn btn-green btn-sm" onclick="openAppr(\'' + r.id + '\')">✅ Approve</button>'
        + '<button class="btn btn-red btn-sm" onclick="rejectReq(\'' + r.id + '\')">✕ Reject</button>'
      + '</div></div>';
  }).join('');
  if (pending.length > 3) {
    box.innerHTML += '<div style="text-align:center;padding:8px;font-size:0.82rem;color:var(--text2);">'
      + (pending.length - 3) + ' more pending → <a href="#" onclick="dsDealer(\'requests\',null)" style="color:var(--amber);">View all</a></div>';
  }
}

/* ── REQUESTS SECTION (full list) ───────────────────────────── */
function renderDReqs() {
  var box = document.getElementById('d-reqs-list');
  if (!box) return;
  
  syncReqs(function() {
    var pending = S.reqs.filter(function(r) { return r.status === 'pending'; });
    if (!pending.length) {
      box.innerHTML = '<div class="empty"><div class="eico">✅</div>No pending requests</div>';
      return;
    }
    box.innerHTML = pending.map(function(r) {
      return '<div class="rcard">'
        + '<div class="rcard-top"><div class="rcard-id">' + r.id + '</div><span class="badge b-pending">🕐 Pending</span></div>'
        + '<div class="rcard-meta">'
          + '<div class="rmeta-item"><span class="rmeta-key">Customer</span>' + r.uname + '</div>'
          + '<div class="rmeta-item"><span class="rmeta-key">Service</span>' + stypeLabel(r.stype) + '</div>'
          + '<div class="rmeta-item"><span class="rmeta-key">Location</span><span style="font-size:0.78rem;">' + r.loc.substring(0, 60) + '</span></div>'
          + '<div class="rmeta-item"><span class="rmeta-key">Priority</span>'
            + '<span style="color:' + (r.priority === 'emergency' ? 'var(--red)' : r.priority === 'express' ? 'var(--orange)' : 'var(--text2)') + ';">' + r.priority + '</span></div>'
          + '<div class="rmeta-item"><span class="rmeta-key">Vehicle</span>' + (r.vno || '—') + '&nbsp;' + (r.model || '') + '</div>'
          + '<div class="rmeta-item"><span class="rmeta-key">Time</span>' + r.time + ' · ' + r.date + '</div>'
        + '</div>'
        + '<div class="rcard-actions">'
          + '<button class="btn btn-green btn-sm" onclick="openAppr(\'' + r.id + '\')">✅ Approve</button>'
          + '<button class="btn btn-red btn-sm" onclick="rejectReq(\'' + r.id + '\')">✕ Reject</button>'
        + '</div></div>';
    }).join('');
  });
}

/* ── DELIVERIES ─────────────────────────────────────────────── */
function renderDDeliveries() {
  var box = document.getElementById('d-deliveries-list');
  if (!box) return;
  syncReqs(function() {
    var active = S.reqs.filter(function(r) {
      return r.status === 'approved' || r.status === 'on_the_way';
    });
    if (!active.length) {
      box.innerHTML = '<div class="empty"><div class="eico">🚚</div>No active deliveries</div>';
      return;
    }
    box.innerHTML = active.map(function(r) {
      return '<div class="rcard">'
        + '<div class="rcard-top"><div class="rcard-id">' + r.id + '</div><span class="badge b-transit">🚚 In Transit</span></div>'
        + '<div style="font-size:0.82rem;color:var(--text2);margin-top:6px;">' + r.loc.substring(0, 70) + ' · ' + r.time + '</div>'
        + '</div>';
    }).join('');
  });
}

/* ── INVENTORY ──────────────────────────────────────────────── */
function renderDInventory() {
  el('inv-bat', S.inv.bat);
  el('inv-chg', S.inv.chg);
}

/* ── APPROVE MODAL ──────────────────────────────────────────── */
var _curApprId = null;

function openAppr(id) {
  _curApprId = id;
  var modal = document.getElementById('appr-modal');
  if (modal) modal.classList.add('open');
  // Populate agent dropdown from real data
  populateAgentDropdown();
}

function populateAgentDropdown() {
  var sel = document.getElementById('m-agent');
  if (!sel) return;

  // Always start with just Auto-assign
  sel.innerHTML = '<option value="auto">Auto-assign nearest</option>';

  if (USE_API) {
    // Fetch real agents from DB
    fetch(API_BASE + '/agents_get.php')
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res && res.agents) {
          res.agents.forEach(function(a) {
            var opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = 'Agent ' + a.id + ' – ' + a.name
              + (a.area ? ' (' + a.area + ')' : '')
              + (a.online ? '' : ' [Offline]');
            if (!a.online) opt.disabled = true;
            sel.appendChild(opt);
          });
        }
      })
      .catch(function() {
        // Fallback to S.agents from localStorage
        _populateFromState(sel);
      });
  } else {
    // Offline mode — use S.agents
    _populateFromState(sel);
  }
}

function _populateFromState(sel) {
  S.agents.forEach(function(a) {
    var opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = 'Agent ' + a.id + ' – ' + a.name
      + (a.area ? ' (' + a.area + ')' : '')
      + (!a.online ? ' [Offline]' : '');
    if (!a.online) opt.disabled = true;
    sel.appendChild(opt);
  });
}

function closeM(id) {
  var modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function confirmAppr() {
  var r = S.reqs.find(function(x) { return x.id === _curApprId; });
  if (!r) { toast('❌ Request not found'); return; }

  r.status       = 'approved';
  if (r.tl && r.tl[2]) { r.tl[2].done = true; r.tl[2].time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  S.inv.bat      = Math.max(0, S.inv.bat - 1);
  saveState();

  var agentSel  = document.getElementById('m-agent');
  var agentId   = (agentSel && agentSel.value !== 'auto') ? agentSel.value : null;
  apiCall('request_update', { id: r.id, status: 'approved', agent_id: agentId },
    function(res) {
      var agentName = 'nearest agent';
      if (res && res.assigned_agent && res.assigned_agent.name) {
        agentName = res.assigned_agent.name;
        // Update local S.reqs so UI reflects correct agent
        var local = S.reqs.find(function(x){ return x.id === r.id; });
        if (local) local.agent_id = res.assigned_agent.id;
        saveState();
      }
      toast('✅ ' + r.id + ' approved! Assigned to ' + agentName + '.');
    },
    function() { toast('✅ ' + r.id + ' approved!'); }
  );
  closeM('appr-modal');
  _renderDStats();
  _renderDIncoming();

  // Delivery progression simulation
  setTimeout(function() {
    r.status = 'on_the_way';
    if (r.tl && r.tl[3]) { r.tl[3].done = true; r.tl[3].time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
    saveState();
    apiCall('request_update', { id: r.id, status: 'on_the_way' }, null, null);
    toast('🚚 ' + r.id + ': Agent on the way!');
  }, 3000);

  setTimeout(function() {
    r.status = 'delivered';
    if (r.tl && r.tl[4]) { r.tl[4].done = true; r.tl[4].time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
    saveState();
    apiCall('request_update', { id: r.id, status: 'delivered' }, null, null);
    toast('✅ ' + r.id + ': Battery delivered!');
    _renderDStats();
    _renderDIncoming();
  }, 7000);
}

function rejectReq(id) {
  var r = S.reqs.find(function(x) { return x.id === id; });
  if (r) {
    r.status = 'rejected';
    saveState();
    apiCall('request_update', { id: id, status: 'rejected' }, null, null);
    toast('❌ ' + id + ' rejected');
    _renderDStats();
    _renderDIncoming();
    renderDReqs();
  }
}

/* ── INVENTORY UPDATE ───────────────────────────────────────── */
function updInv(type, delta) {
  S.inv[type] = Math.max(0, S.inv[type] + delta);
  el('inv-' + type, S.inv[type]);
  var bar = document.getElementById('i' + (type === 'bat' ? 'b' : 'c') + '-bar');
  if (bar) bar.style.width = Math.min(100, (S.inv[type] / (type === 'bat' ? 25 : 20)) * 100) + '%';
  saveState();
  toast((type === 'bat' ? '🔋' : '🔌') + ' ' + type + ': ' + S.inv[type] + ' available');
}

/* ── AUTO REFRESH EVERY 8s ──────────────────────────────────── */
setInterval(function() {
  var active = document.querySelector('[id^="ds-"].on');
  if (!active) return;
  var sec = active.id.replace('ds-', '');
  syncReqs(function() {
    if (sec === 'home')       { _renderDStats(); _renderDIncoming(); }
    if (sec === 'requests')     renderDReqs();
    if (sec === 'deliveries')   renderDDeliveries();
  });
}, 8000);
