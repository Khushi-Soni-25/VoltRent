/* Voltride AI dashboard helpers.
   Optional UI layer only. Existing request, auth, payment, and dashboard flows
   do not depend on these functions. */

function aiSetBox(id, html) {
  var box = document.getElementById(id);
  if (box) box.innerHTML = html;
}

function aiEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function aiBadge(label, type) {
  var cls = type === 'real' ? 'b-delivered' : type === 'error' ? 'b-rejected' : 'b-pending';
  return '<span class="badge ' + cls + '">' + aiEscape(label) + '</span>';
}

function renderAdminAi() {
  var realReqs = Array.isArray(S.reqs) ? S.reqs.length : 0;
  var dealers = Array.isArray(S.dealers) ? S.dealers.length : 0;
  aiSetBox('ai-readiness-box',
    '<div class="rcard">'
      + '<div class="rcard-meta">'
        + '<div class="rmeta-item"><span class="rmeta-key">Real request records in session</span>' + realReqs + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Dealer records in session</span>' + dealers + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Demand model status</span>' + aiBadge('Prototype', 'prototype') + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Health model status</span>' + aiBadge('Synthetic demo', 'prototype') + '</div>'
      + '</div>'
    + '</div>'
    + '<div class="text-xs text-dim mt-2">No fake records are inserted into MySQL. Future production ML requires real historical volume and battery telemetry.</div>'
  );
  fetchAiSummary();
}

function aiPost(endpoint, payload, onDone) {
  var url = mlApiUrl(endpoint);
  if (!url) {
    onDone({ status: 'error', message: 'AI service is not configured.' });
    return;
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  })
  .then(function(r) {
    return r.json().catch(function() { return {}; }).then(function(body) {
      if (!r.ok) throw new Error(body.detail || body.message || 'AI request failed.');
      return body;
    });
  })
  .then(function(res) { onDone(res); })
  .catch(function(err) {
    onDone({ status: 'error', message: 'AI service unavailable: ' + err.message });
  });
}

function fetchAiSummary() {
  aiSetBox('ai-summary-box', '<div class="text-sm text-muted">Loading live AI data summary...</div>');
  fetch(API_BASE + '/ai/intelligence_summary.php')
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (!res || res.status !== 'ok') {
        aiSetBox('ai-summary-box', '<div class="alert alert-err show">' + aiEscape((res && res.message) || 'AI data summary unavailable') + '</div>');
        return;
      }
      renderAiSummary(res);
    })
    .catch(function(err) {
      aiSetBox('ai-summary-box', '<div class="alert alert-err show">AI data summary unavailable: ' + aiEscape(err.message) + '</div>');
    });
}

function renderAiSummary(res) {
  var stats = res.statistics || {};
  var readiness = res.readiness || {};
  aiSetBox('ai-summary-box',
    '<div class="stats-row">'
      + '<div class="stat"><div class="stat-val">' + aiEscape(stats.total_users || 0) + '</div><div class="stat-key">Users</div></div>'
      + '<div class="stat"><div class="stat-val">' + aiEscape(stats.total_dealers || 0) + '</div><div class="stat-key">Dealers</div></div>'
      + '<div class="stat"><div class="stat-val">' + aiEscape(stats.total_requests || 0) + '</div><div class="stat-key">Requests</div></div>'
      + '<div class="stat"><div class="stat-val">' + aiEscape(stats.available_battery_stock || 0) + '</div><div class="stat-key">Battery Stock</div></div>'
      + '<div class="stat"><div class="stat-val">' + aiEscape(stats.active_requests || 0) + '</div><div class="stat-key">Active</div></div>'
      + '<div class="stat"><div class="stat-val">' + aiEscape(stats.completed_requests || 0) + '</div><div class="stat-key">Completed</div></div>'
    + '</div>'
    + '<div class="rcard">'
      + '<div class="rcard-top"><div class="rcard-id">AI Data Readiness</div>' + aiBadge('Live MySQL', 'real') + '</div>'
      + '<div class="rcard-meta">'
        + '<div class="rmeta-item"><span class="rmeta-key">Historical Requests</span>' + aiEscape(readiness.historical_requests || 0) + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Inventory History</span>' + aiEscape(readiness.inventory_history_records || 0) + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Timeline History</span>' + aiEscape(readiness.request_timeline_records || 0) + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Request Types</span>' + aiEscape(readiness.request_type_count || 0) + '</div>'
      + '</div>'
      + '<div class="text-sm text-muted mt-3">' + aiEscape(readiness.ml_status || 'Insufficient historical data') + '</div>'
    + '</div>'
  );

  aiSetBox('ai-readiness-box',
    '<div class="rcard">'
      + '<div class="rcard-meta">'
        + '<div class="rmeta-item"><span class="rmeta-key">Recommendation</span>' + aiBadge(readiness.recommendation_status || 'Live-data enabled', 'real') + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Battery Health</span>' + aiBadge(readiness.battery_health_status || 'Synthetic Prototype', 'prototype') + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">Demand Prediction</span>' + aiBadge(readiness.demand_prediction_status || 'Synthetic Prototype', 'prototype') + '</div>'
        + '<div class="rmeta-item"><span class="rmeta-key">ML Status</span>' + aiBadge('Insufficient data', 'prototype') + '</div>'
      + '</div>'
    + '</div>'
    + '<div class="text-xs text-dim mt-2">Synthetic prototype metrics are not real-world production accuracy. No fake records are inserted into MySQL.</div>'
  );
}

