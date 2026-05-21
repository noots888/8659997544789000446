/*
  PIN / Biometric / Auto-lock module
  Self-contained local-only app lock.
  - PIN saved as salted SHA-256 hash in localStorage
  - Optional device biometric via WebAuthn when supported
  - Auto-lock on inactivity/backgrounding
*/
(function(){
  const LS_KEY = 'assetTracker.auth.v1';
  const SESSION_KEY = 'assetTracker.auth.unlocked';
  const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
  let settings = loadSettings();
  let unlocked = sessionStorage.getItem(SESSION_KEY) === '1';
  let inactivityTimer = null;
  let lastActivity = Date.now();

  function loadSettings(){
    try{
      return Object.assign({
        enabled:false,
        pinHash:'',
        salt:'',
        biometricEnabled:false,
        timeoutMs:DEFAULT_TIMEOUT_MS,
        lockOnBackground:true
      }, JSON.parse(localStorage.getItem(LS_KEY) || '{}'));
    }catch(e){
      return {enabled:false,pinHash:'',salt:'',biometricEnabled:false,timeoutMs:DEFAULT_TIMEOUT_MS,lockOnBackground:true};
    }
  }

  function saveSettings(){
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  }

  function randomSalt(){
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function sha256(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function hashPin(pin, salt){
    return sha256(`${salt}:${pin}:field-map-local-lock`);
  }

  function validPin(pin){
    return /^\d{4,8}$/.test(String(pin||''));
  }

  function ensureStyles(){
    if(document.getElementById('authModuleStyles')) return;
    const css = document.createElement('style');
    css.id = 'authModuleStyles';
    css.textContent = `
      .auth-lock-overlay{position:fixed;inset:0;z-index:999999;background:radial-gradient(circle at top,#19351f,#102316 72%);display:none;align-items:center;justify-content:center;padding:20px;color:var(--ink)}
      .auth-lock-overlay.show{display:flex}
      .auth-card{width:min(420px,100%);background:linear-gradient(180deg,#fffdf4,#fff8e8);border:1px solid var(--line);border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.38);padding:22px;color:var(--ink)}
      .auth-card h2{margin:0 0 6px;font-size:22px;color:var(--ink)}
      .auth-card p{margin:0 0 14px;color:var(--muted);font-size:13px;line-height:1.4}
      .auth-pin{width:100%;border:1px solid var(--line);border-radius:16px;background:#fffdf4;color:var(--ink);font-size:24px;letter-spacing:8px;text-align:center;padding:14px;margin:8px 0 10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
      .auth-pin:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(47,106,54,.18)}
      .auth-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
      .auth-actions button,.auth-wide{border:0;border-radius:14px;padding:13px;font-weight:900;color:#fff;background:linear-gradient(135deg,var(--green),#19351f);box-shadow:0 8px 18px rgba(0,0,0,.14)}
      .auth-actions button.secondary,.auth-wide.secondary{background:#e3d6bb;color:var(--ink);box-shadow:none;border:1px solid var(--line)}
      .auth-actions button.green,.auth-wide.green{background:linear-gradient(135deg,var(--green),#19351f);color:white}
      .auth-msg{min-height:20px;font-size:13px;color:#8d451f;margin-top:8px;font-weight:800}
      .auth-settings-panel{display:grid;gap:10px;margin-top:10px;color:var(--ink)}
      .auth-status-card{border:1px solid var(--line);border-radius:18px;background:linear-gradient(135deg,#fffdf4,#fbf1d9);padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--ink)}
      .auth-status-card b{display:block;font-size:15px;color:var(--ink)}
      .auth-status-card small{display:block;color:var(--muted);margin-top:3px;line-height:1.3}
      .auth-badge{border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;background:#fffdf4;color:var(--muted);white-space:nowrap}
      .auth-badge.on{border-color:rgba(47,106,54,.5);color:var(--green);background:#eef7df}
      .auth-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      @media(max-width:520px){.auth-settings-grid{grid-template-columns:1fr}}
      .auth-setting-tile{border:1px solid var(--line);border-radius:18px;background:#fffdf4;padding:13px;color:var(--ink)}
      .auth-setting-tile b{display:block;font-size:14px;color:var(--ink)}
      .auth-setting-tile small{display:block;color:var(--muted);margin:4px 0 10px;line-height:1.35}
      .auth-setting-tile select{width:100%;border:1px solid var(--line);border-radius:12px;background:#fffdf4;color:var(--ink);padding:10px}
      .auth-switch{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .auth-switch input{width:22px;height:22px;accent-color:var(--green)}
      .auth-settings-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
      .auth-settings-actions button{border:0;border-radius:14px;padding:12px;font-weight:900;color:white;background:linear-gradient(135deg,var(--green),#19351f)}
      .auth-settings-actions button.secondary{background:#e3d6bb;color:var(--ink);border:1px solid var(--line);box-shadow:none}
      .auth-settings-actions button.danger{background:linear-gradient(135deg,#b7412e,#7c241a);color:white}
      .auth-settings-actions button:disabled{opacity:.45}
    `;
    document.head.appendChild(css);
  }

  function ensureOverlay(){
    ensureStyles();
    let overlay = document.getElementById('authLockOverlay');
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'authLockOverlay';
    overlay.className = 'auth-lock-overlay';
    overlay.innerHTML = `
      <div class="auth-card">
        <h2 id="authTitle">Unlock Field Map</h2>
        <p id="authSub">Enter your PIN to unlock this device session.</p>
        <input id="authPinInput" class="auth-pin" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="••••" />
        <div class="auth-actions">
          <button onclick="PinLock.unlockWithPin()">Unlock</button>
          <button class="secondary" onclick="PinLock.tryBiometric()">Biometric</button>
        </div>
        <button class="auth-wide secondary" style="margin-top:10px" onclick="PinLock.showSetup()">PIN settings</button>
        <div id="authMsg" class="auth-msg"></div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#authPinInput');
    input.addEventListener('keydown', e=>{ if(e.key==='Enter') window.PinLock.unlockWithPin(); });
    return overlay;
  }

  function msg(t){
    const el = document.getElementById('authMsg');
    if(el) el.textContent = t || '';
  }

  function showLock(reason=''){
    if(!settings.enabled) return;
    unlocked = false;
    sessionStorage.removeItem(SESSION_KEY);
    const overlay = ensureOverlay();
    document.getElementById('authTitle').textContent = 'Unlock Field Map';
    document.getElementById('authSub').textContent = reason || 'Enter your PIN to unlock this device session.';
    document.getElementById('authPinInput').value = '';
    overlay.classList.add('show');
    setTimeout(()=>document.getElementById('authPinInput')?.focus(), 150);
  }

  function hideLock(){
    unlocked = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    document.getElementById('authLockOverlay')?.classList.remove('show');
    resetTimer();
  }

  async function unlockWithPin(){
    const pin = document.getElementById('authPinInput')?.value || '';
    if(!validPin(pin)){ msg('PIN must be 4–8 digits.'); return; }
    const h = await hashPin(pin, settings.salt);
    if(h === settings.pinHash){
      msg('');
      hideLock();
    }else{
      msg('Wrong PIN.');
      const inp = document.getElementById('authPinInput');
      if(inp){ inp.value=''; inp.focus(); }
    }
  }

  async function setPin(pin){
    if(!validPin(pin)) throw new Error('PIN must be 4–8 digits.');
    settings.salt = randomSalt();
    settings.pinHash = await hashPin(pin, settings.salt);
    settings.enabled = true;
    saveSettings();
    hideLock();
  }

  async function showSetup(){
    ensureOverlay();
    const pin = prompt('Set a 4–8 digit PIN for this app:');
    if(pin === null) return;
    try{
      await setPin(pin);
      alert('PIN lock enabled.');
      renderSettingsPanel();
    }catch(e){
      alert(e.message);
    }
  }

  function disable(){
    if(!confirm('Disable PIN lock on this device?')) return;
    settings.enabled = false;
    settings.pinHash = '';
    settings.salt = '';
    settings.biometricEnabled = false;
    saveSettings();
    sessionStorage.setItem(SESSION_KEY,'1');
    document.getElementById('authLockOverlay')?.classList.remove('show');
    renderSettingsPanel();
  }

  async function tryBiometric(){
    if(!settings.biometricEnabled){
      msg('Biometric unlock is not enabled.');
      return;
    }
    if(!window.PublicKeyCredential || !navigator.credentials){
      msg('Biometric unlock not supported in this browser.');
      return;
    }
    // Lightweight local WebAuthn prompt. Not all mobile browsers allow credential-less auth.
    try{
      msg('Use device unlock if prompted...');
      await navigator.credentials.get({
        publicKey:{
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: []
        }
      });
      hideLock();
    }catch(e){
      msg('Biometric unlock unavailable. Use PIN.');
    }
  }

  function enableBiometricToggle(on){
    settings.biometricEnabled = !!on;
    saveSettings();
    renderSettingsPanel();
  }

  function setTimeoutMinutes(mins){
    const m = Number(mins);
    settings.timeoutMs = Math.max(1, m) * 60 * 1000;
    saveSettings();
    resetTimer();
  }

  function lockNow(){
    showLock('Locked.');
  }

  function resetTimer(){
    clearTimeout(inactivityTimer);
    if(!settings.enabled || !unlocked) return;
    inactivityTimer = setTimeout(()=>showLock('Locked after inactivity.'), settings.timeoutMs || DEFAULT_TIMEOUT_MS);
  }

  function activity(){
    lastActivity = Date.now();
    resetTimer();
  }

  function bindActivity(){
    ['touchstart','mousedown','keydown','scroll','click'].forEach(ev=>{
      document.addEventListener(ev, activity, {passive:true});
    });
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden && settings.enabled && settings.lockOnBackground){
        setTimeout(()=>showLock('Locked after app backgrounded.'), 250);
      }
    });
  }

  function renderSettingsPanel(){
    const host = document.getElementById('pinLockSettings');
    if(!host) return;
    const mins = Math.round((settings.timeoutMs || DEFAULT_TIMEOUT_MS) / 60000);
    host.innerHTML = `
      <div class="auth-settings-panel">
        <div class="auth-status-card">
          <span>
            <b>App lock</b>
            <small>${settings.enabled ? 'PIN protection is enabled on this device.' : 'No PIN is set on this device.'}</small>
          </span>
          <em class="auth-badge ${settings.enabled ? 'on' : ''}">${settings.enabled ? 'ON' : 'OFF'}</em>
        </div>

        <div class="auth-settings-grid">
          <div class="auth-setting-tile">
            <b>PIN</b>
            <small>Require a 4–8 digit PIN when the app opens.</small>
            <button class="${settings.enabled ? 'secondary' : 'green'}" onclick="${settings.enabled ? 'PinLock.showSetup()' : 'PinLock.showSetup()'}">${settings.enabled ? 'Change PIN' : 'Set PIN'}</button>
          </div>

          <div class="auth-setting-tile">
            <div class="auth-switch">
              <span>
                <b>Biometric unlock</b>
                <small>Use device unlock where supported.</small>
              </span>
              <input type="checkbox" ${settings.biometricEnabled ? 'checked' : ''} onchange="PinLock.enableBiometricToggle(this.checked)" ${settings.enabled ? '' : 'disabled'} />
            </div>
          </div>

          <div class="auth-setting-tile">
            <b>Auto-lock timer</b>
            <small>Lock after inactivity.</small>
            <select onchange="PinLock.setTimeoutMinutes(this.value)" ${settings.enabled ? '' : 'disabled'}>
              ${[1,5,10,15,30,60].map(m=>`<option value="${m}" ${mins===m?'selected':''}>${m} min</option>`).join('')}
            </select>
          </div>

          <div class="auth-setting-tile">
            <div class="auth-switch">
              <span>
                <b>Lock on background</b>
                <small>Lock when the app is hidden or switched away.</small>
              </span>
              <input type="checkbox" ${settings.lockOnBackground ? 'checked' : ''} onchange="PinLock.setLockOnBackground(this.checked)" ${settings.enabled ? '' : 'disabled'} />
            </div>
          </div>
        </div>

        <div class="auth-settings-actions">
          <button class="secondary" onclick="PinLock.lockNow()" ${settings.enabled ? '' : 'disabled'}>Lock now</button>
          <button class="danger" onclick="PinLock.disable()" ${settings.enabled ? '' : 'disabled'}>Disable lock</button>
        </div>
      </div>
    `;
  }


  function setLockOnBackground(on){
    settings.lockOnBackground = !!on;
    saveSettings();
  }

  function init(){
    ensureStyles();
    bindActivity();
    renderSettingsPanel();
    if(settings.enabled && !unlocked){
      setTimeout(()=>showLock(), 250);
    }else{
      resetTimer();
    }
  }

  window.PinLock = {
    init, showLock, hideLock, unlockWithPin, showSetup, disable, tryBiometric,
    enableBiometricToggle, setTimeoutMinutes, setLockOnBackground, lockNow,
    renderSettingsPanel
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();