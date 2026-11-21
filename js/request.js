/* ═══════════════════════════════════════
   request.js — User Dashboard
   Requires: state.js, utils.js, maps.js
═══════════════════════════════════════ */

/* ── SELF INIT — works regardless of how HTML calls requireAuth ── */
window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (!S.cu) {
      var session = loadSession();
      if (!session) { window.location.href = 'login.html'; return; }
      S.cu = session;
    }
    var nameEl = document.getElementById('un-name');
    if (nameEl) nameEl.textContent = S.cu.name;
    selStype('replacement');
    selPriority('normal');
    _renderUStats();
    renderURecent();
    /* Load orders from DB directly */
    _fetchAndShowOrders();
  }, 100);
});

/* ── CORE: fetch requests from DB and show them ── */
function _fetchAndShowOrders() {
  var box = document.getElementById('u-orders-list');
  if (!S.cu) return;

  /* Step 1: show whatever is in localStorage RIGHT NOW */


  /* Step 2: fetch directly from DB with plain fetch() — no helpers */
  fetch('api/requests_sync.php?role=user&uid=' + encodeURIComponent(S.cu.id))
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res && res.status === 'ok' && Array.isArray(res.reqs) && res.reqs.length > 0) {
        /* Merge DB requests into local state */
        res.reqs.forEach(function(dbReq) {
          var idx = S.reqs.findIndex(function(r) { return r.id === dbReq.id; });
         if (idx !== -1) {
  // Keep payment info from local if DB doesn't have it
  var localPayment = S.reqs[idx].payment;
  var localAmount  = S.reqs[idx].amount;
  S.reqs[idx] = dbReq;
  if (!S.reqs[idx].payment && localPayment) S.reqs[idx].payment = localPayment;
  if (!S.reqs[idx].amount  && localAmount)  S.reqs[idx].amount  = localAmount;
}
          else S.reqs.push(dbReq);
        });
        saveState();
      }
      /* Re-render with merged data */
      _renderOrdersList();
      _renderUStats();
      renderURecent();
    })
    .catch(function(err) {
      /* DB failed — already showing localStorage data, that's fine */
      console.warn('DB sync failed:', err);
    });
}

/* ── SECTION SWITCH ── */
function dsUser(sec, sideEl) {
  document.querySelectorAll('[id^="us-"]').forEach(function(s){ s.classList.remove('on'); });
  var target = document.getElementById('us-' + sec);
  if (target) target.classList.add('on');
  document.querySelectorAll('.sidebar .sitem').forEach(function(i){ i.classList.remove('on'); });
  if (sideEl) sideEl.classList.add('on');
  if (sec === 'request') setTimeout(initReqMap, 100);
  if (sec === 'home')    { _renderUStats(); renderURecent(); }
  if (sec === 'orders')  { _renderOrdersList(); _fetchAndShowOrders(); }
  if (sec === 'profile') renderUProfile();
}

