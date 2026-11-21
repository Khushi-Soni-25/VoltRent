/* ═══════════════════════════════════════
   maps.js — All Leaflet map logic
   Requires: state.js, utils.js
═══════════════════════════════════════ */

var reqMap    = null, reqMarker  = null;
var trackMap  = null, trackMarker = null;
var dealerMap = null, agentMap   = null;
var sysMap    = null, heroMap    = null;
var _searchTimer = null;

var LOCATIONS = [
  {n:'Satellite, Ahmedabad',      la:23.0319, ln:72.5142},
  {n:'Vastrapur, Ahmedabad',      la:23.0426, ln:72.5289},
  {n:'Bodakdev, Ahmedabad',       la:23.0492, ln:72.5071},
  {n:'Prahlad Nagar, Ahmedabad',  la:23.0168, ln:72.5073},
  {n:'SG Highway, Ahmedabad',     la:23.0435, ln:72.5091},
  {n:'Navrangpura, Ahmedabad',    la:23.0323, ln:72.5601},
  {n:'CG Road, Ahmedabad',        la:23.0308, ln:72.5530},
  {n:'Paldi, Ahmedabad',          la:23.0037, ln:72.5681},
  {n:'Maninagar, Ahmedabad',      la:22.9965, ln:72.6015},
  {n:'Ghatlodia, Ahmedabad',      la:23.0731, ln:72.5479},
  {n:'Chandkheda, Ahmedabad',     la:23.1026, ln:72.5975},
  {n:'Thaltej, Ahmedabad',        la:23.0598, ln:72.5017},
  {n:'Bopal, Ahmedabad',          la:23.0234, ln:72.4661},
  {n:'Ambawadi, Ahmedabad',       la:23.0244, ln:72.5536},
  {n:'Ashram Road, Ahmedabad',    la:23.0204, ln:72.5799},
  {n:'Naranpura, Ahmedabad',      la:23.0594, ln:72.5619},
  {n:'Gurukul, Ahmedabad',        la:23.0671, ln:72.5497},
  {n:'Memnagar, Ahmedabad',       la:23.0522, ln:72.5383},
  {n:'Vejalpur, Ahmedabad',       la:22.9879, ln:72.5357},
  {n:'Jodhpur, Ahmedabad',        la:23.0118, ln:72.5200},
  {n:'Iscon, Ahmedabad',          la:23.0257, ln:72.5024},
  {n:'Shyamal, Ahmedabad',        la:23.0108, ln:72.5318},
  {n:'Drive-In Road, Ahmedabad',  la:23.0538, ln:72.5360},
  {n:'Kankaria, Ahmedabad',       la:22.9988, ln:72.6109},
  {n:'Sola, Ahmedabad',           la:23.0747, ln:72.5301},
  {n:'Shahibaug, Ahmedabad',      la:23.0558, ln:72.6069},
  {n:'New Ranip, Ahmedabad',      la:23.0789, ln:72.5677},
  {n:'AIT College, Ahmedabad',    la:23.0319, ln:72.5142},
  {n:'GTU Campus, Chandkheda',    la:23.1029, ln:72.5975},
  {n:'GIFT City, Gandhinagar',    la:23.1631, ln:72.6849}
];

/* ── HELPERS ── */
function leafletOK() { return (typeof L !== 'undefined'); }

function makeIcon(emoji, bg) {
  if (!leafletOK()) return null;
  return L.divIcon({
    html: '<div style="background:'+bg+';border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid rgba(0,0,0,0.5);box-shadow:0 2px 8px rgba(0,0,0,0.4);">'+emoji+'</div>',
    iconSize:[32,32], iconAnchor:[16,16], className:''
  });
}

function showMapFallback(id, lat, lng) {
  var e = document.getElementById(id);
  if (!e) return;
  e.innerHTML = '<iframe style="width:100%;height:100%;border:none;" src="https://www.openstreetmap.org/export/embed.html?bbox='+(lng-0.01)+'%2C'+(lat-0.01)+'%2C'+(lng+0.01)+'%2C'+(lat+0.01)+'&layer=mapnik&marker='+lat+'%2C'+lng+'" title="Map"></iframe>';
}

/* ── SET LOCATION ON MAP ── */
function setLocationOnMap(lat, lng, label) {
  S.userLat = lat; S.userLng = lng; S.userAddr = label;
  var latEl = document.getElementById('rq-lat');
  var lngEl = document.getElementById('rq-lng');
  var adrEl = document.getElementById('rq-addr');
  if (latEl) latEl.value = lat;
  if (lngEl) lngEl.value = lng;
  if (adrEl) adrEl.value = label;
  var bar = document.getElementById('loc-bar');
  var txt = document.getElementById('loc-text');
  if (bar) bar.style.display = 'flex';
  if (txt) txt.textContent = '📍 ' + label;
  if (reqMap && leafletOK()) {
    if (reqMarker) { try { reqMap.removeLayer(reqMarker); } catch(e){} }
    reqMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        html: '<div style="background:#F5C518;width:18px;height:18px;border-radius:50%;border:3px solid #000;box-shadow:0 0 0 4px rgba(245,197,24,0.3);"></div>',
        iconSize:[18,18], iconAnchor:[9,9], className:''
      }),
      draggable: true
    }).addTo(reqMap).bindPopup('<b>Your Location</b><br><small>Drag to adjust</small>').openPopup();
    reqMarker.on('dragend', function(e) {
      var p = e.target.getLatLng();
      setLocationOnMap(p.lat, p.lng, p.lat.toFixed(4)+', '+p.lng.toFixed(4));
      fetch('https://nominatim.openstreetmap.org/reverse?lat='+p.lat+'&lon='+p.lng+'&format=json')
        .then(function(r){return r.json();})
        .then(function(d){setLocationOnMap(p.lat,p.lng,d.display_name||(p.lat.toFixed(4)+','+p.lng.toFixed(4)));})
        .catch(function(){});
    });
    reqMap.setView([lat, lng], 16);
  }
}