function runAiRecommendation() {
  aiSetBox('ai-rec-result', '<div class="text-sm text-muted">Checking real dealer inventory...</div>');
  var payload = {
    service_type: v('ai-rec-service') || 'replacement',
    priority: v('ai-rec-priority') || 'normal',
    user_lat: parseFloat(v('ai-rec-lat')),
    user_lng: parseFloat(v('ai-rec-lng'))
  };
  aiPost('recommendations/battery', { request: payload }, function(res) {
    if (!res || res.status !== 'ok') {
      aiSetBox('ai-rec-result',
        '<div class="alert alert-err show">' + aiEscape((res && res.message) || 'No recommendation available') + '</div>'
        + (res && res.warning ? '<div class="text-xs text-dim">' + aiEscape(res.warning) + '</div>' : '')
      );
      return;
    }
    var rec = res.recommendation || {};
    var alternatives = (res.alternatives || []).map(function(a) {
      var whyLower = [];
      if (rec.stock != null && a.stock != null && Number(a.stock) < Number(rec.stock)) whyLower.push('less available stock');
      if (rec.distance_km != null && a.distance_km != null && Number(a.distance_km) > Number(rec.distance_km)) whyLower.push('farther away');
      if (rec.distance_km != null && a.distance_km == null) whyLower.push('distance unavailable');
      return '<div class="rcard" style="padding:0.8rem;margin-top:8px;">'
        + '<div class="rcard-top" style="margin-bottom:6px;"><div class="rcard-id">' + aiEscape(a.dealer_name || a.dealer_id) + '</div><span class="badge b-pending">' + aiEscape(a.score) + '/100</span></div>'
        + '<div class="text-xs text-muted">Stock: ' + aiEscape(a.stock) + (a.distance_km != null ? ' | Distance: ' + aiEscape(a.distance_km) + ' km' : ' | Distance unavailable') + '</div>'
        + (whyLower.length ? '<div class="text-xs text-dim mt-2">Scored lower because: ' + aiEscape(whyLower.join(', ')) + '.</div>' : '<div class="text-xs text-dim mt-2">Comparable option, shown as an alternative.</div>')
        + '</div>';
    }).join('');
    var explanationList = rec.explanations || rec.reasons || ['Recommended based on available inventory and location.'];
    var explanations = explanationList.map(function(reason) {
      return '<div class="text-sm text-muted">✓ ' + aiEscape(reason) + '</div>';
    }).join('');
    aiSetBox('ai-rec-result',
      '<div class="rcard">'
        + '<div class="rcard-top"><div class="rcard-id">' + aiEscape(rec.dealer_id) + '</div>' + aiBadge('Real data when DB available', 'real') + '</div>'
        + '<div class="text-sm text-muted mb-3">Voltrent AI recommends this dealer because it is the strongest available match for the selected request details. This score is a suitability score, not a probability or guarantee.</div>'
        + '<div class="rcard-meta">'
          + '<div class="rmeta-item"><span class="rmeta-key">Dealer</span>' + aiEscape(rec.dealer_name || 'Unknown') + '</div>'
          + '<div class="rmeta-item"><span class="rmeta-key">Suitability Score</span>' + aiEscape(res.score) + '/100</div>'
          + '<div class="rmeta-item"><span class="rmeta-key">Stock</span>' + aiEscape(rec.stock) + '</div>'
          + '<div class="rmeta-item"><span class="rmeta-key">Distance</span>' + (rec.distance_km == null ? 'Unavailable' : aiEscape(rec.distance_km) + ' km') + '</div>'
        + '</div>'
        + '<div class="text-xs uppercase text-dim font-bold mt-3">Why this dealer?</div>'
        + '<div class="mt-3">' + explanations + '</div>'
        + (alternatives ? '<div class="divider"></div><div class="text-xs uppercase text-dim font-bold">Alternatives</div>' + alternatives : '')
      + '</div>'
    );
  });
}

function runHealthPrototype() {
  aiSetBox('ai-health-result', '<div class="text-sm text-muted">Running synthetic-data demo model...</div>');
  aiPost('predict/health', {
    battery_age_months: 18,
    charging_cycles: 320,
    average_temperature: 34.5,
    voltage: 50.1,
    current_capacity: 80,
    usage_hours: 1100,
    maintenance_count: 1
  }, function(res) {
    if (!res || res.status !== 'ok') {
      aiSetBox('ai-health-result', '<div class="alert alert-err show">' + aiEscape((res && res.message) || 'Prediction unavailable') + '</div>');
      return;
    }
    aiSetBox('ai-health-result',
      '<div class="rcard">'
        + '<div class="rcard-top"><div class="rcard-id">' + aiEscape(res.prediction) + '</div>' + aiBadge('Synthetic prototype', 'prototype') + '</div>'
        + '<div class="text-sm text-muted">Model: ' + aiEscape(res.model) + '. This is not production-validated.</div>'
      + '</div>'
    );
  });
}

function runDemandPrototype() {
  aiSetBox('ai-demand-result', '<div class="text-sm text-muted">Running synthetic-data demo model...</div>');
  aiPost('predict/demand', {
    hour: 18,
    day_of_week: 5,
    is_weekend: 1,
    month: 7,
    location: 'Ahmedabad',
    request_type: 'swap',
    historical_request_count: 9
  }, function(res) {
    if (!res || res.status !== 'ok') {
      aiSetBox('ai-demand-result', '<div class="alert alert-err show">' + aiEscape((res && res.message) || 'Prediction unavailable') + '</div>');
      return;
    }
    aiSetBox('ai-demand-result',
      '<div class="rcard">'
        + '<div class="rcard-top"><div class="rcard-id">' + aiEscape(res.predicted_demand) + '</div>' + aiBadge('Synthetic prototype', 'prototype') + '</div>'
        + '<div class="text-sm text-muted">Model: ' + aiEscape(res.model) + '. This is not real Voltride demand forecasting.</div>'
      + '</div>'
    );
  });
}

window.addEventListener('DOMContentLoaded', function() {
  renderAdminAi();
});