/* ── SERVICE TYPE & PRIORITY ── */
function selStype(t) {
  S.selStype = t;
  clearUserAiRecommendation();
  ['replacement','charger','swap'].forEach(function(x){
    var e = document.getElementById('st-' + x);
    if (e) e.classList.remove('sel');
  });
  var s = document.getElementById('st-' + t);
  if (s) s.classList.add('sel');

}
function selPriority(p) {
  S.selPriority = p;
  clearUserAiRecommendation();
  ['normal','express','emergency'].forEach(function(x){
    var e = document.getElementById('pr-' + x);
    if (e) e.className = 'p-opt';
  });
  var map = {normal:'sel-n', express:'sel-e', emergency:'sel-em'};
  var s = document.getElementById('pr-' + p);
  if (s) s.classList.add(map[p]);
}
function submitReq() {
  var alId = 'req-alert';
  if (!S.cu) { S.cu = loadSession(); }
  if (!S.cu) { showAl(alId,'err','Please log in first'); return; }

  var lat  = document.getElementById('rq-lat') ? document.getElementById('rq-lat').value : '';
  var lng  = document.getElementById('rq-lng') ? document.getElementById('rq-lng').value : '';
  var addr = S.userAddr || (document.getElementById('rq-addr') ? document.getElementById('rq-addr').value : '');
  if (!lat && !addr) { showAl(alId,'err','📍 Please set your location on the map or search an area!'); return; }

  var techEl  = document.getElementById('rq-tech');
  var techVal = techEl ? (techEl.tagName==='SELECT' ? techEl.value : (techEl.checked?'yes':'no')) : 'no';
  var now     = new Date();

  var req = {
    id:       'REQ-' + String(S.rc++).padStart(3,'0'),
    uid:      S.cu.id,
    uname:    S.cu.name,
    stype:    S.selStype    || 'replacement',
    vno:      v('rq-vno')   || 'Not provided',
    model:    v('rq-model') || S.cu.model || 'EV',
    loc:      addr || (parseFloat(lat).toFixed(4)+', '+parseFloat(lng).toFixed(4)),
    lat:      lat ? parseFloat(lat) : 23.0225+(Math.random()-0.5)*0.04,
    lng:      lng ? parseFloat(lng) : 72.5714+(Math.random()-0.5)*0.04,
    priority: S.selPriority || 'normal',
    tech:     techVal,
    notes:    v('rq-notes'),
    status:   'pending',
    ai_recommendation: window._selectedAiRecommendation || null,
    recommended_dealer_id: window._selectedAiRecommendation ? window._selectedAiRecommendation.dealer_id : null,
    time:     now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
    date:     now.toLocaleDateString(),
    tl:[
      {label:'Request Submitted',    done:true,  time:now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})},
      {label:'Dealer Notified',      done:false, time:''},
      {label:'Approved & Dispatched',done:false, time:''},
      {label:'On the Way',           done:false, time:''},
      {label:'Delivered',            done:false, time:''}
    ]
  };

  // Save req temporarily and open payment
  window._lastReq = req;
  saveState();
  openPayment(req);
}

/* ── OPTIONAL AI DEALER RECOMMENDATION ── */
function clearUserAiRecommendation() {
  window._selectedAiRecommendation = null;
  var hidden = document.getElementById('rq-ai-dealer');
  if (hidden) hidden.value = '';
  var box = document.getElementById('user-ai-rec-result');
  if (box) box.innerHTML = '';
}

function getUserAiRecommendation() {
  var box = document.getElementById('user-ai-rec-result');
  if (!box) return;
  var lat = document.getElementById('rq-lat') ? document.getElementById('rq-lat').value : '';
  var lng = document.getElementById('rq-lng') ? document.getElementById('rq-lng').value : '';
  if (!lat || !lng) {
    box.innerHTML = '<div class="alert alert-info show">Set your request location first, then run the optional AI recommendation.</div>';
    return;
  }
  window._selectedAiRecommendation = null;
  var hidden = document.getElementById('rq-ai-dealer');
  if (hidden) hidden.value = '';
  box.innerHTML = '<div class="text-sm text-muted">Checking live dealer inventory...</div>';
  fetch(API_BASE + '/ai/recommend_battery.php', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      service_type: S.selStype || 'replacement',
      priority: S.selPriority || 'normal',
      user_lat: parseFloat(lat),
      user_lng: parseFloat(lng)
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){ renderUserAiRecommendation(res); })
  .catch(function(){
    box.innerHTML = '<div class="alert alert-info show">AI recommendation is currently unavailable. You can continue with the normal request process.</div>';
  });
}

function userAiEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderUserAiRecommendation(res) {
  var box = document.getElementById('user-ai-rec-result');
  if (!box) return;
  if (!res || res.status !== 'ok' || !res.recommendation) {
    box.innerHTML = '<div class="alert alert-info show">'
      + ((res && res.message) ? res.message : 'AI recommendation is currently unavailable.')
      + ' You can continue with the normal request process.</div>';
    return;
  }
  var rec = res.recommendation;
  var alternatives = (res.alternatives || []).map(function(a){
    var whyLower = [];
    if (rec.stock != null && a.stock != null && Number(a.stock) < Number(rec.stock)) whyLower.push('less available stock');
    if (rec.distance_km != null && a.distance_km != null && Number(a.distance_km) > Number(rec.distance_km)) whyLower.push('farther away');
    if (rec.distance_km != null && a.distance_km == null) whyLower.push('distance unavailable');
    return '<div class="rcard" style="padding:0.8rem;margin-top:8px;">'
      + '<div class="rcard-top" style="margin-bottom:6px;"><div class="rcard-id">' + userAiEscape(a.dealer_name || a.dealer_id || 'Dealer') + '</div><span class="badge b-pending">' + userAiEscape(a.score) + '/100</span></div>'
      + '<div class="text-xs text-muted">Stock: ' + userAiEscape(a.stock) + (a.distance_km != null ? ' | Distance: ' + userAiEscape(a.distance_km) + ' km' : ' | Distance unavailable') + '</div>'
      + (whyLower.length ? '<div class="text-xs text-dim mt-2">Scored lower because: ' + userAiEscape(whyLower.join(', ')) + '.</div>' : '<div class="text-xs text-dim mt-2">Comparable option, shown as an alternative.</div>')
      + '</div>';
  }).join('');
  var explanationList = rec.explanations || rec.reasons || ['Recommended based on available inventory and location.'];
  var reasons = explanationList.map(function(reason){
    return '<div class="text-sm text-muted">✓ ' + userAiEscape(reason) + '</div>';
  }).join('');
  box.innerHTML = '<div class="rcard">'
    + '<div class="rcard-top"><div class="rcard-id">' + userAiEscape(rec.dealer_id || 'Dealer') + '</div><span class="badge b-delivered">Live Data</span></div>'
    + '<div class="text-sm text-muted mb-3">Voltrent AI recommends this dealer because it is the strongest available match for your selected request details. This score is a suitability score, not a guarantee.</div>'
    + '<div class="rcard-meta">'
      + '<div class="rmeta-item"><span class="rmeta-key">Recommended Dealer</span>' + userAiEscape(rec.dealer_name || rec.dealer_id || 'Unknown') + '</div>'
      + '<div class="rmeta-item"><span class="rmeta-key">Suitability</span>' + userAiEscape(res.score) + '/100</div>'
      + '<div class="rmeta-item"><span class="rmeta-key">Available Stock</span>' + userAiEscape(rec.stock) + '</div>'
      + '<div class="rmeta-item"><span class="rmeta-key">Distance</span>' + (rec.distance_km == null ? 'Unavailable' : userAiEscape(rec.distance_km) + ' km') + '</div>'
    + '</div>'
    + '<div class="text-xs uppercase text-dim font-bold mt-3">Why this dealer?</div>'
    + '<div class="mt-3">' + reasons + '</div>'
    + '<button class="btn btn-amber btn-sm mt-3" onclick="useUserAiRecommendation()">Use Recommendation</button>'
    + (alternatives ? '<div class="divider"></div><div class="text-xs uppercase text-dim font-bold">Alternatives</div>' + alternatives : '')
    + '<div class="text-xs text-dim mt-2">This will mark the recommendation for this request only after you choose it. The normal request workflow still continues.</div>'
    + '</div>';
  window._latestAiRecommendation = rec;
}

function useUserAiRecommendation() {
  if (!window._latestAiRecommendation) {
    toast('Run AI recommendation first');
    return;
  }
  window._selectedAiRecommendation = window._latestAiRecommendation;
  var hidden = document.getElementById('rq-ai-dealer');
  if (hidden) hidden.value = window._selectedAiRecommendation.dealer_id || '';
  var box = document.getElementById('user-ai-rec-result');
  if (box) {
    box.innerHTML += '<div class="alert alert-ok show mt-2">Recommendation selected. You can still edit the request or continue normally.</div>';
  }
}

function _doSubmitReq(req) {
  if (!req) return;
  S.reqs.push(req);
  saveState();

  fetch('api/request_create.php', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(req)
  })
  .then(function(r){ return r.json(); })
  .then(function(){ toast('🚀 ' + req.id + ' submitted!'); })
  .catch(function(){ toast('✅ ' + req.id + ' saved locally.'); });

  ['rq-vno','rq-model','rq-notes'].forEach(function(fid){
    var e=document.getElementById(fid); if(e) e.value='';
  });
  ['rq-lat','rq-lng','rq-addr'].forEach(function(fid){
    var e=document.getElementById(fid); if(e) e.value='';
  });
  S.userLat=null; S.userLng=null; S.userAddr=null;
  var bar=document.getElementById('loc-bar');
  if(bar) bar.style.display='none';
  if(typeof reqMarker!=='undefined'&&reqMarker&&reqMap){try{reqMap.removeLayer(reqMarker);}catch(e){} reqMarker=null;}

  _renderUStats();
  setTimeout(function(){ dsUser('orders',null); }, 500);
}

