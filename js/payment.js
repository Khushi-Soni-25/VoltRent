/* ═══════════════════════════════════════
   payment.js — Simulated Payment Gateway
═══════════════════════════════════════ */

var _pendingReq   = null;
var _payAmount    = 0;
var _payMethod    = 'upi';
var _upiSelected  = null;

var PRICES = { normal: 500, express: 800, emergency: 1200 };

function openPayment(reqData) {
  _pendingReq = reqData;
  _payAmount  = PRICES[reqData.priority] || 500;
  _payMethod  = 'upi';
  _upiSelected = null;

  var modal = document.getElementById('pay-modal');
  if (!modal) return;

  document.getElementById('pay-amount').textContent = '₹' + _payAmount;
  document.getElementById('pay-req-id').textContent = reqData.id;
  document.getElementById('pay-service').textContent = stypeLabel(reqData.stype);

  // Reset UI
  document.querySelectorAll('.pay-method-btn').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById('pm-upi').classList.add('active');
  showPaySection('upi');
  document.getElementById('pay-result').style.display = 'none';
  document.getElementById('pay-form').style.display   = 'block';
  modal.classList.add('open');
}

function closePayment() {
  var modal = document.getElementById('pay-modal');
  if (modal) modal.classList.remove('open');
  _pendingReq = null;
}

function selPayMethod(method) {
  _payMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById('pm-' + method).classList.add('active');
  showPaySection(method);
}

function showPaySection(method) {
  ['upi','card','netbanking','cod'].forEach(function(m){
    var s = document.getElementById('ps-' + m);
    if (s) s.style.display = (m === method) ? 'block' : 'none';
  });
}

function selUPI(app) {
  _upiSelected = app;
  document.querySelectorAll('.upi-opt').forEach(function(b){ b.classList.remove('sel'); });
  var el = document.getElementById('upi-' + app);
  if (el) el.classList.add('sel');
}

function confirmPayment() {
  if (!_pendingReq) return;

  // COD — no payment needed
  if (_payMethod === 'cod') {
    closePayment();
    _doSubmitReq(window._lastReq);
    toast('✅ Order confirmed! Pay cash on delivery.');
    return;
  }

  // Validate
  if (_payMethod === 'upi' && !_upiSelected) {
    toast('⚠️ Please select a UPI app'); return;
  }
  if (_payMethod === 'card') {
    var cn = document.getElementById('card-num').value.replace(/\s/g,'');
    var cv = document.getElementById('card-cvv').value;
    var ex = document.getElementById('card-exp').value;
    if (cn.length < 16) { toast('⚠️ Enter valid card number'); return; }
    if (cv.length < 3)  { toast('⚠️ Enter valid CVV'); return; }
    if (!ex)            { toast('⚠️ Enter expiry date'); return; }
  }
  if (_payMethod === 'netbanking') {
    var bank = document.getElementById('nb-bank').value;
    if (!bank) { toast('⚠️ Select a bank'); return; }
  }

  // Show processing
  document.getElementById('pay-form').style.display = 'none';
  document.getElementById('pay-result').style.display = 'block';
  document.getElementById('pay-result').innerHTML =
    '<div style="text-align:center;padding:2rem;">'
    + '<div style="font-size:3rem;animation:spin 1s linear infinite;">⏳</div>'
    + '<div style="margin-top:1rem;font-weight:700;">Processing Payment...</div>'
    + '<div style="font-size:0.82rem;color:var(--text3);margin-top:6px;">Please wait</div>'
    + '</div>';

  // Simulate payment processing (2 seconds)
  setTimeout(function() {
    document.getElementById('pay-result').innerHTML =
      '<div style="text-align:center;padding:2rem;">'
      + '<div style="font-size:3.5rem;">✅</div>'
      + '<div style="font-size:1.3rem;font-weight:800;margin-top:0.5rem;color:var(--green)">Payment Successful!</div>'
      + '<div style="font-size:0.9rem;color:var(--text2);margin-top:6px;">₹' + _payAmount + ' paid via ' + _payMethod.toUpperCase() + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text3);margin-top:4px;">Transaction ID: TXN' + Date.now() + '</div>'
      + '<button class="btn btn-amber btn-full" style="margin-top:1.5rem;" onclick="_afterPayment()">Continue →</button>'
      + '</div>';

    // Save payment to DB
    fetch('api/payment_save.php', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        request_id: _pendingReq.id,
        user_id:    _pendingReq.uid,
        user_name:  _pendingReq.uname,
        amount:     _payAmount,
        method:     _payMethod
      })
    }).catch(function(){});

  }, 2000);
}

function _afterPayment() {
  var req = window._lastReq;
  if (req) {
    req.payment = _payMethod;
    req.amount  = _payAmount;
  }
  closePayment();
  _doSubmitReq(req);
}