/* Settings pages, storage stats, backup export, clear data. */
const SETTINGS_SECTIONS = {
  save: { title: 'Save location', id: 'settingsSectionSave' },
  import: { title: 'Import Data', id: 'settingsSectionImport' },
  toolLayout: { title: 'Button layout', id: 'settingsSectionToolLayout' },
  production: { title: 'Diagnostics & Recovery', id: 'settingsSectionProduction' },
  security: { title: 'Security', id: 'settingsSectionSecurity' },
  storage: { title: 'Storage', id: 'settingsSectionStorage' },
  corrections: { title: 'Estimate corrections', id: 'settingsSectionCorrections' }
};

function settingsBody(){ return document.querySelector('#settingsPage .settings-body'); }

function showSettingsHome(){
  const home = document.getElementById('settingsHome');
  const title = document.getElementById('settingsTitle');
  const back = document.getElementById('settingsBackBtn');
  if(title) title.textContent = 'Settings';
  if(back) back.style.display = 'none';
  if(home) home.classList.remove('hidden');
  document.getElementById('settingsPage')?.classList.remove('section-open');
  document.querySelectorAll('#settingsPage .settings-section-page').forEach(p=>p.classList.remove('active'));
  { const b=settingsBody(); if(b) b.scrollTop=0; }
}

function openSettingsSection(section){
  const cfg = SETTINGS_SECTIONS[section];
  if(!cfg) return;
  const home = document.getElementById('settingsHome');
  const title = document.getElementById('settingsTitle');
  const back = document.getElementById('settingsBackBtn');
  if(home) home.classList.add('hidden');
  document.getElementById('settingsPage')?.classList.add('section-open');
  if(title) title.textContent = cfg.title;
  if(back) back.style.display = '';
  document.querySelectorAll('#settingsPage .settings-section-page').forEach(p=>p.classList.toggle('active',p.id===cfg.id));
  renderSettingsStats();
  if(section === 'security' && window.PinLock?.renderSettingsPanel) window.PinLock.renderSettingsPanel();
  if(section === 'security') renderSecurityAudit();
  if(section === 'toolLayout' && typeof renderToolLayoutSettings==='function') renderToolLayoutSettings();
  if(section === 'production' && typeof renderProductionPanel==='function') renderProductionPanel();
  if(section === 'corrections' && typeof renderCorrectionSettings==='function') renderCorrectionSettings();
  { const b=settingsBody(); if(b) b.scrollTop=0; }
  if(typeof updateScrollIndicators === 'function') requestAnimationFrame(updateScrollIndicators);
}

function closeSettingsSection(){
  showSettingsHome();
  renderSettingsStats();
  if(typeof updateScrollIndicators === 'function') requestAnimationFrame(updateScrollIndicators);
}

function renderAutoIndexButton(){
  const b=document.getElementById('autoIndexBtn');
  if(!b)return;
  b.textContent='Auto Index: '+(importAutoIndex?'On':'Off');
  b.classList.toggle('green',!!importAutoIndex);
  b.classList.toggle('secondary',!importAutoIndex);
}

function toggleExternalMapLinks(){
  const enabled=!(window.SecurityGuard?.externalLinksEnabled?.());
  if(window.SecurityGuard?.setExternalLinksEnabled) window.SecurityGuard.setExternalLinksEnabled(enabled);
  renderSecurityAudit();
}
function buildSecurityAuditHTML(){
  const sg=window.SecurityGuard?.status?.()||{};
  const externalEnabled=window.SecurityGuard?.externalLinksEnabled?.()!==false;
  const stores=(sg.localDataStores||['IndexedDB','localStorage']).join(', ');
  const hosts=(sg.allowedExternalOpenHosts||[]).join(', ');
  const externalDomains=[
    'unpkg.com (Leaflet library)',
    'OpenStreetMap / Esri / Google / Carto / OpenTopoMap tile images',
    'Google Maps / Google Earth only when you press those buttons'
  ];
  return `<div class="security-audit">
    <h3>Security pass</h3>
    <div class="security-audit-grid">
      ${field('Local uploads','FileReader only')}
      ${field('Stored data',esc(stores))}
      ${field('Auto upload','Blocked')}
      ${field('External fetch/XHR','Blocked')}
      ${field('External beacon','Blocked')}
      ${field('External map links',externalEnabled?'On':'Off')}
    </div>
    <div class="security-note"><b>What can leave the device?</b><span>No imported JSON/CSV/TXT files are uploaded by the app. Map tile providers can still receive normal tile requests for the map area you view. Google Maps/Earth receive coordinates only when you press a Google button.</span></div>
    <div class="security-note"><b>Allowed external destinations</b><span>${externalDomains.map(esc).join('<br>')}</span></div>
    <div class="security-note"><b>Blocked by runtime guard</b><span>External fetch, XHR, beacon, form submits, and non-Google external popups.</span></div>
    <div class="actions"><button class="secondary" onclick="toggleExternalMapLinks()">${externalEnabled?'Turn off':'Turn on'} Google map links</button></div>
  </div>`;
}
function renderSecurityAudit(){
  const e=document.getElementById('securityAuditSettings');
  if(e)e.innerHTML=buildSecurityAuditHTML();
}

