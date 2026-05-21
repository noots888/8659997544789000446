/* Production hardening: diagnostics, safe mode, hard refresh, export everything. v3.8.7 */
const PROD_HARDENING_VERSION='3.8.8';
const PROD_SAFE_MODE_KEY='asset_tracker_production_safe_mode_v1';
const PROD_LAST_ERROR_KEY='asset_tracker_last_runtime_error_v1';
const PROD_LAST_REFRESH_KEY='asset_tracker_last_hard_refresh_v1';

(function initProductionHardening(){
  try{
    window.addEventListener('error',e=>saveProductionError({type:'error',message:e.message,source:e.filename,line:e.lineno,col:e.colno,at:new Date().toISOString()}));
    window.addEventListener('unhandledrejection',e=>saveProductionError({type:'promise',message:String(e.reason&&e.reason.message||e.reason||'Unhandled promise rejection'),at:new Date().toISOString()}));
    document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{if(isProductionSafeMode())applyProductionSafeMode();},700);});
  }catch(e){}
})();

function productionEsc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function productionField(k,v){return `<div class="prod-field"><b>${productionEsc(k)}</b><span>${productionEsc(v===''||v==null?'-':v)}</span></div>`;}
function saveProductionError(obj){try{localStorage.setItem(PROD_LAST_ERROR_KEY,JSON.stringify(obj||{}));}catch(e){}}
function readProductionError(){try{return JSON.parse(localStorage.getItem(PROD_LAST_ERROR_KEY)||'null');}catch(e){return null;}}
function isProductionSafeMode(){try{return localStorage.getItem(PROD_SAFE_MODE_KEY)==='1';}catch(e){return false;}}

function enableProductionSafeMode(){
  try{localStorage.setItem(PROD_SAFE_MODE_KEY,'1');}catch(e){}
  location.reload();
}
function disableProductionSafeMode(){
  try{localStorage.removeItem(PROD_SAFE_MODE_KEY);}catch(e){}
  location.reload();
}
function clearProductionErrorLog(){
  try{localStorage.removeItem(PROD_LAST_ERROR_KEY);}catch(e){}
  renderProductionPanel?.();
}

function applyProductionSafeMode(){
  document.body.classList.add('production-safe-mode-active');
  try{ if(typeof closeDrawer==='function') closeDrawer(); }catch(e){}
  try{ if(typeof closePlus==='function') closePlus(); }catch(e){}
  try{ if(typeof closeMapLayerSheet==='function') closeMapLayerSheet(); }catch(e){}
  const clear=(name)=>{try{const layer=eval('typeof '+name+'!=="undefined"?'+name+':null'); if(layer&&layer.clearLayers)layer.clearLayers();}catch(e){}};
  ['assetLayer','crossingLayer','radiusLayer','measureLayer','breadcrumbLayer'].forEach(clear);
  try{selected=null;selectedMarker=null;crossingsEnabled=false;radiusOn=false;measureOn=false;multiMeasureOn=false;breadcrumbOn=false;}catch(e){}
  let b=document.getElementById('productionSafeModeBanner');
  if(!b){b=document.createElement('div');b.id='productionSafeModeBanner';document.body.appendChild(b);}
  b.innerHTML='<b>Safe Mode</b><span>Map overlays are parked. Import, Settings, Backup and Recovery stay available.</span><button type="button" onclick="disableProductionSafeMode()">Exit</button>';
  try{showToolStatus?.('Safe Mode active: overlays parked.');}catch(e){}
}

async function hardRefreshApp(){
  if(!confirm('Hard refresh the app cache now?\n\nThis clears the app shell/service-worker cache only. It does NOT delete imported asset data, corrections, POIs or settings.'))return;
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister().catch(()=>null)));
    }
    if(window.caches){
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>/asset|tracker|field|map/i.test(k)).map(k=>caches.delete(k).catch(()=>null)));
    }
    try{localStorage.setItem(PROD_LAST_REFRESH_KEY,new Date().toISOString());}catch(e){}
  }catch(e){
    alert('Hard refresh had a problem: '+(e.message||e));
  }
  const url=new URL(location.href);url.searchParams.set('fresh',Date.now());location.replace(url.toString());
}