/* ── STATS ── */
function refreshUStats() { _renderUStats(); renderURecent(); _fetchAndShowOrders(); }

function _renderUStats() {
  if (!S.cu) return;
  var mine = _myReqs();
  el('us-tot',  mine.length);
  el('us-pend', mine.filter(function(r){ return r.status==='pending'; }).length);
  el('us-del',  mine.filter(function(r){ return r.status==='delivered'; }).length);
}

function renderURecent() {
  var box = document.getElementById('u-recent');
  if (!box||!S.cu) return;
  var mine = _myReqs().slice(-3).reverse();
  if (!mine.length) { box.innerHTML='<div class="empty"><div class="eico">📭</div>No requests yet</div>'; return; }
  box.innerHTML = mine.map(function(r){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">'
      +'<div><div style="font-size:0.85rem;font-weight:600;">'+r.id+'</div>'
      +'<div style="font-size:0.75rem;color:var(--text3);">'+stypeLabel(r.stype)+' · '+r.time+'</div></div>'
      +'<span class="badge b-'+r.status+'">'+r.status.replace('_',' ')+'</span></div>';
  }).join('');
}

function _myReqs() {
  if (!S.cu) return [];
  return S.reqs.filter(function(r){
    return r.uid===S.cu.id || r.uname===S.cu.name;
  });
}

/* ── RENDER ORDERS LIST ── */
function renderUOrders() {
  _renderOrdersList();
  _fetchAndShowOrders();
}

function _renderOrdersList() {
  var box = document.getElementById('u-orders-list');
  if (!box) return;
  if (!S.cu) { box.innerHTML='<div class="empty"><div class="eico">⏳</div>Loading...</div>'; return; }

  var mine = _myReqs().slice().reverse();
  if (!mine.length) {
    box.innerHTML='<div class="empty"><div class="eico">📋</div>No requests yet — use "Request Battery" to submit one!</div>';
    return;
  }
  box.innerHTML = mine.map(function(r){
    return '<div class="rcard">'
      +'<div class="rcard-top"><div class="rcard-id">'+r.id+'</div>'
      +'<span class="badge b-'+r.status+'">'+r.status.replace('_',' ')+'</span></div>'
      +'<div class="rcard-meta">'
        +'<div class="rmeta-item"><span class="rmeta-key">Service</span>'+stypeLabel(r.stype)+'</div>'
        +'<div class="rmeta-item"><span class="rmeta-key">Location</span>'
          +'<span style="font-size:0.78rem;">'+r.loc.substring(0,55)+'</span></div>'
     +'<div class="rmeta-item"><span class="rmeta-key">Priority</span>'+r.priority+'</div>'
    +'<div class="rmeta-item"><span class="rmeta-key">Payment</span>'+(r.payment ? (
  r.payment==='upi'        ? '📱 UPI' :
  r.payment==='card'       ? '💳 CARD' :
  r.payment==='netbanking' ? '🏦 NET BANKING' :
  r.payment==='cod'        ? '💵 CASH ON DELIVERY' :
  '💳 '+r.payment.toUpperCase()
) : '⏳ Pending')+'</div>'
    +'<div class="rmeta-item"><span class="rmeta-key">Amount</span>'+(r.amount?'₹'+r.amount:'₹'+(r.priority==='emergency'?1200:r.priority==='express'?800:500))+'</div>'
    +'<div class="rmeta-item"><span class="rmeta-key">Time</span>'+r.time+' · '+r.date+'</div>'
      +'</div>'
      +'<div class="rcard-actions">'
        +(r.status==='pending'
          ?'<button class="btn btn-red btn-sm" onclick="cancelReq(\''+r.id+'\')">✕ Cancel</button>'
          :'')
        +'<button class="btn btn-surface btn-sm" onclick="quickTrack(\''+r.id+'\')">📍 Track</button>'
      +'</div></div>';
  }).join('');
}

/* ── TRACK ── */
function quickTrack(id) {
  dsUser('track',null);
  var inp=document.getElementById('trk-id');
  if(inp){ inp.value=id; doTrack(); }
}