let dataCountBreakdownOpen=false;
function toggleDataCountBreakdown(){dataCountBreakdownOpen=!dataCountBreakdownOpen;renderSettingsStats();}
async function toggleAutoIndex(){
  const next=!importAutoIndex;
  const msg=next
    ? 'Enable Auto Index?\n\nThe app will build the search index straight after importing. This makes search ready immediately but can take longer on large files.'
    : 'Disable Auto Index?\n\nImports will load/save faster, but the search index will be built later when needed.';
  if(!confirm(msg))return;
  importAutoIndex=next;
  try{localStorage.setItem(IMPORT_AUTO_INDEX_KEY,JSON.stringify(importAutoIndex));}catch(e){}
  renderAutoIndexButton();
  if(importAutoIndex && allRecords.length && !searchIndex.length){
    const filesBeingIndexed=(typeof sourceFileSummary==='function')?sourceFileSummary(allRecords,14):[];
    showBusyOverlay('Auto-indexing. Please wait...',(typeof autoIndexBusyHTML==='function'?autoIndexBusyHTML('Building fast search index...',filesBeingIndexed):'Building fast search index...'),{html:typeof autoIndexBusyHTML==='function'});
    try{
      if(typeof sleepFrame==='function') await sleepFrame();
      await rebuildIndexAsync((done,total)=>{
        if(typeof autoIndexBusyHTML==='function')updateBusy(autoIndexBusyHTML(`Auto-indexing. Please wait... ${Number(done||0).toLocaleString()} / ${Number(total||0).toLocaleString()} records`,filesBeingIndexed),{html:true});
        else updateBusy(`Auto-indexing. Please wait... ${done.toLocaleString()} / ${total.toLocaleString()} records`);
      });
      renderSettingsStats();
      await finishBusyOverlay('Auto index completed');
    }catch(e){hideBusyOverlay();alert('Auto index failed: '+(e.message||e));}
  }
}
function recordHealthType(r){
  const k=String(r?.__kind||getType?.(r)||'asset').toLowerCase();
  if(k.includes('conductor')||r?.__conductor)return 'details';
  if(k.includes('depot')||k.includes('base'))return 'bases';
  if(k.includes('substation')||k.includes('terminal')||k.includes('site'))return 'sites';
  return 'points';
}
function hasHealthRoute(r){
  try{return !!((typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):lineCandidates(r))||[]).length;}catch(e){return !!String(r?.__line||r?.LINE_NAME||r?.ROUTE||r?.CIRCUIT||'').trim();}
}
function buildDataCountBreakdownHTML(records){
  if(!dataCountBreakdownOpen)return '<div class="actions data-breakdown-actions"><button class="secondary" onclick="toggleDataCountBreakdown()">Data Count Breakdown</button></div>';
  const sourceMap=new Map();
  const dupeSeen=new Set();
  const overall={records:0,gps:0,noGps:0,noRoute:0,points:0,sites:0,bases:0,details:0,dupes:0};
  const add=(name,r)=>{
    let row=sourceMap.get(name);
    if(!row){row={file:name,records:0,gps:0,noGps:0,noRoute:0,points:0,sites:0,bases:0,details:0,dupes:0};sourceMap.set(name,row);}
    row.records++; overall.records++;
    const gpsOk=(typeof hasGPS==='function'?hasGPS(r):!!r?.__hasGPS);
    if(gpsOk){row.gps++;overall.gps++;}else{row.noGps++;overall.noGps++;}
    if(!hasHealthRoute(r)){row.noRoute++;overall.noRoute++;}
    const t=recordHealthType(r); row[t]++; overall[t]++;
    if(typeof importDedupeKey==='function'){
      const k=importDedupeKey(r);
      if(k){if(dupeSeen.has(k)){row.dupes++;overall.dupes++;}else dupeSeen.add(k);}
    }
  };
  for(const r of records||[]){
    const name=String((r&&(r.__sourceFile||(r.original&&r.original.__sourceFile)||r.SOURCE_FILE||r.sourceFile||r.fileName||r.filename))||'Unknown source').trim()||'Unknown source';
    add(name,r);
  }
  const rows=[overall,...Array.from(sourceMap.values()).sort((a,b)=>b.records-a.records||a.file.localeCompare(b.file))];
  const table=rows.map((x,i)=>`<div class="data-count-row ${i===0?'total':''}"><b>${esc(i===0?'TOTAL ACCEPTED':x.file)}</b><span>records ${Number(x.records||0).toLocaleString()} · GPS ${Number(x.gps||0).toLocaleString()} · no GPS ${Number(x.noGps||0).toLocaleString()}</span><small>points ${Number(x.points||0).toLocaleString()} · sites ${Number(x.sites||0).toLocaleString()} · bases ${Number(x.bases||0).toLocaleString()} · details ${Number(x.details||0).toLocaleString()}</small><small>no route/group ${Number(x.noRoute||0).toLocaleString()} · possible duplicates ${Number(x.dupes||0).toLocaleString()}</small></div>`).join('');
  const audit=(typeof lastImportAudit!=='undefined'&&lastImportAudit&&lastImportAudit.length)
    ? '<div class="data-count-audit"><b>Last import skipped</b>'+lastImportAudit.map(a=>`<span>${esc(a.file)} <em>accepted ${Number(a.imported||0).toLocaleString()} · GPS ${Number(a.gps||0).toLocaleString()} · duplicate ${Number(a.duplicates||0).toLocaleString()} · no-ID ${Number(a.skippedNoId||0).toLocaleString()} · geometry-only ${Number(a.skippedGeometry||0).toLocaleString()}</em></span>`).join('')+'</div>'
    : '<div class="help">Last import skipped counts appear here after importing.</div>';
  return `<div class="actions data-breakdown-actions"><button class="secondary" onclick="toggleDataCountBreakdown()">Hide Data Count Breakdown</button></div><div class="data-count-breakdown">${table}${audit}</div>`;
}
function buildDataHealthHTML(){
  const records=allRecords||[];
  let gps=0,noGps=0,noRoute=0,details=0,dupes=0;
  const seen=new Set();
  for(const r of records){
    if(typeof hasGPS==='function' ? hasGPS(r) : r&&r.__hasGPS) gps++; else noGps++;
    if(!hasHealthRoute(r)) noRoute++;
    if(String(r?.__kind||'').toLowerCase()==='conductor' || r?.__conductor) details++;
    if(typeof importDedupeKey==='function'){
      const k=importDedupeKey(r);
      if(k){if(seen.has(k))dupes++; else seen.add(k);}
    }
  }
  const sources=(typeof sourceFileSummary==='function')?sourceFileSummary(records,8):[];
  const sourceHtml=sources.length?`<div class="data-health-sources"><b>Source files</b>${sources.map(x=>`<span>${esc(x.name)} <em>${Number(x.count||0).toLocaleString()}</em></span>`).join('')}</div>`:'';
  return `<div class="data-health"><h3>Data Health</h3><div class="data-health-grid">${field('Records',Number(records.length||0).toLocaleString())}${field('GPS records',Number(gps||0).toLocaleString())}${field('No GPS',Number(noGps||0).toLocaleString())}${field('No route/group',Number(noRoute||0).toLocaleString())}${field('Possible duplicates',Number(dupes||0).toLocaleString())}${field('Details linked',Number(details||0).toLocaleString())}</div>${sourceHtml}${buildDataCountBreakdownHTML(records)}</div>`;
}
function renderSettingsStats(){
  let e=document.getElementById("settingsStats");
  const gps=(typeof fastGPSCount==='function'?fastGPSCount():0);
  const details=(typeof countConductors==='function'?countConductors():0);
  if(e)e.innerHTML=field("Records",Number(allRecords.length||0).toLocaleString())+field("Indexed",Number(searchIndex.length||0).toLocaleString())+field("GPS assets",Number(gps||0).toLocaleString())+field("Details",Number(details||0).toLocaleString())+field("Save folder",(typeof exportFolderStatusText==="function"?exportFolderStatusText():"Not available"))+buildDataHealthHTML();
  renderAutoIndexButton();
  if(typeof renderImportQueue==='function') renderImportQueue();
  if(window.PinLock?.renderSettingsPanel) window.PinLock.renderSettingsPanel();
  renderSecurityAudit();
}
function exportBackup(){let data={exportedAt:new Date().toISOString(),recordCount:allRecords.length,records:allRecords,pois,heliMarks,estimateCorrections:(typeof routeEstimateCorrections==='function'?routeEstimateCorrections():{})};if(typeof safeExportJSON==="function"){safeExportJSON("field-map-backup.json",data,{title:"Field MAP backup export",forcePanel:true});showToolStatus?.("Backup export ready.");return;}let blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="field-map-backup.json";document.body.appendChild(a);a.click();setTimeout(()=>{try{URL.revokeObjectURL(a.href);a.remove();}catch(e){}},1200)}
async function clearData(){if(confirm("Clear all imported data?")){allRecords=[];searchIndex=[];lineSearchCache=[];circuitGroups=[];visibleRecords=[];pois=[];heliMarks=[];if(typeof invalidatePatrolRouteCache==='function')invalidatePatrolRouteCache();if(typeof clearRouteSegmentCache==='function')clearRouteSegmentCache();save();localStorage.removeItem(POI_KEY);localStorage.removeItem(HELI_KEY);if(typeof clearRecordsDB==='function')await clearRecordsDB();updateKPIs();renderSettingsStats()}}