function collectProductionDiagnostics(){
  const recs=(typeof allRecords!=='undefined'&&Array.isArray(allRecords))?allRecords:[];
  let gps=0,noGps=0,noRoute=0,details=0;
  for(const r of recs){
    try{(typeof hasGPS==='function'?hasGPS(r):!!r.__hasGPS)?gps++:noGps++;}catch(e){noGps++;}
    try{if(typeof hasHealthRoute==='function'&&!hasHealthRoute(r))noRoute++;}catch(e){}
    try{if(String(r&&r.__kind||'').toLowerCase()==='conductor'||(r&&r.__conductor))details++;}catch(e){}
  }
  let sw='Unavailable';
  if('serviceWorker' in navigator) sw=(navigator.serviceWorker.controller?'Active':'Supported / not controlling yet');
  let ls='OK';try{localStorage.setItem('__prod_test','1');localStorage.removeItem('__prod_test');}catch(e){ls='Blocked';}
  let idb='Available';try{if(!('indexedDB' in window))idb='Unavailable';}catch(e){idb='Unknown';}
  let corrections=0;try{const c=(typeof routeEstimateCorrections==='function'?routeEstimateCorrections():{});corrections=Object.keys(c||{}).length;}catch(e){}
  return {
    version:PROD_HARDENING_VERSION,
    appRecords:recs.length,
    gps,noGps,noRoute,details,corrections,
    safeMode:isProductionSafeMode()?'On':'Off',
    localStorage:ls,indexedDB:idb,serviceWorker:sw,
    baseLayer:(typeof currentBaseLayerId!=='undefined'?currentBaseLayerId:'unknown'),
    mapReady:(typeof map!=='undefined'&&map?'Yes':'No'),
    lastRefresh:(()=>{try{return localStorage.getItem(PROD_LAST_REFRESH_KEY)||'Never';}catch(e){return 'Unknown';}})(),
    lastError:readProductionError()
  };
}

function buildImportValidationHTML(){
  let html='<div class="prod-subcard"><h4>Final import validation</h4>';
  if(typeof lastImportAudit!=='undefined'&&Array.isArray(lastImportAudit)&&lastImportAudit.length){
    html += '<div class="prod-audit-list">'+lastImportAudit.map(a=>`<div class="prod-audit-row"><b>${productionEsc(a.file||'Imported file')}</b><span>accepted ${Number(a.imported||0).toLocaleString()} · extracted ${Number(a.extracted||0).toLocaleString()} · GPS ${Number(a.gps||0).toLocaleString()}</span><small>duplicates ${Number(a.duplicates||0).toLocaleString()} · no-ID ${Number(a.skippedNoId||0).toLocaleString()} · geometry-only ${Number(a.skippedGeometry||0).toLocaleString()}</small></div>`).join('')+'</div>';
  }else{
    html += '<p>No latest import audit is currently available. Re-import or import queued files to generate one.</p>';
  }
  try{
    if(typeof sourceFileSummary==='function'){
      const src=sourceFileSummary(allRecords||[],10);
      if(src&&src.length){html += '<div class="prod-source-list"><b>Loaded source files</b>'+src.map(x=>`<span>${productionEsc(x.name)} <em>${Number(x.count||0).toLocaleString()}</em></span>`).join('')+'</div>';}
    }
  }catch(e){}
  return html+'</div>';
}

