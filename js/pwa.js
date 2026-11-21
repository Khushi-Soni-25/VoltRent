/* ═══════════════════════════════════════════════════════
   pwa.js — VoltRide PWA Registration & Install Prompt
   Add <script src="js/pwa.js"></script> to every HTML page
═══════════════════════════════════════════════════════ */

/* ── Register Service Worker ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/voltride/sw.js', { scope: '/voltride/' })
      .then(function(reg) {
        console.log('[VoltRide PWA] Service Worker registered:', reg.scope);

        /* Check for updates every time page loads */
        reg.update();

        reg.addEventListener('updatefound', function() {
          var newWorker = reg.installing;
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      })
      .catch(function(err) {
        console.warn('[VoltRide PWA] SW registration failed:', err);
      });

    /* Listen for sync complete from SW */
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'SYNC_COMPLETE') {
        if (typeof showSyncBadge === 'function') showSyncBadge();
        if (typeof liveRefresh === 'function') liveRefresh();
      }
    });
  });
}

/* ── Install Prompt (Add to Home Screen) ── */
var _deferredPrompt = null;
var _installBannerShown = false;

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _deferredPrompt = e;

  /* Show install banner after 5 seconds if not already installed */
  if (!_installBannerShown && !isAppInstalled()) {
    setTimeout(showInstallBanner, 5000);
  }
});

window.addEventListener('appinstalled', function() {
  _deferredPrompt = null;
  hideInstallBanner();
  if (typeof toast === 'function') toast('✅ VoltRide installed on your phone!');
  localStorage.setItem('vr_pwa_installed', '1');
});

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || localStorage.getItem('vr_pwa_installed') === '1';
}

function showInstallBanner() {
  if (isAppInstalled() || _installBannerShown) return;
  _installBannerShown = true;

  var banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = [
    'position:fixed',
    'bottom:0',
    'left:0',
    'right:0',
    'z-index:99999',
    'background:linear-gradient(135deg,#111214,#18191d)',
    'border-top:2px solid #F5C518',
    'padding:14px 16px',
    'display:flex',
    'align-items:center',
    'gap:12px',
    'box-shadow:0 -4px 24px rgba(0,0,0,0.6)',
    'animation:slideUp 0.4s ease',
    'font-family:Plus Jakarta Sans,sans-serif'
  ].join(';');

  banner.innerHTML = [
    '<style>',
    '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}',
    '</style>',
    '<div style="width:42px;height:42px;background:#F5C518;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">⚡</div>',
    '<div style="flex:1;min-width:0;">',
      '<div style="font-weight:700;font-size:0.88rem;color:#EDEDED;">Install VoltRide App</div>',
      '<div style="font-size:0.75rem;color:#A0A0A8;margin-top:2px;">Add to home screen for instant access</div>',
    '</div>',
    '<button id="pwa-install-btn" style="background:#F5C518;color:#000;border:none;padding:8px 16px;border-radius:8px;font-weight:700;font-size:0.82rem;cursor:pointer;flex-shrink:0;">Install</button>',
    '<button onclick="hideInstallBanner()" style="background:transparent;border:none;color:#606068;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;">✕</button>'
  ].join('');

  document.body.appendChild(banner);

  document.getElementById('pwa-install-btn').addEventListener('click', triggerInstall);
}

function hideInstallBanner() {
  var banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.transform = 'translateY(100%)';
    banner.style.transition = 'transform 0.3s ease';
    setTimeout(function() { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 300);
  }
}

function triggerInstall() {
  if (_deferredPrompt) {
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(function(result) {
      if (result.outcome === 'accepted') {
        localStorage.setItem('vr_pwa_installed', '1');
        hideInstallBanner();
      }
      _deferredPrompt = null;
    });
  } else {
    /* iOS fallback */
    showIOSInstructions();
  }
}

function showIOSInstructions() {
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var msg = isIOS
    ? '📱 On iOS: tap the Share button (□↑) then "Add to Home Screen"'
    : '📱 Open in Chrome → tap ⋮ menu → "Add to Home screen"';
  if (typeof toast === 'function') toast(msg);
  else alert(msg);
}

/* ── Update Banner ── */
function showUpdateBanner() {
  var banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:99999;background:#18191d;border:1px solid #F5C518;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:10px;font-family:Plus Jakarta Sans,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
  banner.innerHTML = '<span style="font-size:0.85rem;color:#EDEDED;">🆕 New version available</span>'
    + '<button onclick="location.reload()" style="background:#F5C518;color:#000;border:none;padding:5px 12px;border-radius:6px;font-weight:700;font-size:0.78rem;cursor:pointer;">Update</button>';
  document.body.appendChild(banner);
  setTimeout(function() { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 8000);
}

/* ── Online/Offline Status Indicator ── */
function updateOnlineStatus() {
  var isOnline = navigator.onLine;
  var existing = document.getElementById('vr-online-status');
  if (isOnline) {
    if (existing) existing.remove();
    return;
  }
  if (!existing) {
    var bar = document.createElement('div');
    bar.id = 'vr-online-status';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;background:#ef4444;color:#fff;text-align:center;font-size:0.75rem;font-weight:700;padding:5px;font-family:Plus Jakarta Sans,sans-serif;';
    bar.textContent = '📡 Offline — data will sync when connection returns';
    document.body.prepend(bar);
  }
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