/* ── REQUEST MAP (user dashboard) ── */
function initReqMap() {
  if (reqMap) return;
  var e = document.getElementById('req-map');
  if (!e) return;
  if (!leafletOK()) {
    e.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--text3);"><div style="font-size:2rem;">🗺️</div><div style="font-size:0.82rem;">Map needs internet. Use search box below.</div></div>';
    return;
  }
  reqMap = L.map('req-map', {zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap'}).addTo(reqMap);
  reqMap.setView([23.0225, 72.5714], 13);
  reqMap.on('click', function(ev) {
    var lat = ev.latlng.lat, lng = ev.latlng.lng;
    setLocationOnMap(lat, lng, lat.toFixed(4)+', '+lng.toFixed(4));
    fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json')
      .then(function(r){return r.json();})
      .then(function(d){setLocationOnMap(lat,lng,d.display_name||(lat.toFixed(4)+','+lng.toFixed(4)));})
      .catch(function(){});
  });
  reqMap.on('click movestart', function(){
    var tip = document.getElementById('map-tip');
    if (tip) tip.style.display = 'none';
  });
}

/* ── GPS BUTTON ── */
function getMyGPS() {
  var btn = document.getElementById('gps-map-btn');
  if (!navigator.geolocation) { toast('❌ GPS not supported — use search box'); return; }
  if (btn) { btn.textContent = '⏳ Locating...'; btn.style.background='#333'; btn.style.color='var(--amber)'; }
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude, acc = Math.round(pos.coords.accuracy);
      if (btn) { btn.textContent='✅ GPS Found'; btn.style.background='var(--green)'; btn.style.color='#000'; }
      if (!reqMap) initReqMap();
      setLocationOnMap(lat, lng, lat.toFixed(5)+', '+lng.toFixed(5)+' (±'+acc+'m)');
      toast('📡 GPS: ±'+acc+'m accuracy');
      fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json')
        .then(function(r){return r.json();})
        .then(function(d){setLocationOnMap(lat,lng,d.display_name||(lat.toFixed(5)+','+lng.toFixed(5))+' (±'+acc+'m GPS)');toast('📍 '+d.display_name.split(',')[0]);})
        .catch(function(){});
    },
    function(err) {
      if (btn) { btn.textContent='📡 Use My GPS'; btn.style.background='var(--amber)'; btn.style.color='#000'; }
      if (err.code===1) toast('⚠️ GPS blocked. Click map or use search.');
      else toast('⚠️ GPS error. Click map or use search.');
    },
    {enableHighAccuracy:true, timeout:10000, maximumAge:0}
  );
}

/* ── ADDRESS SEARCH ── */
function searchAddrLive(val) {
  clearTimeout(_searchTimer);
  var res = document.getElementById('addr-results');
  if (!res) return;
  if (val.length < 2) { res.innerHTML = ''; return; }
  _searchTimer = setTimeout(function(){ doAddrSearch(val); }, 200);
}

function searchAddr() {
  var q = document.getElementById('addr-search');
  if (q && q.value.trim().length > 0) doAddrSearch(q.value.trim());
}

function doAddrSearch(q) {
  var res = document.getElementById('addr-results');
  if (!res) return;
  var ql = q.toLowerCase();
  var matches = LOCATIONS.filter(function(loc){ return loc.n.toLowerCase().indexOf(ql) !== -1; }).slice(0,5);
  if (!matches.length) {
    res.innerHTML = '<div style="padding:6px 2px;font-size:0.8rem;color:var(--text3);">No area found. Try: Satellite, Vastrapur, Bopal...</div>';
    return;
  }
  res.innerHTML = matches.map(function(loc){
    return '<div class="addr-result-item" onclick="pickLocation('+loc.la+','+loc.lng+',\''+loc.n+'\')">'
      +'<span style="color:var(--amber);margin-right:6px;">📍</span>'+loc.n+'</div>';
  }).join('');
}

function pickLocation(lat, lng, name) {
  if (!reqMap) initReqMap();
  setLocationOnMap(lat, lng, name);
  var res = document.getElementById('addr-results');
  var inp = document.getElementById('addr-search');
  if (res) res.innerHTML = '';
  if (inp) inp.value = name.split(',')[0];
  toast('📍 '+name.split(',')[0]+' selected');
}

