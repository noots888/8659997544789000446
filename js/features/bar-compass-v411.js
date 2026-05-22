/* Field MAP v4.1.11 bar compass repair: no large overlay, tap-to-activate, easy calibration. */
(function(){
  'use strict';
  const VERSION='4.1.11-bar-compass-repair';
  const KEY_HEADING='fieldMapBarCompassHeading';
  const KEY_OFFSET='fieldMapBarCompassOffset';
  const KEY_MODE='fieldMapBarCompassMode';
  let heading=readNum(KEY_HEADING,0);
  let offset=readNum(KEY_OFFSET,0);
  let active=false;
  let orientationStarted=false;
  let gpsWatchId=null;
  let lastDeviceRaw=null;
  let lastDeviceHeading=null;
  let lastDeviceTs=0;
  let lastGpsHeading=null;
  let lastGpsTs=0;
  let lastSource='Ready';
  let panelTimer=null;
  let statusTimer=null;
  let installing=false;
  let absoluteSensor=null;

  function readNum(key,fallback){
    try{const n=Number(localStorage.getItem(key)); return Number.isFinite(n)?n:fallback;}catch(e){return fallback;}
  }
  function saveNum(key,val){try{localStorage.setItem(key,String(Math.round(norm(val))));}catch(e){}}
  function norm(v){v=Number(v); if(!Number.isFinite(v)) return 0; v%=360; if(v<0)v+=360; return v;}
  function delta(a,b){const d=Math.abs(norm(a)-norm(b)); return Math.min(d,360-d);}
  function dir(v){return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(norm(v)/22.5)%16];}
  function hasRecentDevice(){return Date.now()-lastDeviceTs<3500 && Number.isFinite(lastDeviceHeading);}
  function hasRecentGps(){return Date.now()-lastGpsTs<6000 && Number.isFinite(lastGpsHeading);}
  function sourceText(){
    if(hasRecentDevice()) return 'DEVICE';
    if(hasRecentGps()) return 'GPS';
    return active?'WAIT':'OFF';
  }
  function ensureMarkup(){
    const c=document.querySelector('.compass');
    if(!c) return null;
    c.classList.add('bar-compass','live-bar-compass');
    c.removeAttribute('onclick');
    c.onclick=null;
    c.setAttribute('role','button');
    c.setAttribute('tabindex','0');
    c.setAttribute('aria-label','Compass. Tap to activate. Hold for calibration.');
    if(!c.querySelector('.fm-compass-dir')){
      c.innerHTML='<span class="fm-compass-pointer" aria-hidden="true">▲</span><b class="fm-compass-dir">N</b><span class="fm-compass-deg">000°</span><span class="fm-compass-src">OFF</span>';
    }
    return c;
  }
  function render(deg,source,save){
    heading=norm(deg);
    if(save!==false) saveNum(KEY_HEADING,heading);
    const c=ensureMarkup();
    document.documentElement.style.setProperty('--small-compass-heading',heading+'deg');
    document.documentElement.style.setProperty('--bar-compass-heading',heading+'deg');
    if(c){
      const d=dir(heading);
      const src=source || sourceText();
      const degText=String(Math.round(heading)).padStart(3,'0')+'°';
      const dEl=c.querySelector('.fm-compass-dir');
      const degEl=c.querySelector('.fm-compass-deg');
      const srcEl=c.querySelector('.fm-compass-src');
      if(dEl)dEl.textContent=d;
      if(degEl)degEl.textContent=degText;
      if(srcEl)srcEl.textContent=src;
      c.classList.toggle('compass-active',active);
      c.classList.toggle('compass-gps',src==='GPS');
      c.classList.toggle('compass-device',src==='DEVICE');
      c.classList.toggle('compass-wait',src==='WAIT');
      c.title='Compass '+degText+' '+d+' ('+src+')';
    }
  }
  function setStatus(text,tone){
    const p=ensurePanel(false);
    const el=p&&p.querySelector('#barCompassStatus');
    if(el){el.textContent=text; el.className='bar-compass-status '+(tone||'');}
  }
  function flashStatus(text,tone){
    showPanel();
    setStatus(text,tone);
    clearTimeout(statusTimer);
    statusTimer=setTimeout(()=>{const p=document.getElementById('barCompassPanel'); if(p && !p.classList.contains('pinned')) hidePanel();},4500);
  }
  function applyDevice(raw,source){
    lastDeviceRaw=norm(raw);
    lastDeviceHeading=norm(lastDeviceRaw+offset);
    lastDeviceTs=Date.now();
    lastSource='DEVICE';
    render(lastDeviceHeading,'DEVICE');
  }
  function orientationHeading(e){
    let h=null;
    if(e && typeof e.webkitCompassHeading==='number') h=e.webkitCompassHeading;
    else if(e && e.type==='deviceorientationabsolute' && typeof e.alpha==='number') h=360-e.alpha;
    else if(e && e.absolute===true && typeof e.alpha==='number') h=360-e.alpha;
    else if(e && typeof e.alpha==='number' && (Date.now()-lastDeviceTs>900 || !hasRecentGps())) h=360-e.alpha;
    if(Number.isFinite(h)) applyDevice(h,'orientation');
  }
  function quaternionToYaw(q){
    if(!q || q.length<4) return null;
    const x=q[0],y=q[1],z=q[2],w=q[3];
    const siny=2*(w*z+x*y);
    const cosy=1-2*(y*y+z*z);
    return norm(360-(Math.atan2(siny,cosy)*180/Math.PI));
  }
  function startAbsoluteSensor(){
    if(absoluteSensor || !('AbsoluteOrientationSensor' in window)) return;
    try{
      absoluteSensor=new AbsoluteOrientationSensor({frequency:8,referenceFrame:'device'});
      absoluteSensor.addEventListener('reading',()=>{
        try{const h=quaternionToYaw(absoluteSensor.quaternion); if(Number.isFinite(h)) applyDevice(h,'sensor');}catch(e){}
      });
      absoluteSensor.addEventListener('error',()=>{try{absoluteSensor.stop();}catch(e){} absoluteSensor=null;});
      absoluteSensor.start();
    }catch(e){absoluteSensor=null;}
  }
  function startOrientation(){
    if(orientationStarted) return;
    orientationStarted=true;
    try{
      const add=()=>{
        window.addEventListener('deviceorientationabsolute',orientationHeading,true);
        window.addEventListener('deviceorientation',orientationHeading,true);
        startAbsoluteSensor();
        setTimeout(()=>{ if(!hasRecentDevice() && active) flashStatus('No device compass yet. GPS heading will show when moving. Make sure motion/sensor permission is allowed.', 'warn'); },1800);
      };
      if(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission==='function'){
        DeviceOrientationEvent.requestPermission().then(state=>{
          if(state==='granted'){add();}
          else{flashStatus('Compass permission blocked. Allow motion/orientation permission. GPS heading still works while moving.','bad');}
        }).catch(()=>{flashStatus('Compass permission unavailable. GPS heading still works while moving.','warn');});
      }else add();
    }catch(e){flashStatus('Device compass failed to start. GPS heading still works while moving.','warn');}
  }
  function startGps(){
    if(gpsWatchId!==null || !navigator.geolocation) return;
    try{
      gpsWatchId=navigator.geolocation.watchPosition(pos=>{
        const c=pos.coords||{};
        const gh=Number(c.heading);
        const speed=Number(c.speed);
        if(Number.isFinite(gh) && gh>=0 && (!Number.isFinite(speed) || speed>0.25)){
          lastGpsHeading=norm(gh);
          lastGpsTs=Date.now();
          if(!hasRecentDevice() || (Date.now()-lastDeviceTs>2500)){
            lastSource='GPS';
            render(lastGpsHeading,'GPS');
          }else{
            render(lastDeviceHeading,'DEVICE');
          }
        }else if(!hasRecentDevice()){
          render(heading, active?'WAIT':'OFF', false);
        }
      },()=>{
        if(active) flashStatus('GPS permission blocked or unavailable. Compass needs sensor permission or GPS movement heading.', 'bad');
      },{enableHighAccuracy:true,maximumAge:800,timeout:12000});
    }catch(e){}
  }
  function activate(showMsg){
    active=true;
    try{localStorage.setItem(KEY_MODE,'active');}catch(e){}
    render(heading,sourceText(),false);
    startOrientation();
    startGps();
    if(showMsg!==false) flashStatus('Compass on. Tap/hold the bar for calibration. For GPS heading, move a few metres in a straight line.', 'ok');
  }
  function ensurePanel(open){
    let p=document.getElementById('barCompassPanel');
    if(p) return p;
    p=document.createElement('div');
    p.id='barCompassPanel';
    p.className='bar-compass-panel';
    p.innerHTML='<div class="bar-compass-card">\
      <div class="bar-compass-head"><b>Compass calibration</b><button type="button" id="barCompassClose" aria-label="Close">×</button></div>\
      <div class="bar-compass-live"><span id="barCompassLiveDeg">000°</span><span id="barCompassLiveDir">N</span><em id="barCompassLiveSource">OFF</em></div>\
      <div class="bar-compass-help">No figure‑8. Keep phone flat, step away from ute steel/magnets, then use one of these.</div>\
      <div class="bar-compass-actions">\
        <button type="button" id="barCompassStart">Start compass</button>\
        <button type="button" id="barCompassGpsCal">Set from GPS</button>\
        <button type="button" id="barCompassReset">Reset</button>\
      </div>\
      <div class="bar-compass-status" id="barCompassStatus">Tap Start, then move a few metres straight and tap Set from GPS if the phone compass is out.</div>\
    </div>';
    document.body.appendChild(p);
    p.querySelector('#barCompassClose')?.addEventListener('click',()=>hidePanel());
    p.querySelector('#barCompassStart')?.addEventListener('click',()=>activate(true));
    p.querySelector('#barCompassReset')?.addEventListener('click',()=>{offset=0;saveNum(KEY_OFFSET,0); if(Number.isFinite(lastDeviceRaw)) applyDevice(lastDeviceRaw,'reset'); else render(heading,sourceText(),false); setStatus('Calibration reset. Move away from steel and check again.','ok');});
    p.querySelector('#barCompassGpsCal')?.addEventListener('click',()=>{
      activate(false);
      if(!hasRecentGps()){
        setStatus('Need GPS movement heading first. Walk/drive a few metres straight, then tap Set from GPS.','warn');
        return;
      }
      if(!Number.isFinite(lastDeviceRaw)){
        setStatus('Need device compass signal first. Tap Start and allow motion/sensor permission.','warn');
        return;
      }
      offset=norm(lastGpsHeading-lastDeviceRaw);
      saveNum(KEY_OFFSET,offset);
      applyDevice(lastDeviceRaw,'calibrated');
      const diff=Math.round(delta(lastDeviceHeading,lastGpsHeading));
      setStatus('Set from GPS. Difference now about '+diff+'°. No figure‑8 needed.','ok');
    });
    return p;
  }
  function updatePanelReadout(){
    const p=document.getElementById('barCompassPanel');
    if(!p) return;
    const degEl=p.querySelector('#barCompassLiveDeg');
    const dirEl=p.querySelector('#barCompassLiveDir');
    const srcEl=p.querySelector('#barCompassLiveSource');
    if(degEl) degEl.textContent=String(Math.round(heading)).padStart(3,'0')+'°';
    if(dirEl) dirEl.textContent=dir(heading);
    if(srcEl) srcEl.textContent=sourceText();
  }
  function showPanel(){
    const p=ensurePanel(true);
    p.classList.add('show');
    updatePanelReadout();
  }
  function hidePanel(){
    const p=document.getElementById('barCompassPanel');
    if(p) p.classList.remove('show','pinned');
  }
  function togglePanel(){
    const p=ensurePanel(true);
    if(p.classList.contains('show')) hidePanel(); else {p.classList.add('show','pinned'); updatePanelReadout();}
  }
  function install(){
    if(installing) return;
    installing=true;
    document.querySelectorAll('.big-compass-overlay,#bigCompassOverlay').forEach(el=>{try{el.remove();}catch(e){}});
    const c=ensureMarkup();
    if(!c) {installing=false; return;}
    c.addEventListener('click',function(e){
      e.preventDefault();e.stopImmediatePropagation();
      if(!active) activate(true); else togglePanel();
    },true);
    c.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopImmediatePropagation(); if(!active) activate(true); else togglePanel();}
    },true);
    let pressTimer=null;
    c.addEventListener('pointerdown',()=>{clearTimeout(pressTimer);pressTimer=setTimeout(()=>{activate(false);showPanel();const p=document.getElementById('barCompassPanel'); if(p)p.classList.add('pinned');},550);},{passive:true,capture:true});
    ['pointerup','pointercancel','pointerleave'].forEach(ev=>c.addEventListener(ev,()=>clearTimeout(pressTimer),{passive:true,capture:true}));
    render(heading,sourceText(),false);
    const mode=(()=>{try{return localStorage.getItem(KEY_MODE);}catch(e){return null;}})();
    if(mode==='active') setTimeout(()=>activate(false),250);
    setInterval(()=>{render(hasRecentDevice()?lastDeviceHeading:(hasRecentGps()?lastGpsHeading:heading),sourceText(),false);updatePanelReadout();},1400);
    window.FIELD_MAP_COMPASS_VERSION=VERSION;
    installing=false;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
  setTimeout(install,650);
})();
