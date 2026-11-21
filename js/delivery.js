/* ═══════════════════════════════════════
   delivery.js — Delivery agent dashboard
   Requires: state.js, utils.js, maps.js
═══════════════════════════════════════ */

function dsDelivery(sec, sideEl) {
  document.querySelectorAll('[id^="agd-"]').forEach(function(s){ s.classList.remove('on'); });
  var target = document.getElementById('agd-' + sec);
  if (target) target.classList.add('on');
  document.querySelectorAll('.sidebar .sitem').forEach(function(i){ i.classList.remove('on'); });
  if (sideEl) sideEl.classList.add('on');
  if (sec === 'home')    refreshAStats();
  if (sec === 'assign')  renderAAssign();
  if (sec === 'history') renderAHist();
  if (sec === 'nav')     setTimeout(initAgentMap, 100);
}

function refreshAStats() {
  var asgn = S.reqs.filter(function(r){ return r.status==='on_the_way'||r.status==='approved'; });
  var done = S.reqs.filter(function(r){ return r.status==='delivered'; });
  el('ag-ass',  asgn.length);
  el('ag-done', done.length);
  el('ag-earn', '₹'+done.length*150);
  renderAActive();
}

function renderAActive() {
  var box = document.getElementById('ag-active');
  if (!box) return;
  var active = S.reqs.filter(function(r){ return r.status==='on_the_way'||r.status==='approved'; });
  if (!active.length) { box.innerHTML='<div class="empty"><div class="eico">📭</div>No active assignments</div>'; return; }
  box.innerHTML = active.map(function(r){
    return '<div class="rcard">'
      +'<div class="rcard-top"><div class="rcard-id">'+r.id+'</div><span class="badge b-transit">🚚 Active</span></div>'
      +'<div class="rcard-meta">'
        +'<div class="rmeta-item"><span class="rmeta-key">Deliver to</span><span style="font-size:0.78rem;">'+r.loc.substring(0,55)+'</span></div>'
        +'<div class="rmeta-item"><span class="rmeta-key">Service</span>'+stypeLabel(r.stype)+'</div>'
      +'</div>'
      +'<div class="rcard-actions">'
        +'<button class="btn btn-green btn-sm" onclick="markDone(\''+r.id+'\')">✅ Mark Delivered</button>'
        +'<button class="btn btn-surface btn-sm" onclick="navToReq(\''+r.id+'\')">🗺️ Navigate</button>'
      +'</div></div>';
  }).join('');
}

function renderAAssign() {
  var box = document.getElementById('ag-all-assign');
  if (!box) return;
  var all = S.reqs.filter(function(r){ return ['approved','on_the_way','delivered'].indexOf(r.status)!==-1; }).reverse();
  if (!all.length) { box.innerHTML='<div class="empty"><div class="eico">📦</div>No assignments yet</div>'; return; }
  box.innerHTML = all.map(function(r){
    return '<div class="rcard"><div class="rcard-top"><div class="rcard-id">'+r.id+'</div>'
      +'<span class="badge b-'+(r.status==='delivered'?'delivered':'transit')+'">'+r.status.replace('_',' ')+'</span></div>'
      +'<div style="font-size:0.82rem;color:var(--text2);margin-top:4px;">'+r.loc.substring(0,55)+' · '+r.time+'</div></div>';
  }).join('');
}

function renderAHist() {
  var box = document.getElementById('ag-hist');
  if (!box) return;
  var done = S.reqs.filter(function(r){ return r.status==='delivered'; });
  if (!done.length) { box.innerHTML='<div class="empty"><div class="eico">📜</div>No deliveries yet</div>'; return; }
  box.innerHTML = done.map(function(r){
    return '<div class="rcard"><div class="rcard-top"><div class="rcard-id">'+r.id+'</div>'
      +'<div style="color:var(--green);font-size:0.82rem;font-weight:700;">+₹150</div></div>'
      +'<div style="font-size:0.82rem;color:var(--text2);margin-top:4px;">'+r.loc.substring(0,50)+' · '+r.time+'</div></div>';
  }).join('');
}

