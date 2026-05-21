/* Field MAP PWA install helper - clean production deploy
   No external diagnostics pages required. */
(function(){
  'use strict';
  const BUILD = '4.1.8-clean-upload';
  let deferredPrompt = null;

  function standalone(){
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }

  async function resetLocalAppShell(){
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => /field[-_ ]?map/i.test(k)).map(k => caches.delete(k)));
      }
    } catch(e) {}
    localStorage.removeItem('fieldMapPwaHelperHidden');
    location.href = './?fresh=' + Date.now();
  }

  function ensurePanel(){
    let el = document.getElementById('pwaInstallHelper');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pwaInstallHelper';
    el.className = 'pwa-install-helper';
    el.innerHTML = '<div class="pwa-install-title">Field MAP install</div><div id="pwaInstallText" class="pwa-install-text">Checking app install status…</div><div class="pwa-install-actions"><button id="pwaInstallBtn" type="button">Install</button><button id="pwaInstallResetBtn" type="button">Refresh install</button><button id="pwaInstallCloseBtn" type="button">Hide</button></div>';
    document.body.appendChild(el);
    document.getElementById('pwaInstallCloseBtn').addEventListener('click', function(){ el.classList.remove('show'); localStorage.setItem('fieldMapPwaHelperHidden','1'); });
    document.getElementById('pwaInstallResetBtn').addEventListener('click', resetLocalAppShell);
    document.getElementById('pwaInstallBtn').addEventListener('click', async function(){
      if (!deferredPrompt) {
        setText('Chrome has not exposed Install yet. Use Chrome menu → Install app, or press Refresh install after removing the old shortcut/app.');
        return;
      }
      try {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        deferredPrompt = null;
        setText(result && result.outcome === 'accepted' ? 'Install accepted. Open from the home screen when it finishes.' : 'Install dismissed. You can try again from Chrome menu.');
      } catch (e) {
        setText('Install prompt failed. Use Chrome menu → Install app, or press Refresh install.');
      }
    });
    return el;
  }

  function setText(msg){
    const t = document.getElementById('pwaInstallText');
    if (t) t.textContent = msg;
  }

  function show(msg){
    if (standalone()) return;
    const hidden = localStorage.getItem('fieldMapPwaHelperHidden') === '1';
    const el = ensurePanel();
    if (msg) setText(msg);
    if (!hidden) el.classList.add('show');
  }

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    show('Ready to install. Press Install, or use Chrome menu → Install app.');
  });

  window.addEventListener('appinstalled', function(){
    deferredPrompt = null;
    localStorage.setItem('fieldMapPwaInstalled','1');
    const el = document.getElementById('pwaInstallHelper');
    if (el) el.classList.remove('show');
  });

  window.addEventListener('load', function(){
    window.FIELD_MAP_PWA_BUILD = BUILD;
    if (standalone()) return;
    if (!('serviceWorker' in navigator)) {
      show('This browser does not support service workers, so full app install may not work.');
      return;
    }
    navigator.serviceWorker.ready.then(function(reg){
      window.FIELD_MAP_SW_SCOPE = reg.scope;
      setTimeout(function(){
        if (!deferredPrompt && !standalone()) {
          show('Service worker is active. If Chrome still only shows Add to Home screen, remove the old shortcut/app, then press Refresh install.');
        }
      }, 3500);
    }).catch(function(){
      show('Service worker is not active yet. Press Refresh install, then reopen the app link.');
    });
  });
})();
