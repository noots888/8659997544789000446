/* Entry point. Keep this last in index.html. */
init();

/* v2.7.4 global UI polish: click animation classes + scroll indicators */
(function(){
  function pressOn(el){
    if(!el || el.classList.contains('kb-key')) return;
    el.classList.add('tap-press');
    clearTimeout(el._tapPressTimer);
    el._tapPressTimer=setTimeout(()=>el.classList.remove('tap-press'),130);
  }
  document.addEventListener('pointerdown',function(e){
    const el=e.target.closest('button,[role="button"],.result,.card,input[type="button"]');
    if(el) pressOn(el);
  },{passive:true});
  ['pointerup','pointercancel','pointerleave','blur'].forEach(ev=>{
    document.addEventListener(ev,function(e){
      const el=e.target.closest && e.target.closest('.tap-press');
      if(el){ clearTimeout(el._tapPressTimer); el._tapPressTimer=setTimeout(()=>el.classList.remove('tap-press'),80); }
    },true);
  });
  function updateScrollIndicators(){
    document.querySelectorAll('.drawer .body,#resultsBox,.search-results,.settings-scroll,.settings-body,.scrollable-panel').forEach(el=>{
      const scrollable=el.scrollHeight>el.clientHeight+8;
      el.classList.toggle('has-scroll-indicator',scrollable);
      if(scrollable){
        const atBottom=(el.scrollTop+el.clientHeight)>=el.scrollHeight-12;
        el.classList.toggle('at-bottom',atBottom);
      }else{
        el.classList.remove('at-bottom');
      }
    });
  }
  window.updateScrollIndicators=updateScrollIndicators;
  document.addEventListener('scroll',function(e){
    if(e.target && e.target.classList && e.target.classList.contains('has-scroll-indicator')) updateScrollIndicators();
  },true);
  let scrollIndicatorPending=false;
  const scheduleScrollIndicatorUpdate=()=>{
    if(scrollIndicatorPending)return;
    scrollIndicatorPending=true;
    requestAnimationFrame(()=>{scrollIndicatorPending=false;updateScrollIndicators();});
  };
  const mo=new MutationObserver((mutations)=>{
    // Do not let Leaflet marker/tile DOM churn trigger scroll-indicator work during heavy map draws.
    for(const m of mutations){
      const t=m.target;
      if(t && t.closest && t.closest('#map')) continue;
      scheduleScrollIndicatorUpdate();
      break;
    }
  });
  function observeUiScrollHosts(){
    ['drawer','settingsPage','assetIndexPage','poiPage'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) mo.observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeUiScrollHosts,{once:true}); else observeUiScrollHosts();
  window.addEventListener('resize',scheduleScrollIndicatorUpdate,{passive:true});
  setInterval(()=>{
    if(document.body.classList.contains('drawer-open')||document.body.classList.contains('settings-open')||document.body.classList.contains('asset-index-open')) scheduleScrollIndicatorUpdate();
  },7000);
  requestAnimationFrame(updateScrollIndicators);
})();