function renderProductionPanel(){
  const e=document.getElementById('productionSettings');
  if(!e)return;
  const d=collectProductionDiagnostics();
  const err=d.lastError;
  e.innerHTML=`
    <div class="prod-grid">
      ${productionField('App version',d.version)}
      ${productionField('Safe Mode',d.safeMode)}
      ${productionField('Records',Number(d.appRecords||0).toLocaleString())}
      ${productionField('GPS records',Number(d.gps||0).toLocaleString())}
      ${productionField('No GPS',Number(d.noGps||0).toLocaleString())}
      ${productionField('No route/group',Number(d.noRoute||0).toLocaleString())}
      ${productionField('Corrections saved',Number(d.corrections||0).toLocaleString())}
      ${productionField('Base layer',d.baseLayer)}
      ${productionField('Map ready',d.mapReady)}
      ${productionField('Service worker',d.serviceWorker)}
      ${productionField('localStorage',d.localStorage)}
      ${productionField('IndexedDB',d.indexedDB)}
      ${productionField('Storage used','checking...')}
      ${productionField('Last hard refresh',d.lastRefresh)}
    </div>
    <div class="prod-subcard"><h4>Recovery</h4><div class="actions prod-actions">
      <button class="green" onclick="exportEverythingBackup()">Export Everything</button>
      <button class="secondary" onclick="hardRefreshApp()">Hard Refresh App</button>
      <button class="secondary" onclick="${isProductionSafeMode()?'disableProductionSafeMode':'enableProductionSafeMode'}()">${isProductionSafeMode()?'Exit Safe Mode':'Start Safe Mode'}</button>
      <button class="secondary" onclick="clearProductionErrorLog()">Clear Error Log</button>
    </div><p>Hard Refresh clears app cache only. It does not delete imported records, corrections or saved settings.</p></div>
    <div class="prod-subcard"><h4>Last error / crash</h4>${err?`<p><b>${productionEsc(err.type||'error')}</b>: ${productionEsc(err.message||'Unknown error')}</p><small>${productionEsc(err.at||'')} ${productionEsc(err.source||'')} ${productionEsc(err.line||'')}</small>`:'<p>No runtime error saved.</p>'}</div>
    ${buildImportValidationHTML()}
  `;
  updateProductionStorageEstimate();
}

async function updateProductionStorageEstimate(){
  const fields=[...document.querySelectorAll('#productionSettings .prod-field')];
  const target=fields.find(x=>String(x.querySelector('b')?.textContent||'').includes('Storage used'))?.querySelector('span');
  if(!target)return;
  try{
    if(navigator.storage&&navigator.storage.estimate){
      const est=await navigator.storage.estimate();
      const used=est.usage?formatBytes(est.usage):'Unknown';
      const quota=est.quota?formatBytes(est.quota):'Unknown';
      target.textContent=`${used} / ${quota}`;
    }else target.textContent='Unavailable';
  }catch(e){target.textContent='Unknown';}
}
function formatBytes(n){n=Number(n||0);if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';if(n<1073741824)return (n/1048576).toFixed(1)+' MB';return (n/1073741824).toFixed(2)+' GB';}

function exportEverythingBackup(){
  const collectLocalSettings=()=>{
    const out={};
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i)||'';
        if(/pin|auth|lock|session/i.test(k))continue;
        if(/asset_tracker|field|map|display|import/i.test(k))out[k]=localStorage.getItem(k);
      }
    }catch(e){}
    return out;
  };
  const data={
    exportType:'field-map-everything-backup',
    version:PROD_HARDENING_VERSION,
    exportedAt:new Date().toISOString(),
    diagnostics:collectProductionDiagnostics(),
    records:(typeof allRecords!=='undefined'?allRecords:[]),
    corrections:(typeof routeEstimateCorrections==='function'?routeEstimateCorrections():{}),
    pois:(typeof pois!=='undefined'?pois:[]),
    patrolMarks:(typeof heliMarks!=='undefined'?heliMarks:[]),
    displaySettings:(typeof displaySettings!=='undefined'?displaySettings:{}),
    mapToggleSettings:(typeof mapToggleSettings!=='undefined'?mapToggleSettings:{}),
    importAudit:(typeof lastImportAudit!=='undefined'?lastImportAudit:[]),
    localSettings:collectLocalSettings()
  };
  if(typeof safeExportJSON==='function'){
    safeExportJSON('field-map-everything-backup.json',data,{title:'Export Everything',forcePanel:true});
    showToolStatus?.('Export Everything ready.');
    return;
  }
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='field-map-everything-backup.json';document.body.appendChild(a);a.click();setTimeout(()=>{try{URL.revokeObjectURL(a.href);a.remove();}catch(e){}},1200);
}