/* ── HERO MAP (landing page) ── */
function initHeroMap() {
  if (heroMap) return;
  var e = document.getElementById('hero-map');
  if (!e) return;
  if (!leafletOK()) { showMapFallback('hero-map', 23.0225, 72.5714); return; }
  heroMap = L.map('hero-map', {zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(heroMap);
  heroMap.setView([23.0225, 72.5714], 12);
  var icon = L.divIcon({html:'<div style="background:var(--amber);width:12px;height:12px;border-radius:50%;border:2px solid #000;"></div>', iconSize:[12,12], className:''});
  [[23.03,72.56],[23.01,72.58],[23.04,72.55],[23.00,72.57]].forEach(function(p){L.marker(p,{icon:icon}).addTo(heroMap);});
}

/* ── TRACKING MAP ── */
function initTrackMap(lat, lng) {
  if (!leafletOK()) { showMapFallback('track-map', lat, lng); return; }
  var e = document.getElementById('track-map');
  if (!e) return;
  if (trackMap) { trackMap.remove(); trackMap = null; trackMarker = null; }
  trackMap = L.map('track-map', {zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap'}).addTo(trackMap);
  trackMap.setView([lat, lng], 15);
  trackMarker = L.marker([lat, lng], {icon:makeIcon('📍','#F5C518')}).addTo(trackMap).bindPopup('<b>Delivery Location</b>').openPopup();
}

/* ── DEALER MAP ── */
function initDealerMap() {
  if (dealerMap) return;
  var e = document.getElementById('dealer-map');
  if (!e) return;
  if (!leafletOK()) { showMapFallback('dealer-map', 23.0225, 72.5714); return; }
  dealerMap = L.map('dealer-map', {zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(dealerMap);
  dealerMap.setView([23.0225, 72.5714], 13);
  L.marker([23.0319, 72.5142], {icon:makeIcon('🏪','#3b82f6')}).addTo(dealerMap).bindPopup('<b>Your Shop</b>');
  S.reqs.forEach(function(r){
    if (r.lat && r.lng) L.marker([r.lat,r.lng],{icon:makeIcon('📍','#F5C518')}).addTo(dealerMap).bindPopup('<b>'+r.id+'</b><br>'+r.loc);
  });
}

/* ── AGENT MAP ── */
function initAgentMap() {
  if (agentMap) return;
  var e = document.getElementById('agent-map');
  if (!e) return;
  if (!leafletOK()) { showMapFallback('agent-map', 23.0225, 72.5714); return; }
  agentMap = L.map('agent-map', {zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(agentMap);
  agentMap.setView([23.0225, 72.5714], 13);
  L.marker([23.0225,72.5714],{icon:makeIcon('🏍️','#FF5722')}).addTo(agentMap).bindPopup('<b>Your Location</b>').openPopup();
}

/* ── SYSTEM MAP (admin) ── */
function initSysMap() {
 if (sysMap) { sysMap.remove(); sysMap = null; }
  var e = document.getElementById('sys-map');
  if (!e) return;
  if (!leafletOK()) { showMapFallback('sys-map', 23.0225, 72.5714); return; }
  sysMap = L.map('sys-map', {zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(sysMap);
  sysMap.setView([23.0225, 72.5714], 12);
  sysMap = null;
  S.reqs.filter(function(r){ return r.status !== 'delivered' && r.status !== 'rejected' && r.status !== 'cancelled'; }).forEach(function(r){
    if (r.lat && r.lng) {
      var color = r.status==='delivered'?'#22c55e':r.status==='on_the_way'?'#FF5722':'#F5C518';
      L.marker([r.lat,r.lng],{icon:makeIcon('📍',color)}).addTo(sysMap)
        .bindPopup('<b>'+r.id+'</b><br>'+r.stype+' – <b>'+r.status+'</b><br>'+r.loc);
    }
  });
}

/* ── AGENT GPS UPDATE ── */
function agentUpdateLoc() {
  if (!navigator.geolocation) { toast('GPS not supported'); return; }
  toast('📍 Updating your location...');
  navigator.geolocation.getCurrentPosition(function(pos) {
    var lat=pos.coords.latitude, lng=pos.coords.longitude;
    if (agentMap && leafletOK()) {
      try {
        agentMap.setView([lat,lng],14);
        L.marker([lat,lng],{icon:makeIcon('🏍️','#FF5722')}).addTo(agentMap).bindPopup('<b>Your Current Location</b>').openPopup();
      } catch(e){}
    }
    toast('✅ Location updated: '+lat.toFixed(5)+', '+lng.toFixed(5));
    var dot = document.getElementById('dlv-dest-dot');
    var txt = document.getElementById('dlv-dest-txt');
    if (dot) dot.classList.add('active');
    if (txt) txt.textContent = 'Your GPS: '+lat.toFixed(5)+', '+lng.toFixed(5);
  }, function(){ toast('❌ GPS permission denied.'); }, {enableHighAccuracy:true,timeout:12000});
}