function markDone(id) {
  var r = S.reqs.find(function(x){ return x.id===id; });
  if (r) {
    r.status='delivered'; r.tl[4].done=true;
    r.tl[4].time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    saveState();
    apiCall('request_update', {id:id, status:'delivered'}, null, null);
    toast('✅ '+id+' delivered! +₹150 earned');
    refreshAStats();
  }
}

function navToReq(id) {
  var r = S.reqs.find(function(x){ return x.id===id; });
  if (!r) return;
  dsDelivery('nav', null);
  var dot = document.getElementById('dlv-dest-dot');
  var txt = document.getElementById('dlv-dest-txt');
  if (dot) dot.classList.add('active');
  if (txt) txt.textContent = '📍 Destination: '+r.loc.substring(0,60);
  setTimeout(function(){
    initAgentMap();
    if (r.lat && agentMap && leafletOK()) {
      try {
        L.marker([r.lat,r.lng],{icon:makeIcon('👤','#22c55e')}).addTo(agentMap)
          .bindPopup('Deliver here<br><b>'+r.id+'</b>').openPopup();
        agentMap.setView([r.lat,r.lng],15);
      } catch(e){}
    }
  }, 150);
  toast('🗺️ Navigation updated');
}

function toggleAgent() {
  S.agentOnline = !S.agentOnline;
  el('ag-status-val', S.agentOnline ? '🟢 Online' : '🔴 Offline');
  toast(S.agentOnline ? '🟢 You are now Online' : '🔴 You are now Offline');
}

/* ── FETCH FROM DB FOR AGENT DASHBOARD ── */
/* ── FETCH FROM DB FOR AGENT DASHBOARD ── */
function fetchAgentReqsFromDB(callback) {
  if (!USE_API || !S.cu) { if (callback) callback(); return; }
  var prevCount = S.reqs.filter(function(r){
    return r.status === 'approved' || r.status === 'on_the_way';
  }).length;

  fetch(API_BASE + '/requests_sync.php?role=delivery&uid=' + encodeURIComponent(S.cu.id))
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res && res.status === 'ok' && Array.isArray(res.reqs)) {
        S.reqs = res.reqs;
        saveState();
        var newCount = S.reqs.filter(function(r){
          return r.status === 'approved' || r.status === 'on_the_way';
        }).length;
        if (newCount > prevCount) toast('🔔 New delivery assigned to you!');
      }
      if (callback) callback();
    })
    .catch(function() { if (callback) callback(); });
}

function _drawAStats() {
  var asgn = S.reqs.filter(function(r){ return r.status==='on_the_way'||r.status==='approved'; });
  var done = S.reqs.filter(function(r){ return r.status==='delivered'; });
  el('ag-ass',  asgn.length);
  el('ag-done', done.length);
  el('ag-earn', '₹'+done.length*150);
  renderAActive();
}

function refreshAStats() {
  fetchAgentReqsFromDB(function() { _drawAStats(); });
}

function renderAAssign() {
  var box = document.getElementById('ag-all-assign');
  if (!box) return;
  fetchAgentReqsFromDB(function() {
    var all = S.reqs.filter(function(r){ return ['approved','on_the_way','delivered'].indexOf(r.status)!==-1; }).reverse();
    if (!all.length) { box.innerHTML='<div class="empty"><div class="eico">📦</div>No assignments yet</div>'; return; }
    box.innerHTML = all.map(function(r){
      return '<div class="rcard"><div class="rcard-top"><div class="rcard-id">'+r.id+'</div>'
        +'<span class="badge b-'+(r.status==='delivered'?'delivered':'transit')+'">'+r.status.replace('_',' ')+'</span></div>'
        +'<div style="font-size:0.82rem;color:var(--text2);margin-top:4px;">'+r.loc.substring(0,55)+' · '+r.time+'</div></div>';
    }).join('');
  });
}

/* Auto refresh every 10s */
setInterval(function() {
  var active = document.querySelector('[id^="agd-"].on');
  if (!active) return;
  var sec = active.id.replace('agd-','');
  if (sec === 'home')   refreshAStats();
  if (sec === 'assign') renderAAssign();
}, 10000);