function doTrack() {
  var id  = v('trk-id').toUpperCase();
  var res = document.getElementById('trk-result');
  var tl  = document.getElementById('trk-tl');
  var bdg = document.getElementById('trk-badge');
  if(!id){ toast('Enter a request ID'); return; }
  var r = S.reqs.find(function(x){ return x.id===id; });
  if(!r){ toast('❌ Not found: '+id); if(res) res.style.display='none'; return; }
  if(res) res.style.display='block';
  if(bdg) bdg.innerHTML='<span class="badge b-'+r.status+'">'+r.status.replace('_',' ')+'</span>';
  if(tl) tl.innerHTML = [
    {label:'Request Submitted',    done: true, time: r.time||''},
    {label:'Dealer Notified',      done: true, time:''},
    {label:'Approved & Dispatched',done: r.status==='approved'||r.status==='on_the_way'||r.status==='delivered', time:''},
    {label:'On the Way',           done: r.status==='on_the_way'||r.status==='delivered', time:''},
    {label:'Delivered',            done: r.status==='delivered', time:''}
  ].map(function(t){
    return '<div class="tl-item'+(t.done?' done':'')+'">'
      +'<div class="tl-dot"></div>'
      +'<div class="tl-info"><div class="tl-label">'+t.label+'</div>'
      +(t.time?'<div class="tl-time">'+t.time+'</div>':'')+'</div></div>';
  }).join('');
  if(r.lat&&r.lng) setTimeout(function(){ initTrackMap(r.lat,r.lng); },100);
}

/* ── CANCEL ── */
function cancelReq(id) {
  if(!confirm('Cancel '+id+'?')) return;
  var r=S.reqs.find(function(x){ return x.id===id; });
  if(r&&r.status==='pending'){
    r.status='cancelled'; saveState();
    fetch('api/request_update.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,status:'cancelled'})});
    toast('✕ '+id+' cancelled');
    _renderOrdersList(); _renderUStats();
  }
}

/* ── PROFILE ── */
function renderUProfile() {
  var box=document.getElementById('u-profile-box')||document.getElementById('u-profile-card');
  if(!box||!S.cu) return;
  box.innerHTML='<div class="field"><label>Name</label><input class="field-input" value="'+S.cu.name+'" id="up-name"></div>'
    +'<div class="field"><label>Email</label><input class="field-input" value="'+S.cu.email+'" readonly style="opacity:0.6;"></div>'
    +'<div class="field"><label>Phone</label><input class="field-input" value="'+(S.cu.phone||'')+'" id="up-phone"></div>'
    +'<div class="field"><label>EV Model</label><input class="field-input" value="'+(S.cu.model||'')+'" id="up-model"></div>'
    +'<button class="btn btn-amber btn-sm" onclick="saveProfile()">Save Changes</button>';
}

function saveProfile() {
  if (!S.cu) return;
  S.cu.name  = v('up-name')  || S.cu.name;
  S.cu.phone = v('up-phone') || S.cu.phone;
  S.cu.model = v('up-model') || S.cu.model;

  var u = S.users.find(function(x){ return x.id === S.cu.id; });
  if (u) { u.name = S.cu.name; u.phone = S.cu.phone; u.model = S.cu.model; }
  var d = S.dealers.find(function(x){ return x.id === S.cu.id; });
  if (d) { d.name = S.cu.name; d.phone = S.cu.phone; }
  var a = S.agents.find(function(x){ return x.id === S.cu.id; });
  if (a) { a.name = S.cu.name; a.phone = S.cu.phone; }

  saveSession(S.cu);
  saveState();

  var nameEl = document.getElementById('un-name');
  if (nameEl) nameEl.textContent = S.cu.name;

  fetch('api/user_update.php', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({email: S.cu.email, name: S.cu.name, phone: S.cu.phone})
  })
  .then(function(r){ return r.json(); })
  .then(function(){ toast('✅ Profile saved!'); })
  .catch(function(){ toast('✅ Profile saved locally!'); });

  // Save to DB
  fetch('api/user_update.php', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({email: S.cu.email, name: S.cu.name, phone: S.cu.phone})
  })
  .then(function(r){ return r.json(); })
  .then(function(res){ toast('✅ Profile saved!'); })
  .catch(function(){ toast('✅ Profile saved locally!'); });
}