/* v3.7.8 Big live compass + easier calibration check */
(function(){
  const STORAGE_KEY='fieldMapBigCompassLastHeading';
  let compassReady=false;
  let compassOpen=false;
  let currentHeading=Number(localStorage.getItem(STORAGE_KEY));
  if(!Number.isFinite(currentHeading)) currentHeading=0;
  let geoWatchId=null;
  let lastDeviceHeading=null;
  let lastGpsHeading=null;
  let headingSamples=[];
  let calibrationRunning=false;

  function norm(deg){
    deg=Number(deg);
    if(!Number.isFinite(deg)) return 0;
    deg=deg%360;
    if(deg<0) deg+=360;
    return deg;
  }
  function cardinal(deg){
    const dirs=['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(norm(deg)/45)%8];
  }
  function setHeading(deg,source){
    currentHeading=norm(deg);
    try{localStorage.setItem(STORAGE_KEY,String(Math.round(currentHeading)));}catch(e){}
    document.documentElement.style.setProperty('--big-compass-heading',currentHeading+'deg');
    const small=document.querySelector('.compass');
    if(small){
      small.style.setProperty('--small-compass-heading',currentHeading+'deg');
      small.setAttribute('title','Compass '+Math.round(currentHeading)+'° '+cardinal(currentHeading));
    }
    const degEl=document.getElementById('bigCompassDeg');
    const dirEl=document.getElementById('bigCompassDir');
    const srcEl=document.getElementById('bigCompassSource');
    if(degEl) degEl.textContent=Math.round(currentHeading).toString().padStart(3,'0')+'°';
    if(dirEl) dirEl.textContent=cardinal(currentHeading);
    if(srcEl && source) srcEl.textContent=source;
  }
  function headingFromOrientation(e){
    let h=null;
    if(typeof e.webkitCompassHeading==='number') h=e.webkitCompassHeading;
    else if(e.absolute===true && typeof e.alpha==='number') h=360-e.alpha;
    else if(typeof e.alpha==='number') h=360-e.alpha;
    if(Number.isFinite(h)){
      h=norm(h);
      lastDeviceHeading=h;
      if(calibrationRunning) headingSamples.push({t:Date.now(),h});
      setHeading(h,'Device compass');
    }
  }
  function startOrientation(){
    try{
      if(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission==='function'){
        DeviceOrientationEvent.requestPermission().then(state=>{
          if(state==='granted'){
            window.addEventListener('deviceorientationabsolute',headingFromOrientation,true);
            window.addEventListener('deviceorientation',headingFromOrientation,true);
            const src=document.getElementById('bigCompassSource');
            if(src) src.textContent='Device compass';
          }else{
            startGpsFallback('Compass permission blocked');
          }
        }).catch(()=>startGpsFallback('Compass permission unavailable'));
      }else{
        window.addEventListener('deviceorientationabsolute',headingFromOrientation,true);
        window.addEventListener('deviceorientation',headingFromOrientation,true);
        const src=document.getElementById('bigCompassSource');
        if(src) src.textContent='Device compass';
        startGpsFallback('Device compass / GPS fallback');
      }
    }catch(e){
      startGpsFallback('GPS heading fallback');
    }
  }
  function startGpsFallback(label){
    const src=document.getElementById('bigCompassSource');
    if(src) src.textContent=label||'GPS heading fallback';
    if(!navigator.geolocation || geoWatchId!==null) return;
    try{
      geoWatchId=navigator.geolocation.watchPosition(pos=>{
        const c=pos.coords||{};
        if(Number.isFinite(c.heading) && c.heading>=0){
          lastGpsHeading=norm(c.heading);
          if(lastDeviceHeading===null) setHeading(lastGpsHeading,'GPS heading');
        }
      },()=>{}, {enableHighAccuracy:true,maximumAge:1000,timeout:12000});
    }catch(e){}
  }
  function headingDelta(a,b){
    const d=Math.abs(norm(a)-norm(b));
    return Math.min(d,360-d);
  }
  function circularStats(samples){
    if(!samples.length) return {count:0,spread:999,mean:null};
    let sx=0,sy=0;
    for(const s of samples){ const r=norm(s.h)*Math.PI/180; sx+=Math.cos(r); sy+=Math.sin(r); }
    const mean=norm(Math.atan2(sy,sx)*180/Math.PI);
    let max=0;
    for(const s of samples) max=Math.max(max,headingDelta(s.h,mean));
    return {count:samples.length,spread:max,mean};
  }
  function setCalibrationStatus(text,tone){
    const el=document.getElementById('bigCompassCalibrationStatus');
    if(!el) return;
    el.textContent=text;
    el.className='big-compass-cal-status '+(tone||'');
  }
  function runCompassCalibrationCheck(){
    if(calibrationRunning) return;
    buildCompass();
    if(!compassReady){ compassReady=true; startOrientation(); }
    startGpsFallback('Calibration check');
    calibrationRunning=true;
    headingSamples=[];
    setCalibrationStatus('Calibrating 0% — hold phone flat, keep away from steel, then move in a slow figure-8.','checking');
    const btn=document.getElementById('bigCompassCalibrateBtn');
    if(btn) btn.disabled=true;
    let ticks=0;
    const timer=setInterval(()=>{
      ticks++;
      const pct=Math.min(100,Math.round((ticks/8)*100));
      const count=headingSamples.length;
      setCalibrationStatus('Calibrating '+pct+'% — slow figure-8, then turn left/right once. Samples '+count+'.','checking');
      if(ticks>=8){
        clearInterval(timer);
        calibrationRunning=false;
        if(btn) btn.disabled=false;
        const recent=headingSamples.filter(s=>Date.now()-s.t<7000);
        const st=circularStats(recent);
        if(st.count<4){
          setCalibrationStatus('No steady compass signal. Move away from ute/steel, allow motion permission, then tap Calibrate again. GPS heading will be used while moving.','bad');
          return;
        }
        let msg='Done. Compass signal found. ';
        let tone='ok';
        if(st.spread>45){ msg+='Unstable. Move away from vehicle steel/power hardware and redo the figure-8.'; tone='bad'; }
        else if(st.spread>22){ msg+='Slight drift. Good enough for rough bearing, but recheck away from metal.'; tone='warn'; }
        else { msg+='Stable enough.'; }
        if(lastGpsHeading!==null && lastDeviceHeading!==null){
          const diff=Math.round(headingDelta(lastDeviceHeading,lastGpsHeading));
          msg+=' GPS check: '+diff+'° difference while moving.';
          if(diff>35){ msg+=' Compass may be off — trust GPS heading while moving and recalibrate.'; tone='warn'; }
        }else{
          msg+=' GPS check needs movement with GPS lock.';
        }
        setCalibrationStatus(msg,tone);
      }
    },1000);
  }
  function buildCompass(){
    if(document.getElementById('bigCompassOverlay')) return;
    const overlay=document.createElement('div');
    overlay.id='bigCompassOverlay';
    overlay.className='big-compass-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`
      <div class="big-compass-card" role="dialog" aria-label="Compass">
        <button class="big-compass-close" type="button" aria-label="Close compass">×</button>
        <div class="big-compass-top"><b>Compass</b><span id="bigCompassSource">Tap to activate</span></div>
        <div class="big-compass-bezel">
          <div class="big-compass-lubber">▲</div>
          <div class="big-compass-rose">
            <div class="tick major n"><b>N</b></div><div class="tick major e"><b>E</b></div><div class="tick major s"><b>S</b></div><div class="tick major w"><b>W</b></div>
            <div class="tick ne">NE</div><div class="tick se">SE</div><div class="tick sw">SW</div><div class="tick nw">NW</div>
            <div class="big-compass-ring"></div>
            <div class="big-compass-needle"><span></span></div>
          </div>
        </div>
        <div class="big-compass-readout"><b id="bigCompassDeg">000°</b><span id="bigCompassDir">N</span></div>
        <button class="big-compass-cal-btn" id="bigCompassCalibrateBtn" type="button">Calibrate / check compass</button>
        <div class="big-compass-cal-steps"><b>Quick calibration:</b> phone flat → slow figure-8 → turn left/right once.</div>
        <div class="big-compass-cal-status" id="bigCompassCalibrationStatus">Tap Calibrate if the bearing seems off. Keep away from ute steel, magnets and hardware.</div>
        <div class="big-compass-hint">GPS heading is used as fallback when moving.</div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{ if(e.target===overlay) closeBigCompass(); });
    overlay.querySelector('.big-compass-close')?.addEventListener('click',closeBigCompass);
    overlay.querySelector('#bigCompassCalibrateBtn')?.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();runCompassCalibrationCheck();});
  }
  function openBigCompass(){
    buildCompass();
    compassOpen=true;
    document.body.classList.add('big-compass-open');
    const overlay=document.getElementById('bigCompassOverlay');
    if(overlay){ overlay.classList.add('open'); overlay.setAttribute('aria-hidden','false'); }
    setHeading(currentHeading,'Starting compass...');
    if(!compassReady){ compassReady=true; startOrientation(); }
  }
  function closeBigCompass(){
    compassOpen=false;
    document.body.classList.remove('big-compass-open');
    const overlay=document.getElementById('bigCompassOverlay');
    if(overlay){ overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); }
  }
  function wireSmallCompass(){
    const small=document.querySelector('.compass');
    if(!small || small.dataset.bigCompassReady==='1') return;
    small.dataset.bigCompassReady='1';
    small.setAttribute('role','button');
    small.setAttribute('aria-label','Open large compass');
    small.tabIndex=0;
    small.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openBigCompass();});
    small.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openBigCompass();}});
    setHeading(currentHeading,'Ready');
  }
  window.openBigCompass=openBigCompass;
  window.runCompassCalibrationCheck=runCompassCalibrationCheck;
  window.closeBigCompass=closeBigCompass;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wireSmallCompass,{once:true}); else wireSmallCompass();
})();
