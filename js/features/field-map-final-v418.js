/* Field MAP v4.1.8 consolidated runtime fixes.
   This replaces the old stacked field-map-fixes-v388...v414 files while preserving load order. */

/* ---- js/features/field-map-fixes-v388.js ---- */
/* Field MAP v3.8.8 integrated fix pack
   - one-folder exports, GPS tracking, PIN gating, cleaner filters/layout, persistent breadcrumbs,
     full clear, 3 km click stability, estimate correction controls, and layer cleanup. */
(function(){
  'use strict';
  const APP_NAME='Field MAP';
  const EXPORT_SUBFOLDER='Field MAP';
  const BREADCRUMB_KEY='field_map_breadcrumb_points_v1';
  const AUTH_SESSION_KEY='assetTracker.auth.unlocked';
  const AUTH_SETTINGS_KEY='assetTracker.auth.v1';
  let gpsTrackWatchId=null;
  let gpsWakeLock=null;
  let gpsTrackActive=false;
  let safeExportUrl=null;

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function status(t){try{showToolStatus?.(t);}catch(e){}}
  function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch(e){return fallback;}}
  function writeJSON(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
  function authEnabled(){try{const s=JSON.parse(localStorage.getItem(AUTH_SETTINGS_KEY)||'{}');return !!(s&&s.enabled&&s.pinHash);}catch(e){return false;}}
  function isLocked(){return !!document.getElementById('authLockOverlay')?.classList.contains('show');}
  function currentBreadcrumbs(){return Array.isArray(window.breadcrumbPoints)?window.breadcrumbPoints:breadcrumbPoints;}
  function setBreadcrumbs(points){try{breadcrumbPoints=Array.isArray(points)?points:[];}catch(e){} window.breadcrumbPoints=breadcrumbPoints;}

  function applyName(){
    document.title=APP_NAME;
    document.querySelectorAll('[id="authTitle"]').forEach(el=>{if(/Field Map|Asset Tracker/i.test(el.textContent||''))el.textContent='Unlock '+APP_NAME;});
    document.querySelectorAll('.asset-index-title b').forEach(el=>{if((el.textContent||'').trim()==='Asset Index')el.textContent=APP_NAME+' Index';});
  }

  function ensureSafeExportSheet(){
    let sheet=document.getElementById('safeExportSheet');
    if(!sheet){
      sheet=document.createElement('div');
      sheet.id='safeExportSheet';
      sheet.className='safe-export-sheet';
      sheet.innerHTML=`
        <div class="safe-export-card">
          <div class="safe-export-head">
            <div><b id="safeExportTitle">Save ready</b><span id="safeExportSub">Exports are saved to the chosen Field MAP folder where your browser allows it.</span></div>
            <button type="button" onclick="closeSafeExportSheet()">×</button>
          </div>
          <div class="safe-export-body">
            <div class="safe-export-file" id="safeExportFileName"></div>
            <div class="safe-export-actions">
              <button type="button" class="green" onclick="chooseSaveFolder()">Choose Field MAP folder</button>
              <button type="button" class="secondary" onclick="copySafeExportText()">Copy JSON</button>
              <button type="button" class="secondary" onclick="toggleSafeExportText()">Show text</button>
            </div>
            <div class="safe-export-help" id="safeExportHelp">No download is attempted. Pick one folder once, then exports write there.</div>
            <textarea id="safeExportTextarea" readonly spellcheck="false" style="display:none"></textarea>
          </div>
        </div>`;
      document.body.appendChild(sheet);
    }
    return sheet;
  }

  async function writeTextToChosenFolder(name,text,mime){
    if(typeof ensureExportFolder!=='function')return false;
    const folder=await ensureExportFolder(true);
    if(!folder)return false;
    const file=await folder.getFileHandle(name,{create:true});
    const writable=await file.createWritable();
    await writable.write(new Blob([String(text??'')],{type:mime||'application/octet-stream'}));
    await writable.close();
    return true;
  }
  window.writeTextToChosenFolder=writeTextToChosenFolder;

  function showExportPanel(name,text,opts){
    if(safeExportUrl){try{URL.revokeObjectURL(safeExportUrl);}catch(e){} safeExportUrl=null;}
    const sheet=ensureSafeExportSheet();
    const title=document.getElementById('safeExportTitle');
    const sub=document.getElementById('safeExportSub');
    const fn=document.getElementById('safeExportFileName');
    const help=document.getElementById('safeExportHelp');
    const ta=document.getElementById('safeExportTextarea');
    const size=(String(text||'').length/1024).toFixed(String(text||'').length>1024*1024?1:0);
    window.__fieldMapPendingExport={name,text:String(text??''),mime:opts?.mime||'application/json'};
    if(title)title.textContent=opts?.title||'Save ready';
    if(sub)sub.textContent=opts?.sub||'Exports go to the chosen Field MAP folder. Downloads are not used.';
    if(fn)fn.innerHTML=`<b>${esc(name)}</b><span>${size} KB</span>`;
    if(help)help.innerHTML=opts?.help||'If folder saving is unavailable in this browser/WebView, use Copy JSON and paste into a file inside your chosen folder.';
    if(ta){ta.value='';ta.style.display='none';}
    sheet.classList.add('show');
  }

  window.safeExportText=function safeExportText(name,text,mime,opts){
    const n=name||'field-map-export.json';
    const t=String(text??'');
    const m=mime||'application/json';
    (async()=>{
      try{
        const ok=await writeTextToChosenFolder(n,t,m);
        if(ok){status('Saved to Field MAP folder: '+n);return;}
        showExportPanel(n,t,{...(opts||{}),mime:m,sub:'Choose the Field MAP folder first. No download was attempted.'});
      }catch(e){
        showExportPanel(n,t,{...(opts||{}),mime:m,sub:'Folder save failed. No download was attempted.',help:esc(e.message||e)+'<br>Use Choose Field MAP folder, or Copy JSON if this WebView blocks folder saving.'});
      }
    })();
    return true;
  };
  window.safeExportJSON=function safeExportJSON(name,data,opts){
    return window.safeExportText(name,JSON.stringify(data,null,2),'application/json',opts||{});
  };
  window.copySafeExportText=async function copySafeExportText(){
    const payload=window.__fieldMapPendingExport||{};
    const text=payload.text||'';
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
      else{
        const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
      }
      status('Export JSON copied. Paste into a file inside the Field MAP folder.');
    }catch(e){alert('Copy failed. Use Show text, select all, then copy.');}
  };
  window.toggleSafeExportText=function toggleSafeExportText(){
    const ta=document.getElementById('safeExportTextarea');
    if(!ta)return;
    const payload=window.__fieldMapPendingExport||{};
    const show=ta.style.display==='none'||!ta.style.display;
    if(show){ta.value=payload.text||'';ta.style.display='block';setTimeout(()=>{try{ta.focus();ta.select();}catch(e){}},60);}else{ta.style.display='none';ta.value='';}
  };
  window.closeSafeExportSheet=function closeSafeExportSheet(){
    document.getElementById('safeExportSheet')?.classList.remove('show');
    const ta=document.getElementById('safeExportTextarea');if(ta){ta.value='';ta.style.display='none';}
  };

  if(typeof chooseSaveFolder==='function'){
    window.chooseSaveFolder=async function chooseSaveFolder(){
      if(!window.showDirectoryPicker){alert('Folder saving is not supported in this browser/WebView. Use installed Chrome/PWA mode if available, otherwise copy the export JSON into your Field MAP folder manually.');return;}
      try{
        const root=await window.showDirectoryPicker({id:'field-map-save-folder',mode:'readwrite'});
        if(!(await verifyExportPermission(root,true))){alert('Folder permission was not granted.');return;}
        let folder=root;
        try{folder=await root.getDirectoryHandle(EXPORT_SUBFOLDER,{create:true});}catch(e){}
        await saveExportHandle(folder);
        exportDirectoryHandle=folder;
        exportFolderReady=true;
        status('Save folder set: '+EXPORT_SUBFOLDER);
        await writeTextToChosenFolder('field-map-test-save.txt','Field MAP folder save OK\n'+new Date().toISOString(),'text/plain').catch(()=>null);
        renderSettingsStats?.();
      }catch(e){if(e&&e.name==='AbortError')return;alert('Could not choose folder: '+(e.message||e));}
    };
    window.testSaveFile=async function testSaveFile(){
      try{
        const ok=await writeTextToChosenFolder('field-map-test-save.txt','Field MAP test save OK\n'+new Date().toISOString(),'text/plain');
        if(!ok){alert('Choose the Field MAP folder first.');return;}
        status('Test file saved to Field MAP folder.');
      }catch(e){alert('Test save failed: '+(e.message||e));}
    };
    window.exportFolderStatusText=function exportFolderStatusText(){
      if(!window.showDirectoryPicker)return 'Folder save not supported here';
      return exportDirectoryHandle?(exportFolderReady?'Field MAP folder ready':'Field MAP permission needed'):'No Field MAP folder chosen';
    };
  }

  const oldWritePatch=window.writeAssetEditorPatchFile;
  window.writeAssetEditorPatchFile=async function writeAssetEditorPatchFile(reason){
    try{
      if(typeof buildAssetEditorPatchPayload==='function'){
        const payload=buildAssetEditorPatchPayload(reason||'Asset editor change');
        const ok=await writeTextToChosenFolder('field-map-edits.json',JSON.stringify(payload,null,2),'application/json');
        if(ok)return true;
      }
    }catch(e){}
    return oldWritePatch?oldWritePatch(reason):false;
  };

  const oldExportBackup=window.exportBackup;
  window.exportBackup=function exportBackup(){
    try{
      const data={exportedAt:new Date().toISOString(),recordCount:allRecords.length,records:allRecords,pois,heliMarks,breadcrumbs:readJSON(BREADCRUMB_KEY,[]),estimateCorrections:(typeof routeEstimateCorrections==='function'?routeEstimateCorrections():{})};
      safeExportJSON('field-map-backup.json',data,{title:'Field MAP backup'});
      status('Saving backup to Field MAP folder.');
    }catch(e){oldExportBackup?oldExportBackup():alert('Export failed: '+(e.message||e));}
  };

  const oldExportEverything=window.exportEverythingBackup;
  window.exportEverythingBackup=function exportEverythingBackup(){
    try{
      const data={
        exportType:'field-map-everything-backup',version:'3.8.8',exportedAt:new Date().toISOString(),
        diagnostics:(typeof collectProductionDiagnostics==='function'?collectProductionDiagnostics():{}),records:(allRecords||[]),
        corrections:(typeof routeEstimateCorrections==='function'?routeEstimateCorrections():{}),pois:(typeof pois!=='undefined'?pois:[]),patrolMarks:(typeof heliMarks!=='undefined'?heliMarks:[]),breadcrumbs:readJSON(BREADCRUMB_KEY,[]),
        displaySettings:(typeof displaySettings!=='undefined'?displaySettings:{}),mapToggleSettings:(typeof mapToggleSettings!=='undefined'?mapToggleSettings:{}),
        importAudit:(typeof lastImportAudit!=='undefined'?lastImportAudit:[])
      };
      safeExportJSON('field-map-everything-backup.json',data,{title:'Export Everything'});
      status('Saving Export Everything to Field MAP folder.');
    }catch(e){oldExportEverything?oldExportEverything():alert('Export Everything failed: '+(e.message||e));}
  };

  // Remove retired map layers from any already-created baseLayers object.
  function removeRetiredLayers(){
    try{
      ['light','dark'].forEach(id=>{
        const cfg=baseLayers&&baseLayers[id];
        if(cfg&&cfg.layer&&map&&map.hasLayer(cfg.layer)){map.removeLayer(cfg.layer);}
        if(baseLayers)delete baseLayers[id];
      });
      if(currentBaseLayerId==='light'||currentBaseLayerId==='dark')setBaseMapLayer?.('street');
    }catch(e){}
  }
  const oldOpenMapLayerSheet=window.openMapLayerSheet;
  window.openMapLayerSheet=function openMapLayerSheet(){removeRetiredLayers();return oldOpenMapLayerSheet?oldOpenMapLayerSheet():null;};

  // Clean, text-light Filter page.
  window.renderFilter=function renderFilter(){
    head('Filter','');
    body().innerHTML=`
      <div class="filter-back-row"><button class="secondary" onclick="openMapMenu()">← Map</button></div>
      <div class="card filter-section-card clean-filter-card">
        <div class="filter-grid-actions">
          <button class="secondary" onclick="toggleAllMapLayers(true)">All On</button>
          <button class="secondary" onclick="toggleAllMapLayers(false)">All Off</button>
          <button class="secondary" onclick="toggleAssetLayersOnly()">Assets</button>
          <button class="secondary" onclick="toggleOverlayLayersOnly()">Overlays</button>
        </div>
        <div class="compact-filter map-toggle-list">
          <label class="check-item"><input type="checkbox" data-map-toggle="poles" ${mapToggleSettings.poles?'checked':''}> Points</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="towers" ${mapToggleSettings.towers?'checked':''}> Structures</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="substations" ${mapToggleSettings.substations?'checked':''}> Sites</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="depots" ${mapToggleSettings.depots?'checked':''}> Bases</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="dots" ${mapToggleSettings.dots?'checked':''}> Dots</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="lines" ${mapToggleSettings.lines?'checked':''}> Routes</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="trueGps" ${mapToggleSettings.trueGps!==false?'checked':''}> GPS</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="noGpsEstimates" ${mapToggleSettings.noGpsEstimates!==false?'checked':''}> No-GPS estimates</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="gapEstimates" ${mapToggleSettings.gapEstimates!==false?'checked':''}> Missing estimates</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="selected" ${mapToggleSettings.selected?'checked':''}> Selected</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="crossings" ${mapToggleSettings.crossings?'checked':''}> Crossings</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="radius" ${mapToggleSettings.radius?'checked':''}> 3 km</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="breadcrumb" ${mapToggleSettings.breadcrumb?'checked':''}> Breadcrumb</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="tools" ${mapToggleSettings.tools!==false?'checked':''}> Tools</label>
          <label class="check-item"><input type="checkbox" data-map-toggle="location" ${mapToggleSettings.location!==false?'checked':''}> GPS marker</label>
        </div>
      </div>`;
    bindInstantFilterToggles?.();
  };

  // Stable Map Controls layout: no overlapping, action IDs match labels.
  window.renderMapMenu=function renderMapMenu(){
    const controls=(typeof getToolLayoutControls==='function'?getToolLayoutControls():['viewArea','clear','filter','corrections','crossings','displayAll']);
    const button=(a)=>`<button class="premium-action-card ${a.style}" data-action-id="${a.id}" ${['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?`data-tool="${a.id}"`:''} onclick="runToolAction('${a.id}',event)"><i>${a.icon}</i><b>${a.label}</b><span${a.id==='crossings'?' id="lineCrossingsSub"':''}>${a.sub}</span></button>`;
    const actions=(typeof TOOL_ACTIONS!=='undefined'?TOOL_ACTIONS:[]);
    const html=controls.map(id=>actions.find(x=>x.id===id)).filter(Boolean).map(button).join('');
    head('Map','Controls');
    body().innerHTML=`<div class="premium-map-menu compact-map-controls custom-map-controls field-map-fixed-controls"><div class="compact-control-grid custom-control-grid">${html}</div><button class="layout-link-btn" onclick="openSettingsSectionFromMapTools()">Button layout</button></div>`;
    refreshCustomToolActiveStates?.();
  };
  const oldRunToolAction=window.runToolAction;
  window.runToolAction=function runToolAction(id,ev){
    if(ev&&ev.preventDefault)ev.preventDefault();
    if(id==='viewArea')return viewCurrentMapArea();
    if(id==='clear')return clearSelected();
    if(id==='filter')return openFilter();
    if(id==='corrections')return openDataCorrections();
    if(id==='crossings'){toggleLineCrossings();refreshMapControlState?.();return;}
    if(id==='displayAll')return openDisplayAllMenu();
    if(id==='measure')return toggleMeasureTool();
    if(id==='multi')return toggleMultiMeasureTool();
    if(id==='radius')return toggleRadiusLines();
    if(id==='poi')return openPOIAtGPS();
    if(id==='breadcrumb')return toggleBreadcrumbs();
    if(id==='patrol')return togglePatrolOverlayFromMenu(ev||window.event);
    return oldRunToolAction?oldRunToolAction(id,ev):null;
  };

  window.renderToolLayoutSettings=function renderToolLayoutSettings(){
    const box=document.getElementById('toolLayoutSettings');if(!box)return;
    const controls=(typeof getToolLayoutControls==='function'?getToolLayoutControls():[]);
    const actions=(typeof TOOL_ACTIONS!=='undefined'?TOOL_ACTIONS:[]);
    const controlRows=controls.map((id,i)=>actions.find(a=>a.id===id)).filter(Boolean).map((a,i)=>`<div class="tool-layout-row in-controls"><div class="tool-layout-order">${i+1}</div><div class="tool-layout-name"><b>${a.label}</b><span>${a.sub}</span></div><div class="tool-layout-actions"><button onclick="moveToolLayoutButton('${a.id}',-1)" ${i===0?'disabled':''}>Up</button><button onclick="moveToolLayoutButton('${a.id}',1)" ${i===controls.length-1?'disabled':''}>Down</button><button class="secondary" onclick="toggleToolLayoutButton('${a.id}')">To Tools</button></div></div>`).join('');
    const toolRows=actions.filter(a=>!controls.includes(a.id)).map(a=>`<div class="tool-layout-row in-tools"><div class="tool-layout-order">+</div><div class="tool-layout-name"><b>${a.label}</b><span>${a.sub}</span></div><div class="tool-layout-actions"><button class="green" onclick="toggleToolLayoutButton('${a.id}')" ${controls.length>=6?'disabled':''}>To Controls</button></div></div>`).join('');
    box.innerHTML=`<div class="tool-layout-panel clearer-tool-layout"><div class="tool-layout-summary"><b>Map Controls order</b><span>Top list is the exact button order. Use Up/Down. Move extras to Map Tools.</span></div><h4>Shown in Map Controls</h4><div class="tool-layout-list">${controlRows||'<div class="help">No controls selected.</div>'}</div><h4>Left in Map Tools</h4><div class="tool-layout-list">${toolRows||'<div class="help">No extra tools.</div>'}</div><div class="actions"><button class="secondary" onclick="resetToolLayoutControls()">Reset default</button></div></div>`;
  };

  // Estimate corrections page helper and missing auto button.
  function fixCorrectionPage(){
    try{
      renderCorrectionSettings?.();
      const block=document.querySelector('#settingsSectionCorrections .correction-settings-block');
      const actions=block?.querySelector('.correction-actions');
      if(actions&&!actions.querySelector('[data-auto-correction-button]')){
        const btn=document.createElement('button');
        btn.className='green';btn.type='button';btn.dataset.autoCorrectionButton='1';btn.textContent='Auto correction';
        btn.onclick=()=>{closeSettings?.();openEstimateReviewSheet?.();};
        actions.insertBefore(btn,actions.firstChild);
      }
      block?.querySelectorAll('.help').forEach(el=>{el.classList.add('field-map-compact-help');});
    }catch(e){}
  }
  const oldOpenSettingsSection=window.openSettingsSection;
  window.openSettingsSection=function openSettingsSection(section){
    const r=oldOpenSettingsSection?oldOpenSettingsSection(section):undefined;
    if(section==='toolLayout')renderToolLayoutSettings();
    if(section==='corrections')setTimeout(fixCorrectionPage,30);
    return r;
  };

  // Clear must remove crossings and every transient overlay, not just selected assets.
  window.clearMapToolLayers=function clearMapToolLayers(){
    try{assetLayer?.clearLayers();}catch(e){}
    try{crossingLayer?.clearLayers();}catch(e){}
    try{radiusLayer?.clearLayers();}catch(e){}
    try{measureLayer?.clearLayers();}catch(e){}
    try{breadcrumbLayer?.clearLayers();}catch(e){}
    try{routeClearReviewLines?.();}catch(e){}
    try{routeEstimateMarkerByKey?.clear();routeEstimateHitTargetByKey?.clear();}catch(e){}
    try{crossingsEnabled=false;radiusOn=false;measureOn=false;multiMeasureOn=false;}catch(e){}
    refreshToolActiveStates?.();refreshMapControlState?.();
  };
  window.clearSelected=function clearSelected(){
    selected=null;selectedMarker=null;
    clearMapToolLayers();
    status('Map cleared');
  };

  // 3 km radius: use circle markers with bound popups, no selection redraw/flicker.
  window.toggleRadiusLines=function toggleRadiusLines(){
    radiusOn=!radiusOn;
    try{radiusLayer?.clearLayers();}catch(e){}
    refreshToolActiveStates?.();
    if(!radiusOn){status('3 km off');return;}
    const c=selected&&hasGPS(selected)?{lat:getLat(selected),lng:getLng(selected)}:(locMarker&&locMarker._gps?{lat:locMarker._gps[0],lng:locMarker._gps[1]}:null);
    if(!c){radiusOn=false;refreshToolActiveStates?.();alert('Select an asset or press GPS first.');return;}
    const hits=(allRecords||[]).filter(r=>hasGPS(r)&&distanceMeters(c.lat,c.lng,getLat(r),getLng(r))<=3000);
    registerMapToggleLayer(L.circle([c.lat,c.lng],{radius:3000,color:'#3a8fca',weight:2,fillOpacity:.06,interactive:false}).addTo(radiusLayer),null,'radius');
    hits.forEach(r=>{
      const idx=(typeof recordIndexOf==='function'?recordIndexOf(r):(allRecords||[]).indexOf(r));
      const m=registerMapToggleLayer(L.circleMarker([getLat(r),getLng(r)],{radius:7,weight:2,fillOpacity:.88,className:'radius-marker-point'}).addTo(radiusLayer),r,'radius');
      try{m.bindTooltip(`${getLine(r)||''} | ${getStructure(r)||''}`);}catch(e){}
      if(Number.isInteger(idx)&&idx>=0){
        try{m.bindPopup(assetPopupHTML(idx),{className:'asset-mini-popup',closeButton:true,autoPan:true,keepInView:true});}catch(e){}
        m.on('click',ev=>{try{if(ev&&ev.originalEvent)L.DomEvent.stop(ev.originalEvent);}catch(e){} selected=allRecords[idx];selectedMarker=m;try{m.openPopup();}catch(e){}});
      }
    });
    applyMapToggleSettings?.();
    status(`3 km: ${hits.length.toLocaleString()} clickable assets`);
  };

  // Continuous GPS tracking with wake lock while active.
  async function requestWake(){
    try{if('wakeLock' in navigator){gpsWakeLock=await navigator.wakeLock.request('screen');gpsWakeLock.addEventListener?.('release',()=>{gpsWakeLock=null;});}}catch(e){gpsWakeLock=null;}
  }
  function releaseWake(){try{gpsWakeLock?.release?.();}catch(e){} gpsWakeLock=null;}
  function setGpsButtonState(on){document.body.classList.toggle('gps-tracking-active',!!on);document.querySelector('.side-tools button[aria-label="My GPS"]')?.classList.toggle('gps-active',!!on);}
  function handleGPSPosition(p,pan=true){
    const lat=p.coords.latitude,lng=p.coords.longitude,ll=[lat,lng];
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    if(locMarker)locMarker.setLatLng(ll);else locMarker=registerMapToggleLayer(L.marker(ll,{icon:L.divIcon({className:'loc-marker'})}).addTo(map),null,'location');
    locMarker._gps=ll;locMarker._accuracy=p.coords.accuracy||null;locMarker._lastFix=Date.now();
    if(pan&&map)map.setView(ll,Math.max(17,map.getZoom?.()||17),{animate:false});
    applyMapToggleSettings?.();
  }
  window.stopGpsTracking=function stopGpsTracking(){
    if(gpsTrackWatchId!==null&&navigator.geolocation){try{navigator.geolocation.clearWatch(gpsTrackWatchId);}catch(e){}}
    gpsTrackWatchId=null;gpsTrackActive=false;setGpsButtonState(false);releaseWake();status('GPS tracking off');
  };
  window.startGpsTracking=function startGpsTracking(){
    if(!navigator.geolocation){alert('GPS unavailable.');return;}
    if(gpsTrackWatchId!==null)stopGpsTracking();
    gpsTrackActive=true;setGpsButtonState(true);requestWake();status('GPS tracking on');
    gpsTrackWatchId=navigator.geolocation.watchPosition(p=>handleGPSPosition(p,true),e=>{status('GPS tracking failed: '+(e.message||e));}, {enableHighAccuracy:true,maximumAge:1000,timeout:20000});
  };
  window.locateMe=function locateMe(){if(gpsTrackActive)stopGpsTracking();else startGpsTracking();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&gpsTrackActive)requestWake();});

  // Breadcrumbs: persist, redraw, and keep route line saved locally.
  function saveBreadcrumbs(){writeJSON(BREADCRUMB_KEY,currentBreadcrumbs().slice(-5000));}
  function redrawBreadcrumbs(){
    try{
      if(!breadcrumbLayer)return;
      breadcrumbLayer.clearLayers();
      const pts=currentBreadcrumbs().filter(p=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])));
      pts.forEach(p=>registerMapToggleLayer(L.circleMarker(p,{radius:4,weight:1,fillOpacity:.9,className:'breadcrumb-dot'}).addTo(breadcrumbLayer),null,'breadcrumb'));
      if(pts.length>1)registerMapToggleLayer(L.polyline(pts,{color:'#e9ad35',weight:4,opacity:.9}).addTo(breadcrumbLayer),null,'breadcrumb');
      applyMapToggleSettings?.();
    }catch(e){}
  }
  window.startBreadcrumbs=function startBreadcrumbs(){
    if(!navigator.geolocation){breadcrumbOn=false;return alert('GPS unavailable.');}
    const saved=readJSON(BREADCRUMB_KEY,[]);
    setBreadcrumbs(saved);
    redrawBreadcrumbs();
    breadcrumbOn=true;refreshToolActiveStates?.();status('Breadcrumb trail on and saving.');
    if(breadcrumbWatchId!==null){try{navigator.geolocation.clearWatch(breadcrumbWatchId);}catch(e){}}
    breadcrumbWatchId=navigator.geolocation.watchPosition(p=>{
      const point=[p.coords.latitude,p.coords.longitude];
      if(!Number.isFinite(point[0])||!Number.isFinite(point[1]))return;
      const pts=currentBreadcrumbs();
      if(pts.length){const last=pts[pts.length-1];if(distanceMeters(last[0],last[1],point[0],point[1])<8)return;}
      pts.push(point);setBreadcrumbs(pts.slice(-5000));saveBreadcrumbs();redrawBreadcrumbs();
    },e=>{breadcrumbOn=false;refreshToolActiveStates?.();status('Breadcrumb GPS failed: '+(e.message||e));},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
  };
  window.stopBreadcrumbs=function stopBreadcrumbs(){
    if(breadcrumbWatchId!==null){try{navigator.geolocation.clearWatch(breadcrumbWatchId);}catch(e){} breadcrumbWatchId=null;}
    breadcrumbOn=false;refreshToolActiveStates?.();saveBreadcrumbs();status('Breadcrumb trail off. Saved locally.');
  };
  window.toggleBreadcrumbs=function toggleBreadcrumbs(){breadcrumbOn?stopBreadcrumbs():startBreadcrumbs();};
  window.clearSavedBreadcrumbs=function clearSavedBreadcrumbs(){setBreadcrumbs([]);writeJSON(BREADCRUMB_KEY,[]);try{breadcrumbLayer?.clearLayers();}catch(e){}status('Saved breadcrumbs cleared.');};

  // More permissive missing-number estimates without endless runaway.
  window.routeGapEstimateLooksSafe=function routeGapEstimateLooksSafe(a,b,gap,stats){
    if(!a||!b||!Number.isFinite(gap)||gap<=1)return false;
    const d=routeEstimateDistance(a,b);
    if(!Number.isFinite(d)||d<5)return false;
    const step=d/gap;
    if(gap>400)return false;
    if(d>60000)return false;
    if(step<5||step>2500)return false;
    return true;
  };

  // PIN lock: force lock on fresh load, auto-unlock after entry, block app clicks while locked.
  function wirePinLockFix(){
    try{
      if(authEnabled()){
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        setTimeout(()=>{try{PinLock?.showLock?.('Enter PIN to unlock '+APP_NAME+'.');}catch(e){}},120);
      }
      document.addEventListener('input',e=>{
        if(e.target&&e.target.id==='authPinInput'){
          clearTimeout(e.target._fieldMapUnlockTimer);
          const v=String(e.target.value||'').trim();
          if(/^\d{4,8}$/.test(v))e.target._fieldMapUnlockTimer=setTimeout(()=>{try{PinLock?.unlockWithPin?.();}catch(err){}},430);
        }
      },true);
      ['click','touchstart','pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,e=>{
        if(!isLocked())return;
        const overlay=document.getElementById('authLockOverlay');
        if(overlay&&overlay.contains(e.target))return;
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
      },true));
      const mo=new MutationObserver(()=>document.body.classList.toggle('auth-locked',isLocked()));
      const ensure=()=>{const o=document.getElementById('authLockOverlay');if(o)mo.observe(o,{attributes:true,attributeFilter:['class']});document.body.classList.toggle('auth-locked',isLocked());};
      setTimeout(ensure,400);setTimeout(ensure,1200);
    }catch(e){}
  }

  // Keep estimated dots visible whenever a route is loaded.
  const oldShowLineOnMap=window.showLineOnMap;
  if(oldShowLineOnMap){
    window.showLineOnMap=function showLineOnMap(records,line){
      mapToggleSettings={...mapToggleSettings,dots:true,trueGps:true,noGpsEstimates:true,gapEstimates:true,poles:true,towers:true,lines:true};
      try{persistDisplayAndMapSettings?.();}catch(e){}
      return oldShowLineOnMap(records,line);
    };
  }

  function boot(){
    applyName();removeRetiredLayers();wirePinLockFix();setGpsButtonState(false);
    const saved=readJSON(BREADCRUMB_KEY,[]); if(saved.length){setBreadcrumbs(saved);setTimeout(redrawBreadcrumbs,1000);}
    setTimeout(()=>{fixCorrectionPage();renderToolLayoutSettings?.();applyName();},500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();


/* ---- js/features/field-map-fixes-v395.js ---- */
/* Field MAP v3.9.5 controls-only fix
   Based on v3.8.8 UI colours. No global UI reskin.
   - removes old target GPS button
   - uses arrow button as GPS follow
   - keeps map layers second
   - adds fullscreen third
   - hidden UI cannot receive clicks in fullscreen */
(function(){
  'use strict';

  let gpsWatchId=null;
  let gpsWakeLock=null;
  let gpsFollowActive=false;
  let programmaticMove=false;
  let programmaticTimer=null;
  let restoreTimer=null;

  function qs(sel){return document.querySelector(sel);}
  function status(msg){try{showToolStatus?.(msg);}catch(e){}}

  const GPS_ARROW_SVG = '<svg fill="none" viewBox="0 0 24 24" aria-hidden="true"><path d="m20 4-7.5 16-2-7-6.5-2 16-7Z" fill="currentColor"></path></svg>';
  const LAYERS_SVG = '<svg fill="none" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z" stroke="currentColor" stroke-linejoin="round" stroke-width="2.2"></path><path d="m3 13 9 5 9-5M3 17l9 5 9-5" stroke="currentColor" stroke-linejoin="round" stroke-width="2.2"></path></svg>';
  const FULL_SVG = '<svg class="icon-enter-fullscreen" fill="none" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"></path></svg><svg class="icon-exit-fullscreen" fill="none" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"></path></svg>';
  const RESTORE_SVG = '<svg fill="none" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"></path></svg>';

  function makeButton(id, cls, label, onclickName, html){
    let btn=document.getElementById(id);
    if(!btn){btn=document.createElement('button');btn.id=id;}
    btn.className='field-map-control-btn '+cls;
    btn.type='button';
    btn.setAttribute('aria-label',label);
    btn.setAttribute('onclick',onclickName+'()');
    btn.innerHTML=html;
    return btn;
  }

  function normalizeSideButtons(){
    let wrap=qs('.side-tools');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='side-tools field-map-control-stack';
      document.body.appendChild(wrap);
    }
    wrap.classList.add('field-map-control-stack');
    wrap.setAttribute('aria-label','Map controls');

    const gps=makeButton('gpsTrackBtn','gps-follow-btn','GPS follow','locateMe',GPS_ARROW_SVG);
    const layers=makeButton('mapLayersBtn','map-layers-btn','Map layers','openMapLayerSheet',LAYERS_SVG);
    const full=makeButton('fieldFullscreenBtn','fullscreen-map-btn','Full screen map','toggleFieldMapFullscreen',FULL_SVG);

    wrap.replaceChildren(gps,layers,full);
    setGpsVisual(gpsFollowActive);
  }

  async function requestWakeLock(){
    try{
      if('wakeLock' in navigator){
        gpsWakeLock=await navigator.wakeLock.request('screen');
        gpsWakeLock.addEventListener?.('release',()=>{gpsWakeLock=null;});
      }
    }catch(e){gpsWakeLock=null;}
  }
  function releaseWakeLock(){try{gpsWakeLock?.release?.();}catch(e){} gpsWakeLock=null;}

  function setGpsVisual(on){
    gpsFollowActive=!!on;
    document.body.classList.toggle('gps-tracking-active',gpsFollowActive);
    const btn=qs('#gpsTrackBtn');
    if(btn){
      btn.classList.toggle('gps-active',gpsFollowActive);
      btn.setAttribute('aria-pressed',gpsFollowActive?'true':'false');
    }
  }

  function markProgrammaticMove(){
    programmaticMove=true;
    clearTimeout(programmaticTimer);
    programmaticTimer=setTimeout(()=>{programmaticMove=false;},900);
  }

  function updateGpsMarker(position,follow){
    const c=position&&position.coords;
    if(!c)return;
    const lat=Number(c.latitude), lng=Number(c.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const ll=[lat,lng];
    try{
      if(locMarker)locMarker.setLatLng(ll);
      else locMarker=registerMapToggleLayer(L.marker(ll,{icon:L.divIcon({className:'loc-marker'})}).addTo(map),null,'location');
      locMarker._gps=ll;
      locMarker._accuracy=c.accuracy||null;
      locMarker._lastFix=Date.now();
      if(follow&&map){
        markProgrammaticMove();
        const zoom=Math.max(17,Number(map.getZoom?.()||17));
        map.setView(ll,zoom,{animate:false});
      }
      applyMapToggleSettings?.();
    }catch(e){}
  }

  window.stopGpsTracking=function stopGpsTracking(reason){
    if(gpsWatchId!==null&&navigator.geolocation){
      try{navigator.geolocation.clearWatch(gpsWatchId);}catch(e){}
    }
    gpsWatchId=null;
    setGpsVisual(false);
    releaseWakeLock();
    if(reason==='manual')status('GPS follow unlocked');
    else if(reason!=='silent')status('GPS tracking off');
  };

  window.startGpsTracking=function startGpsTracking(){
    if(!navigator.geolocation){alert('GPS unavailable.');return;}
    if(gpsWatchId!==null)window.stopGpsTracking('silent');
    setGpsVisual(true);
    requestWakeLock();
    status('GPS locked on');
    gpsWatchId=navigator.geolocation.watchPosition(
      p=>updateGpsMarker(p,true),
      e=>{status('GPS failed: '+(e&&e.message?e.message:e));window.stopGpsTracking('silent');},
      {enableHighAccuracy:true,maximumAge:1000,timeout:20000}
    );
  };

  window.locateMe=function locateMe(){
    if(gpsFollowActive)window.stopGpsTracking();
    else window.startGpsTracking();
  };

  function wireMapMoveUnlock(){
    if(!window.map||map.__fieldMapGpsMoveUnlockV395)return;
    map.__fieldMapGpsMoveUnlockV395=true;
    const unlock=function(){
      if(!gpsFollowActive)return;
      if(programmaticMove)return;
      window.stopGpsTracking('manual');
    };
    map.on('dragstart',unlock);
    map.on('zoomstart',unlock);
    map.on('movestart',()=>{ if(gpsFollowActive&&!programmaticMove) window.stopGpsTracking('manual'); });
    map.on('moveend',()=>{programmaticMove=false;});
  }

  function ensureRestoreButton(){
    let btn=document.getElementById('fieldMapRestoreBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='fieldMapRestoreBtn';
      document.body.appendChild(btn);
    }
    btn.className='field-map-restore-btn';
    btn.type='button';
    btn.setAttribute('aria-label','Restore normal screen');
    btn.innerHTML=RESTORE_SVG;
    btn.onclick=function(ev){
      try{ev.preventDefault();ev.stopPropagation();}catch(e){}
      window.exitFieldMapFullscreen();
    };
    return btn;
  }

  function showRestoreButton(ms){
    if(!document.body.classList.contains('field-map-fullscreen-active'))return;
    const btn=ensureRestoreButton();
    btn.classList.add('show');
    clearTimeout(restoreTimer);
    restoreTimer=setTimeout(()=>btn.classList.remove('show'),ms||4200);
  }

  window.enterFieldMapFullscreen=async function enterFieldMapFullscreen(){
    document.body.classList.add('field-map-fullscreen-active');
    const btn=qs('#fieldFullscreenBtn');
    btn?.classList.add('fullscreen-active');
    btn?.setAttribute('aria-pressed','true');
    ensureRestoreButton();
    status('Full screen map');
    try{ if(document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen(); }catch(e){}
    try{ map?.invalidateSize?.({pan:false}); }catch(e){}
    setTimeout(()=>{try{map?.invalidateSize?.({pan:false});}catch(e){}},250);
    showRestoreButton(2500);
  };

  window.exitFieldMapFullscreen=async function exitFieldMapFullscreen(){
    document.body.classList.remove('field-map-fullscreen-active');
    const btn=qs('#fieldFullscreenBtn');
    btn?.classList.remove('fullscreen-active');
    btn?.setAttribute('aria-pressed','false');
    qs('#fieldMapRestoreBtn')?.classList.remove('show');
    clearTimeout(restoreTimer);
    try{ if(document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); }catch(e){}
    try{ map?.invalidateSize?.({pan:false}); }catch(e){}
    setTimeout(()=>{try{map?.invalidateSize?.({pan:false});}catch(e){}},250);
    status('Normal screen');
  };

  window.toggleFieldMapFullscreen=function toggleFieldMapFullscreen(){
    if(document.body.classList.contains('field-map-fullscreen-active'))window.exitFieldMapFullscreen();
    else window.enterFieldMapFullscreen();
  };

  function wireFullscreenReveal(){
    const mapEl=document.getElementById('map');
    if(mapEl&&!mapEl.__fieldMapFullscreenRevealV395){
      mapEl.__fieldMapFullscreenRevealV395=true;
      ['click','touchend','pointerup'].forEach(ev=>mapEl.addEventListener(ev,()=>showRestoreButton(4200),{passive:true}));
    }
    if(!document.__fieldMapFullscreenChangeV395){
      document.__fieldMapFullscreenChangeV395=true;
      document.addEventListener('fullscreenchange',()=>{
        if(!document.fullscreenElement&&document.body.classList.contains('field-map-fullscreen-active')){
          document.body.classList.remove('field-map-fullscreen-active');
          qs('#fieldFullscreenBtn')?.classList.remove('fullscreen-active');
          qs('#fieldMapRestoreBtn')?.classList.remove('show');
        }
      });
      document.addEventListener('visibilitychange',()=>{
        if(!document.hidden&&gpsFollowActive)requestWakeLock();
      });
    }
  }

  function boot(){
    normalizeSideButtons();
    setGpsVisual(false);
    wireMapMoveUnlock();
    wireFullscreenReveal();
    ensureRestoreButton();
    setTimeout(()=>{normalizeSideButtons();wireMapMoveUnlock();wireFullscreenReveal();},500);
    setTimeout(()=>{normalizeSideButtons();wireMapMoveUnlock();},1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();


/* ---- js/features/field-map-fixes-v396.js ---- */
/* Field MAP v3.9.6 targeted fixes
   - Rename Corrections to Data Corrections
   - Add Auto Estimate Correction as its own Map Controls button
   - Make View Area action deterministic
   - Draw direct line crossings as red crossing zones with asset IDs
   - Preserve v3.9.5 original green/dark UI colours */
(function(){
  'use strict';

  const CONTROL_STORAGE_KEY='asset_tracker_v385_tool_layout_controls';
  const CONTROL_DEFAULT=['viewArea','clear','filter','corrections','autoCorrection','crossings','displayAll'];
  const CONTROL_MAX=7;

  function status(msg){try{showToolStatus?.(msg);}catch(e){}}
  function escHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normLine(s){
    try{if(typeof compactSearch==='function')return compactSearch(s);}catch(e){}
    return String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
  }
  function sameLine(a,b){return !!a&&!!b&&normLine(a)===normLine(b);}
  function recordIdx(r){try{return typeof recordIndexOf==='function'?recordIndexOf(r):(allRecords||[]).indexOf(r);}catch(e){return -1;}}
  function fieldValue(r,keys){try{return typeof val==='function'?val(r,keys):'';}catch(e){return '';}}
  function lineName(r){try{return getLine(r)||fieldValue(r,['LINE_NAME','LINE','ROUTE','ROUTE_NAME','CIRCUIT'])||'';}catch(e){return '';}}
  function assetId(r){
    if(!r)return '';
    let s='';
    try{s=getStructure(r)||'';}catch(e){}
    if(!s)s=fieldValue(r,['STRUCTURE','STRUCTURE_NO','STR_NO','POLE_NO','TOWER_NO','NAMEPLATE_ID','NP_DWG_NO','EQUIP_NO','EQUIPMENT_NO','ASSET_ID','ID']);
    if(!s){const idx=recordIdx(r); if(idx>=0)s='Record '+(idx+1);}
    return String(s||'Asset');
  }
  function assetLabel(r){
    const l=lineName(r);
    const a=assetId(r);
    return [l,a].filter(Boolean).join(' ');
  }
  function hasCoord(r){try{return !!(r&&hasGPS(r));}catch(e){return false;}}
  function latOf(r){try{return Number(getLat(r));}catch(e){return NaN;}}
  function lngOf(r){try{return Number(getLng(r));}catch(e){return NaN;}}
  function distM(a,b,c,d){try{return distanceMeters(a,b,c,d);}catch(e){
    const R=6371000,toRad=x=>x*Math.PI/180,dLat=toRad(c-a),dLon=toRad(d-b);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;
    return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
  }}

  function patchActions(){
    try{
      if(typeof TOOL_ACTIONS!=='undefined'&&Array.isArray(TOOL_ACTIONS)){
        let c=TOOL_ACTIONS.find(a=>a.id==='corrections');
        if(c){c.label='Data Corrections';c.short='Data Corrections';c.sub='Add / edit / delete assets';c.style='primary';c.toolClass='green';c.icon='✎';}
        if(!TOOL_ACTIONS.some(a=>a.id==='autoCorrection')){
          const insertAt=Math.max(0,TOOL_ACTIONS.findIndex(a=>a.id==='corrections')+1);
          TOOL_ACTIONS.splice(insertAt,0,{id:'autoCorrection',label:'Auto Estimate',short:'Auto Estimate',sub:'Asset estimate correction',style:'teal',toolClass:'teal',icon:'⌖'});
        }
      }
      if(typeof TOOL_LAYOUT_DEFAULT!=='undefined'&&Array.isArray(TOOL_LAYOUT_DEFAULT)&&!TOOL_LAYOUT_DEFAULT.includes('autoCorrection')){
        const i=TOOL_LAYOUT_DEFAULT.indexOf('corrections');
        TOOL_LAYOUT_DEFAULT.splice(i>=0?i+1:TOOL_LAYOUT_DEFAULT.length,0,'autoCorrection');
      }
    }catch(e){}
  }

  function actions(){
    patchActions();
    const fallback=[
      {id:'viewArea',label:'View Area',short:'View Area',sub:'Assets in window',style:'primary',toolClass:'green',icon:'▣'},
      {id:'clear',label:'Clear',short:'Clear',sub:'Remove markers',style:'amber',toolClass:'sun',icon:'⌫'},
      {id:'filter',label:'Filter',short:'Filter',sub:'Layer toggles',style:'teal',toolClass:'teal',icon:'◉'},
      {id:'corrections',label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete assets',style:'primary',toolClass:'green',icon:'✎'},
      {id:'autoCorrection',label:'Auto Estimate',short:'Auto Estimate',sub:'Asset estimate correction',style:'teal',toolClass:'teal',icon:'⌖'},
      {id:'crossings',label:'Crossings',short:'Crossings',sub:'Red crossing zones',style:'amber',toolClass:'sun',icon:'✕'},
      {id:'displayAll',label:'Display All',short:'Display All',sub:'Asset groups',style:'danger',toolClass:'redbtn',icon:'☷'},
      {id:'measure',label:'Measure',short:'Measure',sub:'Two point measure',style:'brown',toolClass:'brown',icon:'↔'},
      {id:'multi',label:'Multi Measure',short:'Multi',sub:'Measure a path',style:'brown',toolClass:'brown',icon:'⌁'},
      {id:'radius',label:'3 km Radius',short:'3 km',sub:'Nearby assets',style:'primary',toolClass:'green',icon:'◎'},
      {id:'poi',label:'POI',short:'POI',sub:'Save current GPS',style:'amber',toolClass:'sun',icon:'◆'},
      {id:'breadcrumb',label:'Breadcrumb',short:'Breadcrumb',sub:'GPS trail',style:'teal',toolClass:'teal',icon:'⋯'},
      {id:'patrol',label:'Patrol',short:'Patrol',sub:'GPS overlay',style:'primary',toolClass:'purple',icon:'⌖'}
    ];
    try{return (typeof TOOL_ACTIONS!=='undefined'&&Array.isArray(TOOL_ACTIONS))?TOOL_ACTIONS:fallback;}catch(e){return fallback;}
  }
  function actionById(id){return actions().find(a=>a.id===id);}
  function cleanControls(arr){
    const ids=new Set(actions().map(a=>a.id));
    const out=[];
    (Array.isArray(arr)?arr:[]).forEach(id=>{if(ids.has(id)&&!out.includes(id)&&out.length<CONTROL_MAX)out.push(id);});
    CONTROL_DEFAULT.forEach(id=>{if(ids.has(id)&&!out.includes(id)&&out.length<CONTROL_MAX)out.push(id);});
    if(!out.includes('autoCorrection')){
      const i=out.indexOf('corrections');
      out.splice(i>=0?i+1:Math.min(out.length,4),0,'autoCorrection');
      while(out.length>CONTROL_MAX)out.pop();
    }
    return out.slice(0,CONTROL_MAX);
  }
  window.getToolLayoutControls=function getToolLayoutControls(){
    try{return cleanControls(JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null'));}
    catch(e){return CONTROL_DEFAULT.slice();}
  };
  window.saveToolLayoutControls=function saveToolLayoutControls(ids){
    const clean=cleanControls(ids);
    try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(clean));}catch(e){}
    try{renderToolLayoutSettings?.();}catch(e){}
    try{if(document.getElementById('drawer')?.classList.contains('open') && document.getElementById('dTitle')?.textContent==='Map') renderMapMenu();}catch(e){}
    try{renderCustomPlusGrid?.();}catch(e){}
    try{refreshCustomToolActiveStates?.();}catch(e){}
  };
  window.resetToolLayoutControls=function resetToolLayoutControls(){window.saveToolLayoutControls(CONTROL_DEFAULT.slice());status('Button layout reset');};
  window.toggleToolLayoutButton=function toggleToolLayoutButton(id){
    const cur=window.getToolLayoutControls();
    if(cur.includes(id)){window.saveToolLayoutControls(cur.filter(x=>x!==id));return;}
    if(cur.length>=CONTROL_MAX){alert('Map Controls can hold '+CONTROL_MAX+' buttons. Move one back to Map Tools first.');return;}
    window.saveToolLayoutControls([...cur,id]);
  };
  window.moveToolLayoutButton=function moveToolLayoutButton(id,dir){
    const cur=window.getToolLayoutControls();
    const i=cur.indexOf(id),j=i+dir;
    if(i<0||j<0||j>=cur.length)return;
    [cur[i],cur[j]]=[cur[j],cur[i]];
    window.saveToolLayoutControls(cur);
  };

  window.openAutoEstimateCorrection=function openAutoEstimateCorrection(){
    try{closeDrawer?.();closePlus?.();closeSettings?.();}catch(e){}
    if(typeof openEstimateReviewSheet==='function')openEstimateReviewSheet();
    else alert('Auto estimate correction is not ready yet. Load a route first, then try again.');
  };

  function buttonHTML(a){
    const subId=a.id==='crossings'?' id="lineCrossingsSub"':'';
    const activeIds=['measure','multi','radius','breadcrumb','crossings','patrol'];
    const dataTool=activeIds.includes(a.id)?` data-tool="${a.id}"`:'';
    return `<button type="button" class="premium-action-card ${a.style}" data-action-id="${a.id}"${dataTool} onclick="return runToolAction('${a.id}',event)"><i>${a.icon}</i><b>${escHTML(a.label)}</b><span${subId}>${escHTML(a.sub)}</span></button>`;
  }

  window.renderMapMenu=function renderMapMenu(){
    patchActions();
    const controls=window.getToolLayoutControls();
    const html=controls.map(id=>actionById(id)).filter(Boolean).map(buttonHTML).join('');
    head('Map','Controls');
    body().innerHTML=`<div class="premium-map-menu compact-map-controls custom-map-controls field-map-fixed-controls field-map-v396-controls"><div class="compact-control-grid custom-control-grid">${html}</div><button type="button" class="layout-link-btn" onclick="openSettingsSectionFromMapTools()">Button layout</button></div>`;
    try{refreshCustomToolActiveStates?.();}catch(e){}
    try{refreshMapControlState?.();}catch(e){}
  };

  window.runToolAction=function runToolAction(id,ev){
    try{ev?.preventDefault?.();ev?.stopPropagation?.();}catch(e){}
    try{
      if(id==='viewArea')return viewCurrentMapArea();
      if(id==='clear')return clearSelected();
      if(id==='filter')return openFilter();
      if(id==='corrections')return openDataCorrections();
      if(id==='autoCorrection')return window.openAutoEstimateCorrection();
      if(id==='crossings'){toggleLineCrossings();refreshMapControlState?.();return;}
      if(id==='displayAll')return openDisplayAllMenu();
      if(id==='measure')return toggleMeasureTool();
      if(id==='multi')return toggleMultiMeasureTool();
      if(id==='radius')return toggleRadiusLines();
      if(id==='poi')return openPOIAtGPS();
      if(id==='breadcrumb')return toggleBreadcrumbs();
      if(id==='patrol')return togglePatrolOverlayFromMenu(ev||window.event);
    }catch(e){alert('Tool failed: '+(e.message||e));}
    return false;
  };

  window.renderCustomPlusGrid=function renderCustomPlusGrid(){
    const grid=document.querySelector('#plusSheet .plus-grid');
    if(!grid)return;
    const controls=window.getToolLayoutControls();
    const tools=actions().filter(a=>!controls.includes(a.id));
    grid.innerHTML=tools.map(a=>{
      const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${a.id}"`:'';
      return `<button type="button" class="${a.toolClass||'green'} tool-btn"${dataTool} onclick="runToolAction('${a.id}',event);closePlus()"><span class="tool-emoji">${a.icon}</span>${escHTML(a.short||a.label)}</button>`;
    }).join('') || '<div class="tool-layout-empty">All quick buttons are in Map Controls.</div>';
    const title=document.querySelector('#plusSheet .plus-title');
    if(title)title.textContent='+ Map Tools';
    try{refreshCustomToolActiveStates?.();}catch(e){}
  };

  window.renderToolLayoutSettings=function renderToolLayoutSettings(){
    const box=document.getElementById('toolLayoutSettings');
    if(!box)return;
    const controls=window.getToolLayoutControls();
    const controlRows=controls.map((id,i)=>actionById(id)).filter(Boolean).map((a,i)=>`<div class="tool-layout-row in-controls"><div class="tool-layout-order">${i+1}</div><div class="tool-layout-name"><b>${escHTML(a.label)}</b><span>${escHTML(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" onclick="moveToolLayoutButton('${a.id}',-1)" ${i===0?'disabled':''}>Up</button><button type="button" onclick="moveToolLayoutButton('${a.id}',1)" ${i===controls.length-1?'disabled':''}>Down</button><button type="button" class="secondary" onclick="toggleToolLayoutButton('${a.id}')">To Tools</button></div></div>`).join('');
    const toolRows=actions().filter(a=>!controls.includes(a.id)).map(a=>`<div class="tool-layout-row in-tools"><div class="tool-layout-order">+</div><div class="tool-layout-name"><b>${escHTML(a.label)}</b><span>${escHTML(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" class="green" onclick="toggleToolLayoutButton('${a.id}')" ${controls.length>=CONTROL_MAX?'disabled':''}>To Controls</button></div></div>`).join('');
    box.innerHTML=`<div class="tool-layout-panel clearer-tool-layout"><div class="tool-layout-summary"><b>${controls.length}/${CONTROL_MAX} in Map Controls</b><span>Top list is the exact button order. Use Up/Down. Extras stay in Map Tools.</span></div><h4>Shown in Map Controls</h4><div class="tool-layout-list">${controlRows||'<div class="help">No controls selected.</div>'}</div><h4>Left in Map Tools</h4><div class="tool-layout-list">${toolRows||'<div class="help">No extra tools.</div>'}</div><div class="actions"><button type="button" class="secondary" onclick="resetToolLayoutControls()">Reset default</button></div></div>`;
  };

  function primaryOtherLine(r,current){
    let list=[];
    try{list=(typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):(typeof lineCandidates==='function'?lineCandidates(r):[lineName(r)])).filter(Boolean);}catch(e){list=[lineName(r)].filter(Boolean);}
    return list.find(l=>!sameLine(l,current))||list[0]||lineName(r)||'Unknown line';
  }
  function lineBelongs(r,line){
    try{if(typeof lineBelongsToRoute==='function')return lineBelongsToRoute(r,line);}catch(e){}
    let list=[];
    try{list=(typeof lineCandidates==='function'?lineCandidates(r):[lineName(r)]).filter(Boolean);}catch(e){list=[lineName(r)].filter(Boolean);}
    return list.some(l=>sameLine(l,line));
  }
  function routeRows(line){
    let rows=[];
    try{if(typeof routeHitsFromCache==='function')rows=routeHitsFromCache(line)||[];}catch(e){}
    try{if(typeof routeRecordsOnly==='function')rows=routeRecordsOnly(rows);}catch(e){}
    if(!rows.length){rows=(allRecords||[]).filter(r=>hasCoord(r)&&lineBelongs(r,line));}
    return rows.filter(hasCoord);
  }
  function currentCrossingContext(){
    let current='',base=[];
    try{
      if(selected&&hasCoord(selected)){current=lineName(selected);base=routeRows(current);}
    }catch(e){}
    try{
      if((!current||!base.length)&&typeof routeLastSingleName!=='undefined'&&routeLastSingleName&&Array.isArray(routeLastSingleRows)&&routeLastSingleRows.length){
        current=String(routeLastSingleName||'');
        base=(typeof routeRecordsOnly==='function'?routeRecordsOnly(routeLastSingleRows):routeLastSingleRows).filter(hasCoord);
      }
    }catch(e){}
    try{
      if((!current||!base.length)&&Array.isArray(visibleRecords)&&visibleRecords.length){
        const gps=(typeof routeRecordsOnly==='function'?routeRecordsOnly(visibleRecords):visibleRecords).filter(hasCoord);
        const counts=new Map();
        gps.forEach(r=>{const l=lineName(r);if(l)counts.set(l,(counts.get(l)||0)+1);});
        current=Array.from(counts.entries()).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
        base=gps.filter(r=>sameLine(lineName(r),current));
      }
    }catch(e){}
    return {line:current,base:(base||[]).filter(hasCoord)};
  }
  function plate(r){try{return Number(plateNo(r))||0;}catch(e){return Number(fieldValue(r,['STRUCTURE_NO','POLE_NO','TOWER_NO']))||0;}}
  function buildSegments(rows,line){
    const ordered=(rows||[]).filter(hasCoord).slice().sort((a,b)=>plate(a)-plate(b)||assetId(a).localeCompare(assetId(b)));
    const dedup=[];
    const seen=new Set();
    ordered.forEach(r=>{
      const key=(Math.round(latOf(r)*1e7)+'|'+Math.round(lngOf(r)*1e7)+'|'+assetId(r));
      if(!seen.has(key)){seen.add(key);dedup.push(r);}
    });
    const segs=[];
    for(let i=1;i<dedup.length;i++){
      const a=dedup[i-1],b=dedup[i];
      const len=distM(latOf(a),lngOf(a),latOf(b),lngOf(b));
      if(!Number.isFinite(len)||len<1||len>12000)continue;
      segs.push({line,a,b,lat1:latOf(a),lng1:lngOf(a),lat2:latOf(b),lng2:lngOf(b),len,
        minLat:Math.min(latOf(a),latOf(b)),maxLat:Math.max(latOf(a),latOf(b)),minLng:Math.min(lngOf(a),lngOf(b)),maxLng:Math.max(lngOf(a),lngOf(b))});
    }
    return segs;
  }
  function bboxOverlap(a,b,pad){
    pad=pad||0;
    return a.maxLat+pad>=b.minLat&&a.minLat-pad<=b.maxLat&&a.maxLng+pad>=b.minLng&&a.minLng-pad<=b.maxLng;
  }
  function segmentIntersection(s1,s2){
    const x1=s1.lng1,y1=s1.lat1,x2=s1.lng2,y2=s1.lat2,x3=s2.lng1,y3=s2.lat1,x4=s2.lng2,y4=s2.lat2;
    const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
    if(Math.abs(den)<1e-12)return null;
    const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den;
    const u=((x1-x3)*(y1-y2)-(y1-y3)*(x1-x2))/den;
    if(t<=0.02||t>=0.98||u<=0.02||u>=0.98)return null;
    return {lat:y1+t*(y2-y1),lng:x1+t*(x2-x1),t,u};
  }
  function toXY(lat,lng,refLat){return {x:lng*111320*Math.cos(refLat*Math.PI/180),y:lat*110540};}
  function pointSegmentDistanceMeters(lat,lng,s){
    const ref=(lat+s.lat1+s.lat2)/3;
    const p=toXY(lat,lng,ref),a=toXY(s.lat1,s.lng1,ref),b=toXY(s.lat2,s.lng2,ref);
    const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y;
    const l2=vx*vx+vy*vy;
    if(!l2)return Math.hypot(p.x-a.x,p.y-a.y);
    let t=(wx*vx+wy*vy)/l2;t=Math.max(0,Math.min(1,t));
    return Math.hypot(p.x-(a.x+t*vx),p.y-(a.y+t*vy));
  }
  function nearestAssetOnSegment(s,lat,lng){
    const da=distM(lat,lng,s.lat1,s.lng1),db=distM(lat,lng,s.lat2,s.lng2);
    return da<=db?s.a:s.b;
  }
  function crossingKey(lat,lng,otherLine){return `${Math.round(lat*100000)}|${Math.round(lng*100000)}|${normLine(otherLine)}`;}
  function crossingLabel(hit){
    const other=hit.otherAsset?assetLabel(hit.otherAsset):hit.otherLine;
    const base=hit.baseAsset?assetLabel(hit.baseAsset):hit.currentLine;
    return `${hit.currentLine} × ${hit.otherLine} | ${other||base}`;
  }
  function popupHTML(hit){
    return `<div class="crossing-popup"><b>Line crossing</b><div><strong>${escHTML(hit.currentLine)}</strong> crosses <strong>${escHTML(hit.otherLine)}</strong></div><div>Current asset: ${escHTML(assetLabel(hit.baseAsset)||'nearest span')}</div><div>Crossing asset: ${escHTML(assetLabel(hit.otherAsset)||'nearest span')}</div><small>${hit.direct?'Direct segment crossing':'Nearby crossing candidate'} · ${hit.lat.toFixed(6)}, ${hit.lng.toFixed(6)}</small></div>`;
  }
  function drawCrossingHit(hit,i,total){
    const ll=[hit.lat,hit.lng];
    const label=crossingLabel(hit);
    const zone=registerMapToggleLayer(L.circle(ll,{radius:hit.direct?90:65,color:'#d71920',weight:3,fillColor:'#d71920',fillOpacity:.20,opacity:.95,className:'field-crossing-zone'}).addTo(crossingLayer),hit.otherAsset||hit.baseAsset||null,'crossing');
    zone.bindTooltip(label,{sticky:true,className:'crossing-tooltip'});
    zone.bindPopup(popupHTML(hit),{className:'asset-mini-popup crossing-popup-wrap',closeButton:true,autoPan:true,keepInView:true});
    zone.on('click',()=>{if(hit.otherAsset){const idx=recordIdx(hit.otherAsset);if(idx>=0){selected=hit.otherAsset;selectedMarker=zone;}}});
    const dot=registerMapToggleLayer(L.circleMarker(ll,{radius:8,weight:2.5,color:'#fff8e8',fillColor:'#d71920',fillOpacity:.95,opacity:1,className:'field-crossing-dot'}).addTo(crossingLayer),hit.otherAsset||null,'crossing');
    dot.bindTooltip(label,{sticky:true,className:'crossing-tooltip'});
    dot.bindPopup(popupHTML(hit),{className:'asset-mini-popup crossing-popup-wrap',closeButton:true,autoPan:true,keepInView:true});
    if(total<=80){
      const html=`<b>Crossing</b><span>${escHTML(assetLabel(hit.otherAsset)||hit.otherLine)}</span>`;
      const marker=registerMapToggleLayer(L.marker(ll,{interactive:false,icon:L.divIcon({className:'crossing-id-label',html,iconSize:[1,1],iconAnchor:[0,0]})}).addTo(crossingLayer),null,'crossing');
      try{marker.setZIndexOffset(900+i);}catch(e){}
    }
  }

  window.toggleLineCrossings=function toggleLineCrossings(){
    crossingsEnabled=!crossingsEnabled;
    try{crossingLayer?.clearLayers();}catch(e){}
    try{refreshToolActiveStates?.();refreshMapControlState?.();}catch(e){}
    if(!crossingsEnabled){status('Line crossings off');return;}

    const ctx=currentCrossingContext();
    const current=ctx.line;
    const base=ctx.base||[];
    if(!current||base.length<2){
      crossingsEnabled=false;try{refreshMapControlState?.();}catch(e){}
      alert('Load a route/line or select a GPS asset first, then turn Crossings on.');
      return;
    }
    status(`Checking direct crossings for ${current}...`);
    const baseSegs=buildSegments(base,current);
    if(!baseSegs.length){crossingsEnabled=false;alert('Not enough route span data to check crossings.');return;}
    const bbox={minLat:Math.min(...baseSegs.map(s=>s.minLat))-0.01,maxLat:Math.max(...baseSegs.map(s=>s.maxLat))+0.01,minLng:Math.min(...baseSegs.map(s=>s.minLng))-0.01,maxLng:Math.max(...baseSegs.map(s=>s.maxLng))+0.01};
    const groups=new Map();
    (allRecords||[]).forEach(r=>{
      if(!hasCoord(r)||lineBelongs(r,current))return;
      const lat=latOf(r),lng=lngOf(r);
      if(lat<bbox.minLat||lat>bbox.maxLat||lng<bbox.minLng||lng>bbox.maxLng)return;
      const l=primaryOtherLine(r,current);
      if(!l||sameLine(l,current))return;
      const k=normLine(l)||l;
      if(!groups.has(k))groups.set(k,{line:l,records:[]});
      groups.get(k).records.push(r);
    });
    const hits=[];
    const seen=new Set();
    const addHit=(hit)=>{
      const k=crossingKey(hit.lat,hit.lng,hit.otherLine);
      if(seen.has(k))return;
      seen.add(k);hits.push(hit);
    };
    for(const g of groups.values()){
      const segs=buildSegments(g.records,g.line);
      for(const s2 of segs){
        if(hits.length>=250)break;
        for(const s1 of baseSegs){
          if(!bboxOverlap(s1,s2,0.00035))continue;
          const p=segmentIntersection(s1,s2);
          if(!p)continue;
          const baseAsset=nearestAssetOnSegment(s1,p.lat,p.lng);
          const otherAsset=nearestAssetOnSegment(s2,p.lat,p.lng);
          addHit({lat:p.lat,lng:p.lng,currentLine:current,otherLine:g.line,baseAsset,otherAsset,direct:true});
        }
      }
    }
    // Fallback: mark assets that sit directly on/very close to the selected route span.
    if(!hits.length){
      for(const g of groups.values()){
        for(const r of g.records){
          if(hits.length>=120)break;
          const lat=latOf(r),lng=lngOf(r);
          let best=null,bestD=Infinity;
          for(const s of baseSegs){
            if(lat<s.minLat-0.001||lat>s.maxLat+0.001||lng<s.minLng-0.001||lng>s.maxLng+0.001)continue;
            const d=pointSegmentDistanceMeters(lat,lng,s);
            if(d<bestD){bestD=d;best=s;}
          }
          if(best&&bestD<=70){addHit({lat,lng,currentLine:current,otherLine:g.line,baseAsset:nearestAssetOnSegment(best,lat,lng),otherAsset:r,direct:false});}
        }
      }
    }
    hits.sort((a,b)=>(a.otherLine||'').localeCompare(b.otherLine||'')||assetLabel(a.otherAsset).localeCompare(assetLabel(b.otherAsset)));
    hits.forEach((h,i)=>drawCrossingHit(h,i,hits.length));
    try{applyMapToggleSettings?.();}catch(e){}
    try{refreshMapControlState?.();}catch(e){}
    status(`Crossings ${current}: ${hits.length.toLocaleString()} red crossing zone${hits.length===1?'':'s'} shown`);
    if(!hits.length)alert('No direct line crossings found in the loaded GPS/route data for '+current+'.');
  };

  function patchStaticText(){
    document.querySelectorAll('button.settings-card b').forEach(b=>{
      if(String(b.textContent||'').trim()==='Estimate corrections')b.textContent='Estimate corrections';
      if(String(b.textContent||'').trim()==='Corrections')b.textContent='Data Corrections';
    });
  }

  function boot(){
    patchActions();
    patchStaticText();
    setTimeout(()=>{try{renderCustomPlusGrid?.();}catch(e){}},150);
    setTimeout(()=>{try{if(document.getElementById('drawer')?.classList.contains('open')&&document.getElementById('dTitle')?.textContent==='Map')renderMapMenu();}catch(e){}},400);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();


/* ---- js/features/field-map-fixes-v397.js ---- */
/* Field MAP v3.9.7 estimate/auto-correction fix
   - Auto Estimate button now works on the currently loaded estimate dots
   - Public power vertices are reference-only, not displayed as asset estimates
   - Estimate dots inherit the loaded route/line name where possible
   - Blank/no-line estimates are labelled Unknown but remain clickable
*/
(function(){
  'use strict';

  function safeStatus(msg){try{showToolStatus?.(msg);}catch(e){}}
  function escHTML(s){try{return esc(s);}catch(e){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}}
  function compactLocal(s){try{return compactSearch(s);}catch(e){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}}
  function valLocal(r,keys){try{return typeof val==='function'?val(r,keys):'';}catch(e){return '';}}
  function rawLineFromRecord(r){
    if(!r)return '';
    let out='';
    try{out=getLine(r)||'';}catch(e){}
    if(!out)out=r.__line||valLocal(r,['LINE_NAME','LINE_NAME_1','LINE','ROUTE','ROUTE_NAME','CIRCUIT','CIRCUIT_NAME','FEEDER','FEEDER_NAME']);
    return String(out||'').trim();
  }
  function isBadAutoLine(s){
    const raw=String(s||'').trim();
    if(!raw)return true;
    const k=raw.toLowerCase().replace(/[^a-z0-9]+/g,'');
    return !k || k==='publicpower' || k==='powervertex' || k==='powerwayvertex' || k==='powernode' || k==='powersynthetic' || k==='power' || k==='wayvertex';
  }
  function currentGroupNameForDp(dp){
    try{
      const key=(typeof routeEstimateKey==='function')?routeEstimateKey(dp):'';
      for(const g of (routeLastDisplayGroups||[])){
        if(!g||!Array.isArray(g.dps))continue;
        if(g.dps.some(x=>x===dp || (key&&typeof routeEstimateKey==='function'&&routeEstimateKey(x)===key)))return String(g.name||'');
      }
    }catch(e){}
    try{if(typeof routeLastSingleName!=='undefined'&&routeLastSingleName)return String(routeLastSingleName);}catch(e){}
    try{if(typeof routeLastMultiNames!=='undefined'&&Array.isArray(routeLastMultiNames)&&routeLastMultiNames.length===1)return String(routeLastMultiNames[0]||'');}catch(e){}
    return '';
  }
  function cleanLineName(s){
    s=String(s||'').replace(/_/g,' ').replace(/\s+/g,' ').trim();
    try{s=canonicalRouteName(s)||s;}catch(e){}
    return s;
  }
  function preferredLineForDp(dp,fallback){
    const r=dp&&dp.r||{};
    const candidates=[
      rawLineFromRecord(r),
      fallback,
      currentGroupNameForDp(dp),
      (typeof routeLastSingleName!=='undefined'?routeLastSingleName:''),
      (Array.isArray(window.routeLastMultiNames)&&window.routeLastMultiNames.length===1?window.routeLastMultiNames[0]:'')
    ];
    for(const c of candidates){
      const line=cleanLineName(c);
      if(line&&!isBadAutoLine(line))return line;
    }
    return 'Unknown';
  }
  function estimateTitle(dp){
    const r=dp&&dp.r||{};
    let title='';
    try{title=getStructure(r)||'';}catch(e){}
    title=String(title||'').trim();
    if(!title || /^unknown asset$/i.test(title) || /^power\s*vertex$/i.test(title)){
      const p=dp&&dp.plate!=null?String(dp.plate):'';
      title=p?('Estimated '+p):'Estimated asset';
    }
    return title;
  }
  function enrichEstimateDp(dp,line){
    if(!dp||!dp.r)return dp;
    const goodLine=preferredLineForDp(dp,line);
    const old=rawLineFromRecord(dp.r);
    if(!old || isBadAutoLine(old) || dp.virtual || dp.gapEstimate){
      try{dp.r.__line=goodLine;}catch(e){}
    }
    if((dp.virtual||dp.gapEstimate) && (!dp.r.__title || /^power\s*vertex$/i.test(String(dp.r.__title)))){
      const p=dp.plate!=null?String(dp.plate):'';
      dp.r.__title=p?('Estimated missing '+p):'Estimated missing asset';
      dp.r.__pole=dp.r.__pole||dp.r.__title;
      dp.r.__kind='estimated_missing';
      dp.r.__isVirtualEstimate=true;
    }
    return dp;
  }
  function enrichCurrentEstimates(){
    try{(routeLastDisplayGroups||[]).forEach(g=>(g.dps||[]).forEach(dp=>enrichEstimateDp(dp,g.name||'')));}catch(e){}
  }

  let oldStore=null, oldVirtualRecord=null, oldTooltip=null, oldPopup=null, oldAutoOpen=null, oldAutoAlign=null, oldShowPublic=null, oldOpenSheet=null;
  try{oldStore=routeStoreDisplayGroup;}catch(e){}
  try{oldVirtualRecord=routeVirtualEstimateRecord;}catch(e){}
  try{oldTooltip=routeDisplayTooltip;}catch(e){}
  try{oldPopup=routeAssetPopupHTML;}catch(e){}
  try{oldAutoOpen=window.openAutoEstimateCorrection;}catch(e){}
  try{oldAutoAlign=routeAutoAlignEstimatesFromLayers;}catch(e){}
  try{oldShowPublic=routeShowPublicPowerFeaturesForView;}catch(e){}
  try{oldOpenSheet=openEstimateReviewSheet;}catch(e){}

  try{
    routeVirtualEstimateRecord=function(route,plate,sourceNote){
      const line=cleanLineName(route);
      const finalLine=(!line||isBadAutoLine(line))?'Unknown':line;
      const p=Number(plate);
      const label=Number.isFinite(p)?String(p):'missing';
      return {
        __kind:'estimated_missing',
        __title:'Estimated missing '+label,
        __pole:'Estimated missing '+label,
        __line:finalLine,
        __isVirtualEstimate:true,
        __sourceNote:sourceNote||'No matching source record found in imported data.'
      };
    };
  }catch(e){}

  try{
    routeStoreDisplayGroup=function(name,dps){
      const line=(!name||isBadAutoLine(name))?'Unknown':cleanLineName(name);
      (dps||[]).forEach(dp=>enrichEstimateDp(dp,line));
      if(typeof oldStore==='function')return oldStore.apply(this,arguments);
      if(!Array.isArray(routeLastDisplayGroups))routeLastDisplayGroups=[];
      routeLastDisplayGroups.push({name:String(line||''),dps:dps||[]});
    };
  }catch(e){}

  try{
    routeDisplayTooltip=function(dp){
      if(!dp||!dp.estimated){return typeof oldTooltip==='function'?oldTooltip.apply(this,arguments):'';}
      enrichEstimateDp(dp,currentGroupNameForDp(dp));
      const line=preferredLineForDp(dp,'Unknown');
      const title=estimateTitle(dp);
      if(dp.gapEstimate)return `${line} | ${title} | estimated missing number - not in source data`;
      return `${line} | ${title} | estimated - no GPS in file`;
    };
  }catch(e){}

  try{
    routeAssetPopupHTML=function(index,lat,lng,estimated,dp){
      if(!dp||!dp.estimated){return typeof oldPopup==='function'?oldPopup.apply(this,arguments):'';}
      enrichEstimateDp(dp,currentGroupNameForDp(dp));
      const r=(dp&&dp.r)||(index>=0?allRecords[index]:{})||{};
      const title=estimateTitle(dp);
      const line=preferredLineForDp(dp,'Unknown');
      const nav=Number.isFinite(Number(lat))&&Number.isFinite(Number(lng));
      const virtual=!!(dp&&dp.virtual)||!!r.__isVirtualEstimate||index<0;
      const note=virtual?'<span class="estimated-pop-note">Estimated missing number only - no source record exists in the imported data.</span>':'<span class="estimated-pop-note">Estimated position only - source record has no GPS.</span>';
      const view=virtual?'<button class="asset-popup-view" disabled>Not in source</button>':`<button class="asset-popup-view" onclick="event.stopPropagation();assetViewMore(${Number(index)})">View more</button>`;
      let estimateButtons='';
      try{estimateButtons=routeEstimatePopupButtons(dp)||'';}catch(e){}
      const correctionNote=(dp&&dp.corrected&&!dp.autoAligned)?'<span class="estimated-pop-note corrected">Manually corrected locally - trusted for blue line</span>':((dp&&dp.autoAligned)?'<span class="estimated-pop-note">Auto-aligned warning dot - not trusted for blue line</span>':'');
      return `<div class="asset-mini-pop single-point-pop"><b>${escHTML(title)}</b><span>${escHTML(line||'Unknown')}</span>${note}${correctionNote}<div class="asset-popup-actions">${view}<button class="asset-popup-nav" onclick="event.stopPropagation();openMapsForRoutePoint(${Number(lat)},${Number(lng)})" ${nav?'':'disabled'}>Open estimate</button>${estimateButtons}</div></div>`;
    };
  }catch(e){}

  async function runCurrentAutoEstimateCorrection(){
    try{closeDrawer?.();closePlus?.();closeSettings?.();closeEstimateReviewSheet?.();}catch(e){}
    enrichCurrentEstimates();
    try{routeClearPublicPowerDebug?.();}catch(e){}
    let estimates=[];
    try{estimates=routeCollectCurrentEstimateDps?.()||[];}catch(e){estimates=[];}
    if(!estimates.length){
      safeStatus('Load a route with yellow/orange estimate dots first, then press Auto Estimate.');
      try{openEstimateReviewSheet?.();}catch(e){}
      return;
    }
    safeStatus(`Auto Estimate: checking ${estimates.length.toLocaleString()} current estimate dot${estimates.length===1?'':'s'} on the loaded route.`);
    if(typeof oldAutoAlign==='function')return oldAutoAlign.apply(this,arguments);
    if(typeof routeAutoAlignEstimatesFromLayers==='function')return routeAutoAlignEstimatesFromLayers();
  }
  window.openAutoEstimateCorrection=runCurrentAutoEstimateCorrection;

  try{
    routeAutoAlignEstimatesFromLayers=async function(){
      enrichCurrentEstimates();
      try{routeClearPublicPowerDebug?.();}catch(e){}
      return typeof oldAutoAlign==='function'?oldAutoAlign.apply(this,arguments):undefined;
    };
  }catch(e){}

  try{
    routeShowPublicPowerFeaturesForView=async function(){
      if(!map||!assetLayer||typeof L==='undefined'){safeStatus('Map not ready.');return;}
      try{routeClearPublicPowerDebug?.();}catch(e){}
      try{routeAutoAlignSetStatus('Checking public power reference layer',3,'Fetching public power data for the current view');}catch(e){}
      try{
        const b=map.getBounds().pad?map.getBounds().pad(.2):map.getBounds();
        let features=[];
        try{features=features.concat(await routeFetchOsmFeaturesForView(b,'powerNodes'));}catch(e){}
        try{features=features.concat(await routeFetchOsmFeaturesForView(b,'powerWays'));}catch(e){}
        let nodes=0,lines=0;
        (features||[]).slice(0,1800).forEach(f=>{
          if(!f||!Array.isArray(f.pts)||!f.pts.length)return;
          if(f.pts.length===1){
            const pt=f.pts[0];
            const m=L.circleMarker([pt.lat,pt.lng],{radius:4.2,weight:2,color:'#7c2cff',fillColor:'#f0c4ff',fillOpacity:.75,opacity:.75,interactive:false}).addTo(assetLayer);
            try{m.bindTooltip('Public power reference only - not an imported asset');}catch(e){}
            routePublicPowerDebugLayers.push(m);nodes++;
          }else{
            const pts=f.pts.map(p=>[p.lat,p.lng]);
            const l=L.polyline(pts,{color:'#7c2cff',weight:2.2,opacity:.34,dashArray:'5 7',interactive:false}).addTo(assetLayer);
            routePublicPowerDebugLayers.push(l);lines++;
          }
        });
        try{routeAutoAlignFinishStatus('Public power reference check complete',`${nodes.toLocaleString()} reference snap point${nodes===1?'':'s'} | ${lines.toLocaleString()} reference line${lines===1?'':'s'} shown. These are not imported assets.`);}catch(e){safeStatus('Public power reference check complete.');}
      }catch(e){try{routeAutoAlignFinishStatus('Public power lookup failed',String(e&&e.message||e||'Overpass unavailable'));}catch(_){safeStatus('Public power lookup failed.');}}
    };
  }catch(e){}

  try{
    openEstimateReviewSheet=function(){
      if(typeof oldOpenSheet==='function')oldOpenSheet.apply(this,arguments);
      setTimeout(()=>{
        const sheet=document.getElementById('estimateReviewSheet');
        if(!sheet)return;
        const head=sheet.querySelector('.estimate-review-head span');
        if(head)head.textContent='Works on the yellow/orange estimate dots already loaded for the current route. Public power data is reference only.';
        const publicBtn=[...sheet.querySelectorAll('button')].find(b=>/show public power/i.test(b.textContent||''));
        if(publicBtn)publicBtn.innerHTML='<b>Show public power reference</b><span>Reference only, not assets</span>';
      },0);
    };
  }catch(e){}

  function patchButtons(){
    try{
      if(typeof renderMapMenu==='function'&&document.getElementById('drawer')?.classList.contains('open')&&document.getElementById('dTitle')?.textContent==='Map')renderMapMenu();
    }catch(e){}
    try{renderCustomPlusGrid?.();}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchButtons,{once:true});else setTimeout(patchButtons,100);
})();


/* ---- js/features/field-map-fixes-v398.js ---- */
/* Field MAP v3.9.8 public power JSON cross-check
   - Public power references are cross-checked against imported JSON records where possible
   - Auto Estimate stores/show JSON asset info when an OSM/public power snap has a nearby imported record
   - Public power overlay markers are clickable and show nearest JSON asset details when available
*/
(function(){
  'use strict';

  const VERSION='3.9.8-public-power-json-crosscheck';
  const MAX_JSON_MATCH_M_ACTIVE=140;
  const MAX_JSON_MATCH_M_GENERAL=55;
  const MAX_JSON_MATCH_M_OVERLAY=85;
  const SOURCE_FLAG='public-power-json-crosscheck';

  function safeStatus(msg){try{showToolStatus?.(msg);}catch(e){}}
  function html(s){try{return esc(s);}catch(e){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}}
  function compact(s){try{return compactSearch(s);}catch(e){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}}
  function getLineSafe(r){try{return getLine(r)||r?.__line||'';}catch(e){return r?.__line||'';}}
  function getTitleSafe(r){try{return getStructure(r)||r?.__title||'';}catch(e){return r?.__title||'';}}
  function getTypeSafe(r){try{return getType(r)||r?.__kind||'';}catch(e){return r?.__kind||'';}}
  function getLatSafe(r){try{return getLat(r);}catch(e){return r?.__lat;}}
  function getLngSafe(r){try{return getLng(r);}catch(e){return r?.__lng;}}
  function gpsOk(lat,lng){lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;}
  function distM(a,b,c,d){
    try{
      if(typeof routeMeters==='function')return routeMeters({lat:Number(a),lng:Number(b)},{lat:Number(c),lng:Number(d)});
      if(typeof distanceMeters==='function')return distanceMeters(Number(a),Number(b),Number(c),Number(d));
    }catch(e){}
    const R=6371000, p1=Number(a)*Math.PI/180, p2=Number(c)*Math.PI/180, dp=(Number(c)-Number(a))*Math.PI/180, dl=(Number(d)-Number(b))*Math.PI/180;
    const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  }
  function badLine(s){
    const raw=String(s||'').trim();
    if(!raw)return true;
    const k=raw.toLowerCase().replace(/[^a-z0-9]+/g,'');
    return !k||k==='unknown'||k==='publicpower'||k==='powervertex'||k==='powerwayvertex'||k==='powernode'||k==='powersynthetic'||k==='power'||k==='wayvertex';
  }
  function cleanLine(s){
    s=String(s||'').replace(/_/g,' ').replace(/\s+/g,' ').trim();
    try{s=canonicalRouteName(s)||s;}catch(e){}
    return s;
  }
  function activeRouteNames(){
    const out=[];
    try{(routeLastDisplayGroups||[]).forEach(g=>{if(g&&g.name)out.push(g.name);});}catch(e){}
    try{if(window.routeLastSingleName)out.push(window.routeLastSingleName);}catch(e){}
    try{if(Array.isArray(window.routeLastMultiNames))out.push(...window.routeLastMultiNames);}catch(e){}
    return [...new Set(out.map(cleanLine).filter(x=>x&&!badLine(x)))];
  }
  function dpRouteName(dp){
    const out=[];
    try{if(dp&&dp.r)out.push(getLineSafe(dp.r),dp.r.__line);}catch(e){}
    try{(routeLastDisplayGroups||[]).forEach(g=>{if(g&&Array.isArray(g.dps)&&g.dps.some(x=>x===dp))out.push(g.name);});}catch(e){}
    return cleanLine(out.find(x=>x&&!badLine(x))||'');
  }
  function lineMatchScore(recordLine,targetLines){
    const rl=compact(cleanLine(recordLine));
    if(!rl)return 0;
    const targets=(targetLines||[]).map(x=>compact(cleanLine(x))).filter(Boolean);
    if(!targets.length)return 1;
    if(targets.includes(rl))return 4;
    if(targets.some(t=>t&&rl.includes(t)||t.includes(rl)))return 3;
    return 0;
  }
  function recordSummary(r,index,d,matchedBy){
    if(!r)return null;
    const lat=Number(getLatSafe(r)),lng=Number(getLngSafe(r));
    const line=cleanLine(getLineSafe(r)||r.__line||'');
    const title=String(getTitleSafe(r)||r.__title||'').trim();
    return {
      index:Number.isInteger(index)?index:recordIndexOfSafe(r),
      title:title||'JSON asset',
      assetId:title||'JSON asset',
      line:badLine(line)?'':line,
      type:getTypeSafe(r)||'asset',
      lat:gpsOk(lat,lng)?lat:null,
      lng:gpsOk(lat,lng)?lng:null,
      distance:Number.isFinite(Number(d))?Number(d):null,
      matchedBy:matchedBy||'nearest imported JSON GPS',
      source:SOURCE_FLAG
    };
  }
  function recordIndexOfSafe(r){try{return recordIndexOf(r);}catch(e){return (window.allRecords||[]).indexOf(r);}}
  function allImportedRecords(){try{return window.allRecords||allRecords||[];}catch(e){return [];}}
  function importedGpsCandidates(bounds){
    const records=allImportedRecords();
    const out=[];
    let s=null,w=null,n=null,e=null;
    try{if(bounds&&bounds.getSouth){s=bounds.getSouth();w=bounds.getWest();n=bounds.getNorth();e=bounds.getEast();}}catch(err){}
    for(let i=0;i<records.length;i++){
      const r=records[i];
      if(!r)continue;
      const lat=Number(getLatSafe(r)),lng=Number(getLngSafe(r));
      if(!gpsOk(lat,lng))continue;
      if(s!==null){
        const pad=.003;
        if(lat<s-pad||lat>n+pad||lng<w-pad||lng>e+pad)continue;
      }
      out.push({r,i,lat,lng,line:cleanLine(getLineSafe(r)||r.__line||''),title:getTitleSafe(r)||r.__title||''});
    }
    return out;
  }
  function nearestJsonRecord(lat,lng,opts={}){
    lat=Number(lat);lng=Number(lng);if(!gpsOk(lat,lng))return null;
    const targetLines=(opts.lines&&opts.lines.length?opts.lines:activeRouteNames()).filter(Boolean);
    const candidates=opts.candidates||importedGpsCandidates(opts.bounds);
    if(!candidates.length)return null;
    let bestLine=null,bestAny=null;
    const activeMax=Number(opts.maxActive)||MAX_JSON_MATCH_M_ACTIVE;
    const anyMax=Number(opts.maxAny)||MAX_JSON_MATCH_M_GENERAL;
    for(const c of candidates){
      const d=distM(lat,lng,c.lat,c.lng);
      if(!Number.isFinite(d))continue;
      const lm=lineMatchScore(c.line,targetLines);
      const summary=recordSummary(c.r,c.i,d,lm>1?'same line + nearest JSON GPS':'nearest imported JSON GPS');
      if(lm>1&&d<=activeMax){
        const score=d-(lm*22);
        if(!bestLine||score<bestLine.score)bestLine={...summary,score,lineScore:lm};
      }
      if(d<=anyMax){
        const score=d+(lm?0:25);
        if(!bestAny||score<bestAny.score)bestAny={...summary,score,lineScore:lm};
      }
    }
    const best=bestLine||bestAny;
    if(!best)return null;
    delete best.score;
    return best;
  }
  function nearestJsonRecordForDpSnap(dp,lat,lng,features){
    const lines=[];
    const dl=dpRouteName(dp); if(dl)lines.push(dl);
    try{if(dp&&dp.r){const rl=cleanLine(getLineSafe(dp.r)||dp.r.__line||'');if(rl&&!badLine(rl))lines.push(rl);}}catch(e){}
    lines.push(...activeRouteNames());
    const uniq=[...new Set(lines.filter(Boolean))];
    const bounds=routeLatLngBoundsAround(lat,lng,MAX_JSON_MATCH_M_ACTIVE+80);
    const candidates=importedGpsCandidates(bounds);
    return nearestJsonRecord(lat,lng,{lines:uniq,candidates,maxActive:MAX_JSON_MATCH_M_ACTIVE,maxAny:MAX_JSON_MATCH_M_GENERAL});
  }
  function routeLatLngBoundsAround(lat,lng,metres){
    try{
      lat=Number(lat);lng=Number(lng);metres=Number(metres)||300;
      const dLat=metres/111320;
      const dLng=metres/(111320*Math.max(.18,Math.cos(lat*Math.PI/180)));
      if(typeof L!=='undefined'&&L.latLngBounds)return L.latLngBounds([[lat-dLat,lng-dLng],[lat+dLat,lng+dLng]]);
    }catch(e){}
    return null;
  }
  function annotateFeature(f,opts={}){
    if(!f||!Array.isArray(f.pts)||!f.pts.length)return f;
    if(f.__fieldMapJsonAnnotated===VERSION)return f;
    let best=null;
    const candidates=opts.candidates||null;
    const lines=opts.lines||activeRouteNames();
    const maxPts=f.pts.length>80?80:f.pts.length;
    const step=f.pts.length>maxPts?Math.ceil(f.pts.length/maxPts):1;
    for(let i=0;i<f.pts.length;i+=step){
      const pt=f.pts[i];
      const match=nearestJsonRecord(pt.lat,pt.lng,{lines,candidates,maxActive:MAX_JSON_MATCH_M_ACTIVE,maxAny:opts.maxAny||MAX_JSON_MATCH_M_OVERLAY});
      if(match&&(!best||Number(match.distance)<Number(best.distance)))best=match;
    }
    if(best){f.__jsonMatch=best;try{f.meta=f.meta||{};f.meta.jsonMatch=best;}catch(e){}}
    f.__fieldMapJsonAnnotated=VERSION;
    return f;
  }
  function annotateFeatures(features,opts={}){
    if(!Array.isArray(features)||!features.length)return features;
    let bounds=opts.bounds||null;
    try{if(!bounds&&features.length){
      const pts=[];features.forEach(f=>(f.pts||[]).slice(0,4).forEach(p=>pts.push([p.lat,p.lng])));
      if(pts.length&&typeof L!=='undefined')bounds=L.latLngBounds(pts).pad(.25);
    }}catch(e){}
    const candidates=importedGpsCandidates(bounds);
    const lines=opts.lines||activeRouteNames();
    features.forEach(f=>annotateFeature(f,{...opts,candidates,lines}));
    return features;
  }
  function findJsonMatchForSnap(snap,features,dp){
    if(!snap)return null;
    const targetKey=snap.targetKey?String(snap.targetKey):'';
    let best=null;
    for(const f of features||[]){
      if(!f||!Array.isArray(f.pts)||!f.pts.length)continue;
      const direct=f.__jsonMatch||f?.meta?.jsonMatch;
      if(targetKey&&f.pts.length===1){
        const pt=f.pts[0];
        const k=Number(pt.lat).toFixed(7)+','+Number(pt.lng).toFixed(7);
        if(k===targetKey&&direct)return direct;
      }
      if(direct){
        const fd=f.pts.reduce((m,pt)=>Math.min(m,distM(snap.lat,snap.lng,pt.lat,pt.lng)),Infinity);
        if(Number.isFinite(fd)&&fd<=20&&(!best||fd<best.__fd))best={...direct,__fd:fd};
      }
    }
    if(best){delete best.__fd;return best;}
    return nearestJsonRecordForDpSnap(dp,snap.lat,snap.lng,features);
  }
  function publicKindLabel(k){
    k=String(k||'public power').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^power$/i,'public power').replace(/^power vertex$/i,'public power vertex');
    return k.charAt(0).toUpperCase()+k.slice(1);
  }
  function crossRefHTML(match,kind){
    if(!match)return `<div class="estimate-crossref"><b>Public power reference</b><span>${html(publicKindLabel(kind))}</span><small>No nearby imported JSON asset matched.</small></div>`;
    const d=Number.isFinite(Number(match.distance))?`${Math.round(Number(match.distance))} m`:'';
    const idx=Number(match.index);
    const view=Number.isInteger(idx)&&idx>=0?`<button class="asset-popup-view" onclick="event.stopPropagation();assetViewMore(${idx})">View JSON asset</button>`:'';
    return `<div class="estimate-crossref"><b>JSON cross-check</b><span>${html(match.assetId||match.title||'JSON asset')}${match.line?` | ${html(match.line)}`:''}${d?` | ${d}`:''}</span><small>${html(match.matchedBy||'matched from imported JSON')}</small>${view}</div>`;
  }
  function matchFromCorrectionKey(key){
    try{
      const c=routeEstimateCorrections()[key]||{};
      return c.publicPowerJsonMatch||c.jsonMatch||null;
    }catch(e){return null;}
  }
  function applyCrossRefToDp(dp,match,meta){
    if(!dp||!match)return;
    const summary={...match,kind:meta&&meta.kind?String(meta.kind):String(dp._alignKind||'publicPower')};
    dp._publicPowerCrossCheck=summary;
    dp._alignKind=summary.kind;
    try{
      const r=dp.r||(dp.r={});
      r.__publicPowerCrossCheck=summary;
      r.__publicPowerKind=summary.kind;
      r.__matchedJsonAsset=summary.assetId||summary.title||'';
      r.__matchedJsonLine=summary.line||'';
      r.__matchedJsonIndex=Number.isInteger(Number(summary.index))?Number(summary.index):null;
      r.__matchedJsonDistance=Number.isFinite(Number(summary.distance))?Number(summary.distance):null;
      if(summary.line&&badLine(getLineSafe(r)||r.__line))r.__line=summary.line;
      const existingTitle=String(getTitleSafe(r)||r.__title||'').trim();
      if((!existingTitle||/^unknown asset$/i.test(existingTitle)||/^power\s*vertex$/i.test(existingTitle)||/^estimated\s+asset$/i.test(existingTitle))&&(summary.assetId||summary.title)){
        r.__title=summary.assetId||summary.title;
        r.__pole=r.__pole||summary.assetId||summary.title;
      }
      r.__sourceNote=(r.__sourceNote?String(r.__sourceNote)+' | ':'')+'Public power cross-checked against imported JSON.';
    }catch(e){}
  }
  function applyCrossRefToEstimateKey(key,meta){
    if(!key||!meta)return;
    const match=meta.jsonMatch||meta.publicPowerJsonMatch||meta.localJsonMatch||null;
    if(!match)return;
    try{
      (routeLastDisplayGroups||[]).forEach(g=>(g.dps||[]).forEach(dp=>{
        if(dp&&dp.estimated&&routeEstimateKey(dp)===key)applyCrossRefToDp(dp,match,meta);
      }));
    }catch(e){}
    try{
      const all=routeEstimateCorrections();
      if(all&&all[key]){
        all[key]={...all[key],publicPowerJsonMatch:match,publicPowerKind:meta.kind||'',publicPowerCrossCheckedAt:new Date().toISOString()};
        saveRouteEstimateCorrections(all);
      }
    }catch(e){}
  }
  function popupAddCrossRef(htmlText,index,dp){
    if(!dp||!dp.estimated)return htmlText;
    let match=dp._publicPowerCrossCheck||dp.r?.__publicPowerCrossCheck||null;
    const kind=dp._alignKind||dp.r?.__publicPowerKind||'';
    if(!match){
      try{const key=routeEstimateKey(dp);match=matchFromCorrectionKey(key);}catch(e){}
    }
    if(!match && !(String(kind||'').startsWith('power')))return htmlText;
    const block=crossRefHTML(match,kind||'public power');
    if(String(htmlText).includes('estimate-crossref'))return htmlText;
    return String(htmlText).replace('<div class="asset-popup-actions">',block+'<div class="asset-popup-actions">');
  }
  function injectTinyCss(){
    if(document.getElementById('field-map-v398-css'))return;
    const style=document.createElement('style');
    style.id='field-map-v398-css';
    style.textContent=`
      .estimate-crossref{margin:8px 0;padding:8px 9px;border-radius:12px;background:#eef7ff;border:1px solid #9ed0ff;color:#092033;display:grid;gap:3px;font-size:12px;line-height:1.25}.estimate-crossref b{font-size:12px;color:#063b78}.estimate-crossref span{font-weight:800}.estimate-crossref small{color:#35506b}.estimate-crossref .asset-popup-view{margin-top:5px;width:100%}.public-power-json-pop{min-width:190px;display:grid;gap:5px}.public-power-json-pop b{font-size:14px}.public-power-json-pop span{display:block;font-size:12px}.public-power-json-pop small{display:block;color:#52616e}.public-power-json-pop button{margin-top:5px;width:100%}`;
    document.head.appendChild(style);
  }

  const oldFetch=typeof routeFetchOsmFeaturesForView==='function'?routeFetchOsmFeaturesForView:null;
  const oldBest=typeof routeBestFeatureSnap==='function'?routeBestFeatureSnap:null;
  const oldMove=typeof routeEstimateMoveKeyToNoRedraw==='function'?routeEstimateMoveKeyToNoRedraw:null;
  const oldApply=typeof routeEstimateApplyCorrection==='function'?routeEstimateApplyCorrection:null;
  const oldPopup=typeof routeAssetPopupHTML==='function'?routeAssetPopupHTML:null;

  try{
    routeFetchOsmFeaturesForView=async function(bounds,mode){
      const features=oldFetch?await oldFetch.apply(this,arguments):[];
      return annotateFeatures(features,{bounds,lines:activeRouteNames()});
    };
  }catch(e){}

  try{
    routeBestFeatureSnap=function(dp,features,allEstimates,usedTargets){
      try{annotateFeatures(features,{lines:[dpRouteName(dp),...activeRouteNames()].filter(Boolean)});}catch(e){}
      const snap=oldBest?oldBest.apply(this,arguments):null;
      if(snap){
        const match=findJsonMatchForSnap(snap,features,dp);
        if(match){
          snap.jsonMatch=match;
          snap.publicPowerJsonMatch=match;
          snap.matchedJsonAsset=match.assetId||match.title||'';
          snap.matchedJsonLine=match.line||'';
          snap.matchedJsonIndex=match.index;
          snap.matchedJsonDistance=match.distance;
          if(!snap.kind)snap.kind='publicPower';
        }
      }
      return snap;
    };
  }catch(e){}

  try{
    routeEstimateMoveKeyToNoRedraw=function(key,lat,lng,meta){
      const ok=oldMove?oldMove.apply(this,arguments):false;
      if(ok&&meta&&meta.publicPowerJsonMatch)applyCrossRefToEstimateKey(String(key),meta);
      else if(ok&&meta&&meta.jsonMatch)applyCrossRefToEstimateKey(String(key),meta);
      return ok;
    };
  }catch(e){}

  try{
    routeEstimateApplyCorrection=function(dp){
      const out=oldApply?oldApply.apply(this,arguments):dp;
      if(out){
        try{const key=routeEstimateKey(out);const match=matchFromCorrectionKey(key);if(match)applyCrossRefToDp(out,match,{kind:(routeEstimateCorrections()[key]||{}).publicPowerKind||'publicPower'});}catch(e){}
      }
      return out;
    };
  }catch(e){}

  try{
    routeAssetPopupHTML=function(index,lat,lng,estimated,dp){
      const h=oldPopup?oldPopup.apply(this,arguments):'';
      return popupAddCrossRef(h,index,dp);
    };
  }catch(e){}

  window.routePublicPowerJsonMatchForPoint=function(lat,lng){return nearestJsonRecord(lat,lng,{maxAny:MAX_JSON_MATCH_M_OVERLAY});};

  try{
    routeShowPublicPowerFeaturesForView=async function(){
      injectTinyCss();
      if(!map||!assetLayer||typeof L==='undefined'){safeStatus('Map not ready.');return;}
      try{routeClearPublicPowerDebug?.();}catch(e){}
      try{routeAutoAlignSetStatus('Checking public power + JSON',3,'Fetching public power and cross-checking imported JSON');}catch(e){}
      try{
        const b=map.getBounds().pad?map.getBounds().pad(.2):map.getBounds();
        let features=[];
        try{features=features.concat(await routeFetchOsmFeaturesForView(b,'powerNodes'));}catch(e){}
        try{features=features.concat(await routeFetchOsmFeaturesForView(b,'powerWays'));}catch(e){}
        annotateFeatures(features,{bounds:b,lines:activeRouteNames(),maxAny:MAX_JSON_MATCH_M_OVERLAY});
        let nodes=0,lines=0,matched=0;
        (features||[]).slice(0,1800).forEach(f=>{
          if(!f||!Array.isArray(f.pts)||!f.pts.length)return;
          const kind=String(f&&f.meta&&f.meta.kind||'public power');
          const match=f.__jsonMatch||f?.meta?.jsonMatch||null;
          if(match)matched++;
          if(f.pts.length===1){
            const pt=f.pts[0];
            const m=L.circleMarker([pt.lat,pt.lng],{radius:match?6.2:4.6,weight:match?3:2,color:match?'#006dff':'#7c2cff',fillColor:match?'#cfe8ff':'#f0c4ff',fillOpacity:.9,opacity:.96}).addTo(assetLayer);
            m._tlRole='publicPowerReference';
            m._jsonMatch=match||null;
            m.bindTooltip(match?`${publicKindLabel(kind)} | JSON: ${match.assetId||match.title} ${match.line?'| '+match.line:''}`:publicKindLabel(kind));
            const d=match&&Number.isFinite(Number(match.distance))?`${Math.round(match.distance)} m`:'';
            const view=match&&Number.isInteger(Number(match.index))&&Number(match.index)>=0?`<button onclick="event.stopPropagation();assetViewMore(${Number(match.index)})">View JSON asset</button>`:'';
            m.bindPopup(`<div class="public-power-json-pop"><b>${html(publicKindLabel(kind))}</b>${match?`<span>JSON: <b>${html(match.assetId||match.title||'JSON asset')}</b></span><span>${html(match.line||'No line name')} ${d?`| ${html(d)}`:''}</span><small>${html(match.matchedBy||'matched imported JSON')}</small>${view}`:'<small>No nearby imported JSON asset matched.</small>'}</div>`,{className:'asset-mini-popup'});
            routePublicPowerDebugLayers.push(m);nodes++;
          }else{
            const pts=f.pts.map(p=>[p.lat,p.lng]);
            const l=L.polyline(pts,{color:match?'#006dff':'#7c2cff',weight:match?3.1:2.2,opacity:match?.66:.45,dashArray:match?'8 6':'5 7'}).addTo(assetLayer);
            l._tlRole='publicPowerReferenceLine';
            l._jsonMatch=match||null;
            const d=match&&Number.isFinite(Number(match.distance))?`${Math.round(match.distance)} m`:'';
            const view=match&&Number.isInteger(Number(match.index))&&Number(match.index)>=0?`<button onclick="event.stopPropagation();assetViewMore(${Number(match.index)})">View JSON asset</button>`:'';
            l.bindPopup(`<div class="public-power-json-pop"><b>${html(publicKindLabel(kind))}</b>${match?`<span>Nearest JSON: <b>${html(match.assetId||match.title||'JSON asset')}</b></span><span>${html(match.line||'No line name')} ${d?`| ${html(d)}`:''}</span><small>${html(match.matchedBy||'matched imported JSON')}</small>${view}`:'<small>No nearby imported JSON asset matched.</small>'}</div>`,{className:'asset-mini-popup'});
            routePublicPowerDebugLayers.push(l);lines++;
          }
        });
        try{routeAutoAlignFinishStatus('Public power + JSON check complete',`${nodes.toLocaleString()} snap points | ${lines.toLocaleString()} power lines | ${matched.toLocaleString()} JSON match${matched===1?'':'es'} added`);}catch(e){safeStatus(`Public power + JSON: ${matched} JSON matches added.`);}
      }catch(e){
        try{routeAutoAlignFinishStatus('Public power + JSON lookup failed',String(e&&e.message||e||'lookup unavailable'));}catch(_){safeStatus('Public power + JSON lookup failed.');}
      }
    };
  }catch(e){}

  try{injectTinyCss();}catch(e){}
})();


/* ---- js/features/field-map-fixes-v399.js ---- */
/* Field MAP v3.9.9 dot source labels
   - Adds source status labels to route dots: CONFIRMED / ESTIMATED / PUBLIC REF / UNKNOWN
   - Keeps labels non-interactive so estimate hit targets and map clicks still work
   - Adds the same status into popups for quick checking in the field
*/
(function(){
  'use strict';

  const VERSION='3.9.9-dot-source-labels';

  function escHTML(s){
    try{return esc(s);}catch(e){
      return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
  }
  function compact(s){
    try{return compactSearch(s);}catch(e){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  }
  function cleanText(s){return String(s||'').replace(/_/g,' ').replace(/\s+/g,' ').trim();}
  function badLineName(s){
    const raw=cleanText(s);
    if(!raw)return true;
    const k=raw.toLowerCase().replace(/[^a-z0-9]+/g,'');
    return !k || k==='unknown' || k==='publicpower' || k==='powervertex' || k==='powerwayvertex' || k==='powernode' || k==='powersynthetic' || k==='power' || k==='wayvertex' || k==='nolinenameline' || k==='noline';
  }
  function getLineSafe(r){
    try{return cleanText((typeof getLine==='function'?getLine(r):'') || r?.__line || r?.line || r?.LINE || '');}catch(e){return cleanText(r?.__line || r?.line || r?.LINE || '');}
  }
  function getTitleSafe(r){
    try{return cleanText((typeof getStructure==='function'?getStructure(r):'') || r?.__title || r?.__pole || r?.id || r?.name || '');}catch(e){return cleanText(r?.__title || r?.__pole || r?.id || r?.name || '');}
  }
  function lineForDp(dp){
    const r=dp&&dp.r||{};
    let line=getLineSafe(r);
    if(badLineName(line) && dp&&dp.__line)line=cleanText(dp.__line);
    if(badLineName(line) && dp&&dp.line)line=cleanText(dp.line);
    try{
      if(badLineName(line) && Array.isArray(routeLastDisplayGroups)){
        const g=routeLastDisplayGroups.find(x=>x&&Array.isArray(x.dps)&&x.dps.includes(dp));
        if(g&&g.name)line=cleanText(g.name);
      }
    }catch(e){}
    try{if(badLineName(line) && window.routeLastSingleName)line=cleanText(window.routeLastSingleName);}catch(e){}
    return badLineName(line)?'':line;
  }
  function roundedDistance(v){
    const n=Number(v);
    return Number.isFinite(n)?`${Math.round(n)} m`:'';
  }
  function statusForDp(dp){
    const r=dp&&dp.r||{};
    const line=lineForDp(dp);
    const hasLine=!badLineName(line);
    const match=dp?._publicPowerCrossCheck || r.__publicPowerCrossCheck || null;
    if(!hasLine){
      return {key:'unknown',label:'UNKNOWN',cls:'unknown',line:'Unknown line',detail:dp&&dp.estimated?'Estimate has no usable line name. Dot remains clickable.':'Source asset has no usable line name.'};
    }
    if(dp&&dp.estimated){
      const kind=dp.gapEstimate?'Inferred missing-number estimate':'Estimated no-GPS position';
      const extra=match?` | JSON cross-check ${match.assetId||match.title||''}${roundedDistance(match.distance)?' '+roundedDistance(match.distance):''}`:'';
      return {key:'estimated',label:'ESTIMATED',cls:'estimated',line,detail:kind+extra};
    }
    return {key:'confirmed',label:'CONFIRMED',cls:'confirmed',line,detail:'Imported JSON asset with map position.'};
  }
  function statusForPublicLayer(layer){
    const match=layer?._jsonMatch || layer?._publicPowerCrossCheck || null;
    const line=match&&match.line&&!badLineName(match.line)?cleanText(match.line):'Unknown line';
    const detail=match?`Public power reference matched to JSON asset ${match.assetId||match.title||'asset'}${roundedDistance(match.distance)?' | '+roundedDistance(match.distance):''}.`:'Public power reference only. No nearby imported JSON asset matched.';
    return {key:'public',label:'PUBLIC REF',cls:'public',line,detail};
  }
  function statusBlock(st){
    if(!st)return '';
    return `<div class="field-map-source-status status-${escHTML(st.cls||st.key)}"><b>${escHTML(st.label)}</b><span>${escHTML(st.line||'Unknown line')}</span><small>${escHTML(st.detail||'')}</small></div>`;
  }
  function addStatusToPopupHTML(html,st){
    const s=String(html||'');
    if(!st || s.includes('field-map-source-status'))return s;
    const block=statusBlock(st);
    if(s.includes('estimate-crossref'))return s.replace('<div class="asset-popup-actions">',block+'<div class="asset-popup-actions">');
    if(s.includes('<div class="asset-popup-actions">'))return s.replace('<div class="asset-popup-actions">',block+'<div class="asset-popup-actions">');
    if(s.includes('public-power-json-pop'))return s.replace(/(<div[^>]*public-power-json-pop[^>]*>)/,`$1${block}`);
    return block+s;
  }
  function injectCss(){
    if(document.getElementById('field-map-v399-dot-status-css'))return;
    const style=document.createElement('style');
    style.id='field-map-v399-dot-status-css';
    style.textContent=`
      .field-map-dot-status.leaflet-tooltip{pointer-events:none!important;border:1.8px solid rgba(15,23,42,.82)!important;border-radius:8px!important;padding:2px 5px!important;font-size:9px!important;line-height:1!important;font-weight:950!important;letter-spacing:.03em;text-transform:uppercase!important;box-shadow:0 2px 8px rgba(0,0,0,.32)!important;white-space:nowrap!important;opacity:.98!important;}
      .field-map-dot-status:before{display:none!important;}
      .field-map-dot-status.status-confirmed{background:#eefbea!important;color:#12320d!important;border-color:#236c28!important;}
      .field-map-dot-status.status-estimated{background:#fff1b7!important;color:#3e2600!important;border-color:#9b6200!important;}
      .field-map-dot-status.status-public{background:#ede9ff!important;color:#26104f!important;border-color:#6d28d9!important;}
      .field-map-dot-status.status-unknown{background:#ffe5e5!important;color:#5c0505!important;border-color:#b91c1c!important;}
      .field-map-source-status{margin:7px 0 8px;padding:7px 8px;border-radius:12px;display:grid;grid-template-columns:auto 1fr;gap:2px 7px;align-items:center;font-size:12px;line-height:1.2;border:1.8px solid rgba(15,23,42,.25);background:#fff;color:#0f172a;}
      .field-map-source-status b{font-size:11px;font-weight:950;letter-spacing:.04em;border-radius:999px;padding:3px 7px;white-space:nowrap;}
      .field-map-source-status span{font-weight:850;overflow-wrap:anywhere;}
      .field-map-source-status small{grid-column:1/-1;font-size:11px;color:#334155;}
      .field-map-source-status.status-confirmed{background:#f0fdf4;border-color:#4ade80}.field-map-source-status.status-confirmed b{background:#166534;color:#fff}
      .field-map-source-status.status-estimated{background:#fffbeb;border-color:#f59e0b}.field-map-source-status.status-estimated b{background:#92400e;color:#fff}
      .field-map-source-status.status-public{background:#f5f3ff;border-color:#8b5cf6}.field-map-source-status.status-public b{background:#5b21b6;color:#fff}
      .field-map-source-status.status-unknown{background:#fff1f2;border-color:#ef4444}.field-map-source-status.status-unknown b{background:#991b1b;color:#fff}
      path.field-map-status-unknown-dot{stroke:#b91c1c!important;fill:#fecaca!important;stroke-width:3.1!important;filter:drop-shadow(0 1px 4px rgba(0,0,0,.45))!important;}
      path.field-map-status-estimated-dot{stroke:#fff8e8!important;stroke-width:2.5!important;}
      path.field-map-status-confirmed-dot{stroke-width:2.1!important;}
      path.field-map-status-public-ref-dot{stroke:#6d28d9!important;fill:#ddd6fe!important;stroke-width:2.5!important;}
      .field-map-status-legend{position:absolute;left:10px;top:10px;z-index:750;display:flex;gap:5px;flex-wrap:wrap;max-width:calc(100vw - 94px);pointer-events:none;}
      body.drawer-open .field-map-status-legend,body.settings-open .field-map-status-legend,body.asset-index-open .field-map-status-legend{display:none;}
      .field-map-status-legend span{font-size:9px;font-weight:950;letter-spacing:.03em;border:1.5px solid rgba(15,23,42,.35);border-radius:999px;padding:3px 6px;background:#fff;box-shadow:0 2px 7px rgba(0,0,0,.22);}
      .field-map-status-legend .confirmed{background:#eefbea;color:#12320d;border-color:#236c28}.field-map-status-legend .estimated{background:#fff1b7;color:#3e2600;border-color:#9b6200}.field-map-status-legend .public{background:#ede9ff;color:#26104f;border-color:#6d28d9}.field-map-status-legend .unknown{background:#ffe5e5;color:#5c0505;border-color:#b91c1c}
    `;
    document.head.appendChild(style);
  }
  function ensureLegend(){
    try{
      if(document.getElementById('fieldMapStatusLegend'))return;
      const mapEl=document.getElementById('map');
      if(!mapEl)return;
      const box=document.createElement('div');
      box.id='fieldMapStatusLegend';
      box.className='field-map-status-legend';
      box.innerHTML='<span class="confirmed">CONFIRMED</span><span class="estimated">ESTIMATED</span><span class="public">PUBLIC REF</span><span class="unknown">UNKNOWN</span>';
      mapEl.appendChild(box);
    }catch(e){}
  }
  function addTooltipLabel(layer,st,opts={}){
    try{
      if(!layer||!st||!layer.bindTooltip)return;
      const permanent=opts.permanent!==false;
      const dir=opts.direction||'top';
      const offset=opts.offset||[0,-10];
      layer._fieldMapSourceStatus=st;
      layer.bindTooltip(st.label,{permanent,interactive:false,direction:dir,offset,opacity:.98,className:`field-map-dot-status status-${st.cls||st.key}`});
      if(layer.openTooltip && permanent){setTimeout(()=>{try{layer.openTooltip();}catch(e){}},0);}
      if(layer.on){
        layer.on('add',()=>setTimeout(()=>{try{if(permanent&&layer.openTooltip)layer.openTooltip();}catch(e){}},0));
        layer.on('click',()=>setTimeout(()=>{try{if(permanent&&layer.openTooltip)layer.openTooltip();}catch(e){}},80));
      }
    }catch(e){}
  }
  function patchPopup(layer,st){
    try{
      if(!layer||!layer.getPopup)return;
      const p=layer.getPopup();
      if(!p||!p.getContent||!p.setContent)return;
      const c=p.getContent();
      if(typeof c==='string')p.setContent(addStatusToPopupHTML(c,st));
    }catch(e){}
  }
  function labelPublicReferenceLayer(layer){
    try{
      if(!layer)return;
      const st=statusForPublicLayer(layer);
      const isPoint=typeof layer.getLatLng==='function';
      addTooltipLabel(layer,st,{permanent:isPoint,direction:isPoint?'top':'center',offset:isPoint?[0,-10]:[0,0]});
      patchPopup(layer,st);
      try{if(layer.setStyle&&isPoint)layer.setStyle({className:'field-map-status-public-ref-dot',color:'#6d28d9',fillColor:'#ddd6fe',weight:2.5});}catch(e){}
    }catch(e){}
  }
  function labelExistingPublicReferences(){
    try{
      if(Array.isArray(routePublicPowerDebugLayers))routePublicPowerDebugLayers.forEach(labelPublicReferenceLayer);
    }catch(e){}
  }

  injectCss();
  setTimeout(ensureLegend,250);

  try{
    const oldMarkerStyle=routeDisplayMarkerStyle;
    routeDisplayMarkerStyle=function(dp){
      const out=oldMarkerStyle?oldMarkerStyle.apply(this,arguments):{};
      try{
        const st=statusForDp(dp);
        const cls=st.key==='unknown'?'field-map-status-unknown-dot':(st.key==='estimated'?'field-map-status-estimated-dot':'field-map-status-confirmed-dot');
        out.className=cleanText((out.className||'')+' '+cls+' field-map-source-'+st.key);
        if(st.key==='unknown'){
          out.color='#b91c1c';out.fillColor='#fecaca';out.weight=Math.max(Number(out.weight)||2.2,3.0);out.fillOpacity=.96;out.opacity=1;
        }
      }catch(e){}
      return out;
    };
  }catch(e){}

  try{
    const oldTooltip=routeDisplayTooltip;
    routeDisplayTooltip=function(dp){
      const st=statusForDp(dp);
      const base=oldTooltip?oldTooltip.apply(this,arguments):'';
      return `${st.label} | ${st.line||'Unknown line'}${base?' | '+base:''}`;
    };
  }catch(e){}

  try{
    const oldPopup=routeAssetPopupHTML;
    routeAssetPopupHTML=function(index,lat,lng,estimated,dp){
      const h=oldPopup?oldPopup.apply(this,arguments):'';
      return addStatusToPopupHTML(h,statusForDp(dp));
    };
  }catch(e){}

  try{
    const oldBind=bindRouteDisplayPopup;
    bindRouteDisplayPopup=function(marker,dp){
      const result=oldBind?oldBind.apply(this,arguments):undefined;
      try{addTooltipLabel(marker,statusForDp(dp),{permanent:true,direction:'top',offset:[0,-11]});}catch(e){}
      return result;
    };
  }catch(e){}

  try{
    const oldAssetPopup=assetPopupHTML;
    assetPopupHTML=function(index){
      const r=allRecords&&allRecords[index]||{};
      const st=badLineName(getLineSafe(r))?{key:'unknown',label:'UNKNOWN',cls:'unknown',line:'Unknown line',detail:'Imported source asset has no usable line name.'}:{key:'confirmed',label:'CONFIRMED',cls:'confirmed',line:getLineSafe(r),detail:'Imported JSON asset.'};
      const h=oldAssetPopup?oldAssetPopup.apply(this,arguments):'';
      return addStatusToPopupHTML(h,st);
    };
  }catch(e){}

  try{
    const oldBindAsset=bindAssetMiniPopup;
    bindAssetMiniPopup=function(marker,index){
      const result=oldBindAsset?oldBindAsset.apply(this,arguments):undefined;
      try{
        const r=allRecords&&allRecords[index]||{};
        const st=badLineName(getLineSafe(r))?{key:'unknown',label:'UNKNOWN',cls:'unknown',line:'Unknown line',detail:'Imported source asset has no usable line name.'}:{key:'confirmed',label:'CONFIRMED',cls:'confirmed',line:getLineSafe(r),detail:'Imported JSON asset.'};
        addTooltipLabel(marker,st,{permanent:true,direction:'top',offset:[0,-18]});
      }catch(e){}
      return result;
    };
  }catch(e){}

  try{
    const oldPublic=routeShowPublicPowerFeaturesForView;
    routeShowPublicPowerFeaturesForView=async function(){
      const res=oldPublic?await oldPublic.apply(this,arguments):undefined;
      setTimeout(labelExistingPublicReferences,0);
      return res;
    };
  }catch(e){}

  try{
    const oldOpenMap=openMapMenu;
    openMapMenu=function(){
      injectCss();ensureLegend();
      return oldOpenMap?oldOpenMap.apply(this,arguments):undefined;
    };
  }catch(e){}

  window.fieldMapDotStatusForEstimate=function(dp){return statusForDp(dp);};
  window.fieldMapRefreshDotStatusLabels=function(){injectCss();ensureLegend();labelExistingPublicReferences();};
})();


/* ---- js/features/field-map-fixes-v400.js ---- */
/* Field MAP v4.0.0 source-status cleanup
   Cleaner system for dot source types:
   - No permanent text labels by default
   - Dot type is shown in popup/tap details
   - Optional close-zoom labels only, controlled from one compact Source key
   - Public power reference layer is quieted so it does not bury the map
*/
(function(){
  'use strict';

  const VERSION='4.0.0-source-status-clean';
  const LS_LABELS='fieldMap.sourceLabels.closeZoom.enabled';
  const CLOSE_ZOOM=17;

  function safeStatus(msg){try{showToolStatus(String(msg||''));}catch(e){}}
  function escText(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function hasStatusTooltip(layer){
    try{
      const tt=layer&&layer.getTooltip&&layer.getTooltip();
      const cls=tt&&tt.options&&String(tt.options.className||'');
      return !!tt && cls.includes('field-map-dot-status');
    }catch(e){return false;}
  }
  function statusClass(st){return `field-map-dot-status status-${(st&&st.cls)||(st&&st.key)||'unknown'}`;}
  function bindStatusTooltip(layer,st){
    try{
      if(!layer||!st||!layer.bindTooltip)return;
      if(hasStatusTooltip(layer))return;
      layer.bindTooltip(st.label||'',{
        permanent:true,
        interactive:false,
        direction:'top',
        offset:[0,-10],
        opacity:.96,
        className:statusClass(st)
      });
      if(layer.openTooltip)layer.openTooltip();
    }catch(e){}
  }
  function unbindStatusTooltip(layer){
    try{if(hasStatusTooltip(layer)&&layer.unbindTooltip)layer.unbindTooltip();}catch(e){}
  }
  function forEachStatusLayer(cb){
    const seen=new Set();
    function visit(layer){
      if(!layer||seen.has(layer))return;
      seen.add(layer);
      try{if(layer._fieldMapSourceStatus)cb(layer,layer._fieldMapSourceStatus);}catch(e){}
      try{if(layer.eachLayer)layer.eachLayer(visit);}catch(e){}
    }
    try{if(window.assetLayer)visit(window.assetLayer);}catch(e){}
    try{(window.routePublicPowerDebugLayers||[]).forEach(visit);}catch(e){}
    try{(window.routeReviewLineLayers||[]).forEach(visit);}catch(e){}
  }
  function labelsEnabled(){
    try{return localStorage.getItem(LS_LABELS)==='1';}catch(e){return false;}
  }
  function isCloseZoom(){
    try{return !!(window.map&&Number(map.getZoom&&map.getZoom())>=CLOSE_ZOOM);}catch(e){return false;}
  }
  function applyLabelMode(){
    const enabled=labelsEnabled();
    const close=isCloseZoom();
    try{document.body.classList.toggle('field-map-source-labels-on',enabled);}catch(e){}
    try{document.body.classList.toggle('field-map-source-labels-close',enabled&&close);}catch(e){}
    forEachStatusLayer((layer,st)=>{
      if(enabled&&close)bindStatusTooltip(layer,st);
      else unbindStatusTooltip(layer);
    });
    updateHudState();
  }
  function removeOldLegend(){
    try{document.getElementById('fieldMapStatusLegend')?.remove();}catch(e){}
  }
  function quietPublicPower(){
    try{
      (window.routePublicPowerDebugLayers||[]).forEach(layer=>{
        try{unbindStatusTooltip(layer);}catch(e){}
        try{
          if(layer&&layer._tlRole==='publicPowerReference'&&layer.setStyle){
            const matched=!!layer._jsonMatch;
            layer.setStyle({
              radius: matched?4.8:3.2,
              weight: matched?2.2:1.4,
              color: matched?'#006dff':'#7c2cff',
              fillColor: matched?'#cfe8ff':'#f0c4ff',
              fillOpacity: matched?.48:.22,
              opacity: matched?.72:.36
            });
            if(layer.setRadius)layer.setRadius(matched?4.8:3.2);
          }else if(layer&&layer._tlRole==='publicPowerReferenceLine'&&layer.setStyle){
            const matched=!!layer._jsonMatch;
            layer.setStyle({
              color: matched?'#006dff':'#7c2cff',
              weight: matched?2.2:1.4,
              opacity: matched?.44:.24,
              dashArray: matched?'8 8':'5 9'
            });
          }
        }catch(e){}
      });
    }catch(e){}
    applyLabelMode();
  }
  function injectCss(){
    if(document.getElementById('field-map-v400-source-clean-css'))return;
    const style=document.createElement('style');
    style.id='field-map-v400-source-clean-css';
    style.textContent=`
      #fieldMapStatusLegend,.field-map-status-legend{display:none!important;}
      .leaflet-tooltip.field-map-dot-status{display:none!important;}
      body.field-map-source-labels-on.field-map-source-labels-close .leaflet-tooltip.field-map-dot-status{display:block!important;transform:scale(.86);transform-origin:center bottom;opacity:.9!important;}
      body.field-map-fullscreen-active .field-map-source-hud, body.ui-hidden .field-map-source-hud, body.map-ui-hidden .field-map-source-hud{display:none!important;pointer-events:none!important;}
      .field-map-source-hud{position:absolute;left:10px;top:10px;z-index:755;pointer-events:auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#07111f;}
      body.drawer-open .field-map-source-hud,body.settings-open .field-map-source-hud,body.asset-index-open .field-map-source-hud{display:none!important;}
      .source-hud-pill{min-height:36px;display:flex;align-items:center;gap:7px;border:1.5px solid rgba(255,255,255,.88);border-radius:999px;background:rgba(255,255,255,.92);color:#0b1220;box-shadow:0 7px 18px rgba(0,0,0,.24);padding:6px 10px;font-weight:950;font-size:12px;letter-spacing:.01em;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(6px);}
      .source-hud-pill:active{transform:scale(.97);}
      .source-dot-row{display:flex;align-items:center;gap:4px;}
      .source-mini-dot{width:8px;height:8px;border-radius:999px;border:1.5px solid rgba(15,23,42,.55);display:inline-block;}
      .source-mini-dot.confirmed{background:#34c759}.source-mini-dot.estimated{background:#f6c445}.source-mini-dot.public{background:#8b5cf6}.source-mini-dot.unknown{background:#ef4444}
      .source-hud-panel{position:absolute;left:0;top:43px;width:min(300px,calc(100vw - 24px));border-radius:20px;background:rgba(255,255,255,.98);border:1.5px solid rgba(15,23,42,.18);box-shadow:0 18px 44px rgba(0,0,0,.34);padding:12px;display:none;}
      .field-map-source-hud.open .source-hud-panel{display:block;}
      .source-hud-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:950;font-size:15px;margin:0 0 9px;}
      .source-hud-title small{display:block;font-weight:800;font-size:11px;color:#536071;margin-top:1px;}
      .source-hud-x{width:32px;height:32px;border:0;border-radius:12px;background:#eef2f7;color:#0f172a;font-weight:950;font-size:18px;}
      .source-hud-row{display:grid;grid-template-columns:14px 84px 1fr;gap:8px;align-items:center;padding:7px 2px;border-top:1px solid #edf1f6;font-size:12px;line-height:1.15;}
      .source-hud-row:first-of-type{border-top:0;}
      .source-hud-row b{font-size:11px;font-weight:950;letter-spacing:.02em;}
      .source-hud-row span:last-child{color:#475569;font-weight:750;}
      .source-hud-toggle{margin-top:10px;border-radius:16px;border:1.5px solid #cbd5e1;background:#f8fafc;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:900;}
      .source-hud-toggle button{border:0;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:950;background:#0b5cff;color:#fff;box-shadow:0 4px 12px rgba(11,92,255,.27);}
      .source-hud-toggle button.off{background:#e2e8f0;color:#0f172a;box-shadow:none;}
      .source-hud-note{font-size:11px;line-height:1.25;color:#64748b;font-weight:760;margin-top:8px;}
      .field-map-source-status{margin-top:8px!important;}
      path.field-map-status-public-ref-dot{opacity:.45!important;fill-opacity:.22!important;stroke-width:1.6!important;filter:none!important;}
      body.field-map-public-quiet path.field-map-status-public-ref-dot{opacity:.38!important;fill-opacity:.18!important;stroke-width:1.4!important;}
    `;
    document.head.appendChild(style);
  }
  function ensureHud(){
    try{
      const mapEl=document.getElementById('map');
      if(!mapEl)return;
      let hud=document.getElementById('fieldMapSourceHud');
      if(hud)return;
      hud=document.createElement('div');
      hud.id='fieldMapSourceHud';
      hud.className='field-map-source-hud';
      hud.innerHTML=`
        <button class="source-hud-pill" id="fieldMapSourceHudBtn" type="button" aria-label="Dot source key">
          <span>Source</span>
          <span class="source-dot-row"><i class="source-mini-dot confirmed"></i><i class="source-mini-dot estimated"></i><i class="source-mini-dot public"></i><i class="source-mini-dot unknown"></i></span>
        </button>
        <div class="source-hud-panel" id="fieldMapSourcePanel">
          <div class="source-hud-title"><div>Dot source key<small>Map stays clean. Tap a dot for full detail.</small></div><button class="source-hud-x" id="fieldMapSourceClose" type="button">×</button></div>
          <div class="source-hud-row"><i class="source-mini-dot confirmed"></i><b>CONFIRMED</b><span>Imported JSON asset with GPS.</span></div>
          <div class="source-hud-row"><i class="source-mini-dot estimated"></i><b>ESTIMATED</b><span>Calculated from your current line/route.</span></div>
          <div class="source-hud-row"><i class="source-mini-dot public"></i><b>PUBLIC REF</b><span>Reference/cross-check only.</span></div>
          <div class="source-hud-row"><i class="source-mini-dot unknown"></i><b>UNKNOWN</b><span>No usable line name.</span></div>
          <div class="source-hud-toggle"><span id="fieldMapSourceToggleText">Labels off</span><button id="fieldMapSourceToggle" type="button" class="off">Off</button></div>
          <div class="source-hud-note" id="fieldMapSourceHint">Labels are hidden by default to stop map clutter. Turn them on only when zoomed right in.</div>
        </div>`;
      mapEl.appendChild(hud);
      hud.querySelector('#fieldMapSourceHudBtn')?.addEventListener('click',e=>{e.stopPropagation();hud.classList.toggle('open');updateHudState();});
      hud.querySelector('#fieldMapSourceClose')?.addEventListener('click',e=>{e.stopPropagation();hud.classList.remove('open');});
      hud.querySelector('#fieldMapSourceToggle')?.addEventListener('click',e=>{
        e.stopPropagation();
        const next=!labelsEnabled();
        try{localStorage.setItem(LS_LABELS,next?'1':'0');}catch(_){ }
        applyLabelMode();
        safeStatus(next?`Source labels on at zoom ${CLOSE_ZOOM}+ only.`:'Source labels off. Tap dots for status.');
      });
      mapEl.addEventListener('click',()=>{try{hud.classList.remove('open');}catch(e){}},true);
      updateHudState();
    }catch(e){}
  }
  function updateHudState(){
    try{
      const on=labelsEnabled();
      const close=isCloseZoom();
      const btn=document.getElementById('fieldMapSourceToggle');
      const txt=document.getElementById('fieldMapSourceToggleText');
      const hint=document.getElementById('fieldMapSourceHint');
      if(btn){btn.textContent=on?'On':'Off';btn.classList.toggle('off',!on);}
      if(txt){txt.textContent=on?(close?'Labels visible close-up':'Labels on — zoom in more'):'Labels off';}
      if(hint){hint.textContent=on?(close?'Only close-up labels are showing. Zoom out and they disappear.':'Zoom in closer to show labels. Tap dots anytime for detail.'):'Labels are hidden by default to stop map clutter. Turn them on only when zoomed right in.';}
    }catch(e){}
  }
  function init(){
    injectCss();
    removeOldLegend();
    ensureHud();
    try{document.body.classList.add('field-map-public-quiet');}catch(e){}
    try{if(window.map&&map.on){map.on('zoomend moveend layeradd',()=>{removeOldLegend();setTimeout(()=>{quietPublicPower();applyLabelMode();},0);});}}catch(e){}
    setTimeout(()=>{removeOldLegend();quietPublicPower();applyLabelMode();},250);
    setTimeout(()=>{removeOldLegend();quietPublicPower();applyLabelMode();},1000);
  }

  try{
    const oldOpenMap=window.openMapMenu;
    window.openMapMenu=function(){
      const r=oldOpenMap?oldOpenMap.apply(this,arguments):undefined;
      setTimeout(init,0);
      return r;
    };
  }catch(e){}
  try{
    const oldBind=window.bindRouteDisplayPopup;
    window.bindRouteDisplayPopup=function(marker,dp){
      const r=oldBind?oldBind.apply(this,arguments):undefined;
      setTimeout(applyLabelMode,0);
      return r;
    };
  }catch(e){}
  try{
    const oldBindAsset=window.bindAssetMiniPopup;
    window.bindAssetMiniPopup=function(marker,index){
      const r=oldBindAsset?oldBindAsset.apply(this,arguments):undefined;
      setTimeout(applyLabelMode,0);
      return r;
    };
  }catch(e){}
  try{
    const oldPublic=window.routeShowPublicPowerFeaturesForView;
    window.routeShowPublicPowerFeaturesForView=async function(){
      const r=oldPublic?await oldPublic.apply(this,arguments):undefined;
      setTimeout(()=>{quietPublicPower();applyLabelMode();},0);
      return r;
    };
  }catch(e){}

  window.fieldMapRefreshSourceStatusClean=function(){init();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();


/* ---- js/features/field-map-fixes-v401.js ---- */
/* Field MAP v4.0.1 split correction tools
   - Auto Align is JSON/current-line only. It no longer reads public power.
   - Public Power Check is a separate optional cross-check overlay.
   - Map Controls default: View Area, Clear, Data Corrections, Auto Align, Public Power Check, Crossings.
*/
(function(){
  'use strict';

  const CONTROL_STORAGE_KEY='asset_tracker_v385_tool_layout_controls';
  const V401_MIGRATION_KEY='field_map_v401_split_auto_public_migrated';
  const CONTROL_MAX=6;
  const CONTROL_DEFAULT=['viewArea','clear','corrections','autoAlign','publicPowerCheck','crossings'];
  const PUBLIC_MAX_MATCHED_POINTS=180;
  const PUBLIC_MAX_MATCHED_LINES=80;
  const PUBLIC_MAX_UNMATCHED_SAMPLE=24;
  const PUBLIC_MATCH_ACTIVE_M=150;
  const PUBLIC_MATCH_GENERAL_M=75;

  function status(msg){try{showToolStatus?.(msg);}catch(e){}}
  function html(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function compact(s){try{return compactSearch(s);}catch(e){return String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,'');}}
  function cleanLine(s){s=String(s||'').replace(/_/g,' ').replace(/\s+/g,' ').trim();try{s=canonicalRouteName(s)||s;}catch(e){}return s;}
  function badLine(s){const k=String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');return !k||['unknown','publicpower','powervertex','powerwayvertex','powernode','powersynthetic','power','wayvertex','noline','nolinenameline'].includes(k);}
  function lineOfRecord(r){try{return cleanLine(getLine(r)||r?.__line||'');}catch(e){return cleanLine(r?.__line||'');}}
  function titleOfRecord(r){try{return String(getStructure(r)||r?.__title||r?.__pole||'').trim();}catch(e){return String(r?.__title||r?.__pole||'').trim();}}
  function typeOfRecord(r){try{return String(getType(r)||r?.__kind||'asset');}catch(e){return String(r?.__kind||'asset');}}
  function latOfRecord(r){try{return Number(getLat(r));}catch(e){return Number(r?.__lat);}}
  function lngOfRecord(r){try{return Number(getLng(r));}catch(e){return Number(r?.__lng);}}
  function gpsOk(lat,lng){lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;}
  function distM(a,b,c,d){
    try{if(typeof distanceMeters==='function')return distanceMeters(Number(a),Number(b),Number(c),Number(d));}catch(e){}
    try{if(typeof routeMeters==='function')return routeMeters({lat:Number(a),lng:Number(b)},{lat:Number(c),lng:Number(d)});}catch(e){}
    const R=6371000,p1=Number(a)*Math.PI/180,p2=Number(c)*Math.PI/180,dp=(Number(c)-Number(a))*Math.PI/180,dl=(Number(d)-Number(b))*Math.PI/180;
    const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  }
  function recordIndex(r){try{return recordIndexOf(r);}catch(e){try{return (allRecords||[]).indexOf(r);}catch(_){return -1;}}}
  function allImported(){try{return window.allRecords||allRecords||[];}catch(e){return [];}}
  function currentRouteLines(){
    const out=[];
    try{(routeLastDisplayGroups||[]).forEach(g=>{if(g&&g.name&&!badLine(g.name))out.push(cleanLine(g.name));});}catch(e){}
    try{if(window.routeLastSingleName&&!badLine(window.routeLastSingleName))out.push(cleanLine(window.routeLastSingleName));}catch(e){}
    try{if(Array.isArray(window.routeLastMultiNames))window.routeLastMultiNames.forEach(n=>{if(!badLine(n))out.push(cleanLine(n));});}catch(e){}
    return [...new Set(out.filter(Boolean))];
  }
  function groupLineForDp(dp){
    try{if(dp&&dp.r&&!badLine(lineOfRecord(dp.r)))return lineOfRecord(dp.r);}catch(e){}
    try{for(const g of (routeLastDisplayGroups||[])){if(g&&Array.isArray(g.dps)&&g.dps.includes(dp)&&!badLine(g.name))return cleanLine(g.name);}}catch(e){}
    const lines=currentRouteLines();
    return lines[0]||'';
  }
  function routeDisplayHasCoordSafe(dp){try{return routeDisplayHasCoord(dp);}catch(e){return dp&&gpsOk(dp.lat,dp.lng);}}
  function plateNum(dp){const n=Number(dp&&dp.plate);return Number.isFinite(n)?n:null;}
  function sourceOrderNum(dp){const n=Number(dp&&dp.sourceOrder);return Number.isFinite(n)?n:null;}
  function interpolate(a,b,t){
    try{if(typeof interpolateRoutePoint==='function')return interpolateRoutePoint(a,b,t);}catch(e){}
    return {lat:Number(a.lat)+(Number(b.lat)-Number(a.lat))*t,lng:Number(a.lng)+(Number(b.lng)-Number(a.lng))*t};
  }
  function lineScore(recordLine,targetLines){
    const rl=compact(cleanLine(recordLine));
    const targets=(targetLines||[]).map(x=>compact(cleanLine(x))).filter(Boolean);
    if(!rl)return 0;
    if(!targets.length)return 1;
    if(targets.includes(rl))return 4;
    if(targets.some(t=>t&&(rl.includes(t)||t.includes(rl))))return 3;
    return 0;
  }
  function importedGpsCandidates(bounds){
    const recs=allImported();
    const out=[];
    let s=null,w=null,n=null,e=null;
    try{if(bounds&&bounds.getSouth){s=bounds.getSouth();w=bounds.getWest();n=bounds.getNorth();e=bounds.getEast();}}catch(err){}
    for(let i=0;i<recs.length;i++){
      const r=recs[i];
      const lat=latOfRecord(r),lng=lngOfRecord(r);
      if(!gpsOk(lat,lng))continue;
      if(s!==null){const pad=.004;if(lat<s-pad||lat>n+pad||lng<w-pad||lng>e+pad)continue;}
      out.push({r,i,lat,lng,line:lineOfRecord(r),title:titleOfRecord(r),type:typeOfRecord(r)});
    }
    return out;
  }
  function nearestJson(lat,lng,opts={}){
    lat=Number(lat);lng=Number(lng);if(!gpsOk(lat,lng))return null;
    const targetLines=(opts.lines&&opts.lines.length?opts.lines:currentRouteLines()).filter(Boolean);
    const candidates=opts.candidates||importedGpsCandidates(opts.bounds);
    let bestLine=null,bestAny=null;
    for(const c of candidates){
      const d=distM(lat,lng,c.lat,c.lng);
      if(!Number.isFinite(d))continue;
      const ls=lineScore(c.line,targetLines);
      const summary={index:c.i,title:c.title||'JSON asset',assetId:c.title||'JSON asset',line:badLine(c.line)?'':cleanLine(c.line),type:c.type||'asset',lat:c.lat,lng:c.lng,distance:d,matchedBy:ls>1?'same line + nearest JSON GPS':'nearest imported JSON GPS',source:'json-cross-check'};
      if(ls>1&&d<=PUBLIC_MATCH_ACTIVE_M){const score=d-(ls*25);if(!bestLine||score<bestLine.score)bestLine={...summary,score};}
      if(d<=PUBLIC_MATCH_GENERAL_M){const score=d+(ls?0:35);if(!bestAny||score<bestAny.score)bestAny={...summary,score};}
    }
    const best=bestLine||bestAny;
    if(best)delete best.score;
    return best||null;
  }

  function actionList(){
    return [
      {id:'viewArea',label:'View Area',short:'View Area',sub:'Assets in window',style:'primary',toolClass:'green',icon:'▣'},
      {id:'clear',label:'Clear',short:'Clear',sub:'Remove markers',style:'amber',toolClass:'sun',icon:'⌫'},
      {id:'corrections',label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete assets',style:'primary',toolClass:'green',icon:'✎'},
      {id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON estimates only',style:'teal',toolClass:'teal',icon:'⌁'},
      {id:'publicPowerCheck',label:'Public Power Check',short:'Public Power',sub:'Reference check only',style:'purple',toolClass:'purple',icon:'⌘'},
      {id:'crossings',label:'Crossings',short:'Crossings',sub:'Red crossing zones',style:'amber',toolClass:'sun',icon:'✕'},
      {id:'filter',label:'Filter',short:'Filter',sub:'Layer toggles',style:'teal',toolClass:'teal',icon:'◉'},
      {id:'displayAll',label:'Display All',short:'Display All',sub:'Asset groups',style:'danger',toolClass:'redbtn',icon:'☷'},
      {id:'measure',label:'Measure',short:'Measure',sub:'Two point measure',style:'brown',toolClass:'brown',icon:'↔'},
      {id:'multi',label:'Multi Measure',short:'Multi',sub:'Measure a path',style:'brown',toolClass:'brown',icon:'⌁'},
      {id:'radius',label:'3 km Radius',short:'3 km',sub:'Nearby assets',style:'primary',toolClass:'green',icon:'◎'},
      {id:'poi',label:'POI',short:'POI',sub:'Save current GPS',style:'amber',toolClass:'sun',icon:'◆'},
      {id:'breadcrumb',label:'Breadcrumb',short:'Breadcrumb',sub:'GPS trail',style:'teal',toolClass:'teal',icon:'⋯'},
      {id:'patrol',label:'Patrol',short:'Patrol',sub:'GPS overlay',style:'primary',toolClass:'purple',icon:'⌖'}
    ];
  }
  function actionById(id){return actionList().find(a=>a.id===id);}
  function cleanControls(ids){
    const valid=new Set(actionList().map(a=>a.id));
    const mapped=[];
    (Array.isArray(ids)?ids:[]).forEach(id=>{
      id=String(id||'');
      if(id==='autoCorrection')id='autoAlign';
      if(valid.has(id)&&!mapped.includes(id)&&mapped.length<CONTROL_MAX)mapped.push(id);
    });
    CONTROL_DEFAULT.forEach(id=>{if(!mapped.includes(id)&&mapped.length<CONTROL_MAX)mapped.push(id);});
    return mapped.slice(0,CONTROL_MAX);
  }
  function migrateLayout(){
    try{
      if(localStorage.getItem(V401_MIGRATION_KEY)==='1')return;
      localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(CONTROL_DEFAULT));
      localStorage.setItem(V401_MIGRATION_KEY,'1');
    }catch(e){}
  }
  function patchToolActions(){
    try{
      if(typeof TOOL_ACTIONS!=='undefined'&&Array.isArray(TOOL_ACTIONS)){
        const byId=new Map(TOOL_ACTIONS.map((a,i)=>[a.id,{a,i}]));
        const corr=byId.get('corrections');
        if(corr){Object.assign(corr.a,{label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete assets',style:'primary',toolClass:'green',icon:'✎'});}
        const autoOld=byId.get('autoCorrection');
        if(autoOld){Object.assign(autoOld.a,{id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON estimates only',style:'teal',toolClass:'teal',icon:'⌁'});}
        if(!TOOL_ACTIONS.some(a=>a.id==='autoAlign')){
          const i=Math.max(0,(TOOL_ACTIONS.findIndex(a=>a.id==='corrections')+1)||3);
          TOOL_ACTIONS.splice(i,0,{id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON estimates only',style:'teal',toolClass:'teal',icon:'⌁'});
        }
        if(!TOOL_ACTIONS.some(a=>a.id==='publicPowerCheck')){
          const i=Math.max(0,(TOOL_ACTIONS.findIndex(a=>a.id==='autoAlign')+1)||4);
          TOOL_ACTIONS.splice(i,0,{id:'publicPowerCheck',label:'Public Power Check',short:'Public Power',sub:'Reference check only',style:'purple',toolClass:'purple',icon:'⌘'});
        }
      }
    }catch(e){}
  }

  window.getToolLayoutControls=function(){migrateLayout();try{return cleanControls(JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null'));}catch(e){return CONTROL_DEFAULT.slice();}};
  window.saveToolLayoutControls=function(ids){
    const clean=cleanControls(ids);
    try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(clean));}catch(e){}
    try{renderToolLayoutSettings?.();}catch(e){}
    try{if(document.getElementById('drawer')?.classList.contains('open') && document.getElementById('dTitle')?.textContent==='Map') renderMapMenu();}catch(e){}
    try{renderCustomPlusGrid?.();}catch(e){}
    try{refreshCustomToolActiveStates?.();}catch(e){}
  };
  window.resetToolLayoutControls=function(){window.saveToolLayoutControls(CONTROL_DEFAULT.slice());status('Button layout reset to split Auto Align / Public Power Check.');};
  window.toggleToolLayoutButton=function(id){
    if(id==='autoCorrection')id='autoAlign';
    const cur=window.getToolLayoutControls();
    if(cur.includes(id)){window.saveToolLayoutControls(cur.filter(x=>x!==id));return;}
    if(cur.length>=CONTROL_MAX){alert('Map Controls can hold '+CONTROL_MAX+' buttons. Move one back to Map Tools first.');return;}
    window.saveToolLayoutControls([...cur,id]);
  };
  window.moveToolLayoutButton=function(id,dir){
    if(id==='autoCorrection')id='autoAlign';
    const cur=window.getToolLayoutControls();
    const i=cur.indexOf(id),j=i+dir;
    if(i<0||j<0||j>=cur.length)return;
    [cur[i],cur[j]]=[cur[j],cur[i]];
    window.saveToolLayoutControls(cur);
  };
  function buttonHTML(a){
    const subId=a.id==='crossings'?' id="lineCrossingsSub"':'';
    const activeIds=['measure','multi','radius','breadcrumb','crossings','patrol'];
    const dataTool=activeIds.includes(a.id)?` data-tool="${a.id}"`:'';
    return `<button type="button" class="premium-action-card ${a.style}" data-action-id="${a.id}"${dataTool} onclick="return runToolAction('${a.id}',event)"><i>${a.icon}</i><b>${html(a.label)}</b><span${subId}>${html(a.sub)}</span></button>`;
  }
  window.renderMapMenu=function(){
    patchToolActions();
    const controls=window.getToolLayoutControls();
    const cards=controls.map(id=>actionById(id)).filter(Boolean).map(buttonHTML).join('');
    try{head('Map','Controls');body().innerHTML=`<div class="premium-map-menu compact-map-controls custom-map-controls field-map-fixed-controls field-map-v401-controls"><div class="compact-control-grid custom-control-grid">${cards}</div><button type="button" class="layout-link-btn" onclick="openSettingsSectionFromMapTools()">Button layout</button></div>`;}catch(e){}
    try{refreshCustomToolActiveStates?.();refreshMapControlState?.();}catch(e){}
  };
  window.renderCustomPlusGrid=function(){
    const grid=document.querySelector('#plusSheet .plus-grid');
    if(!grid)return;
    const controls=window.getToolLayoutControls();
    const tools=actionList().filter(a=>!controls.includes(a.id));
    grid.innerHTML=tools.map(a=>{
      const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${a.id}"`:'';
      return `<button type="button" class="${a.toolClass||'green'} tool-btn"${dataTool} onclick="runToolAction('${a.id}',event);closePlus()"><span class="tool-emoji">${a.icon}</span>${html(a.short||a.label)}</button>`;
    }).join('') || '<div class="tool-layout-empty">All quick buttons are in Map Controls.</div>';
    const title=document.querySelector('#plusSheet .plus-title');
    if(title)title.textContent='+ Map Tools';
    try{refreshCustomToolActiveStates?.();}catch(e){}
  };
  window.renderToolLayoutSettings=function(){
    const box=document.getElementById('toolLayoutSettings');
    if(!box)return;
    const controls=window.getToolLayoutControls();
    const controlRows=controls.map((id,i)=>actionById(id)).filter(Boolean).map((a,i)=>`<div class="tool-layout-row in-controls"><div class="tool-layout-order">${i+1}</div><div class="tool-layout-name"><b>${html(a.label)}</b><span>${html(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" onclick="moveToolLayoutButton('${a.id}',-1)" ${i===0?'disabled':''}>Up</button><button type="button" onclick="moveToolLayoutButton('${a.id}',1)" ${i===controls.length-1?'disabled':''}>Down</button><button type="button" class="secondary" onclick="toggleToolLayoutButton('${a.id}')">To Tools</button></div></div>`).join('');
    const toolRows=actionList().filter(a=>!controls.includes(a.id)).map(a=>`<div class="tool-layout-row in-tools"><div class="tool-layout-order">+</div><div class="tool-layout-name"><b>${html(a.label)}</b><span>${html(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" class="green" onclick="toggleToolLayoutButton('${a.id}')" ${controls.length>=CONTROL_MAX?'disabled':''}>To Controls</button></div></div>`).join('');
    box.innerHTML=`<div class="tool-layout-panel clearer-tool-layout"><div class="tool-layout-summary"><b>${controls.length}/${CONTROL_MAX} in Map Controls</b><span>Auto Align uses your JSON only. Public Power Check is separate and does not create assets.</span></div><h4>Shown in Map Controls</h4><div class="tool-layout-list">${controlRows||'<div class="help">No controls selected.</div>'}</div><h4>Left in Map Tools</h4><div class="tool-layout-list">${toolRows||'<div class="help">No extra tools.</div>'}</div><div class="actions"><button type="button" class="secondary" onclick="resetToolLayoutControls()">Reset split default</button></div></div>`;
  };

  function jsonOnlyAutoAlignTarget(dp,groupDps){
    if(!dp||!dp.estimated)return null;
    const p=plateNum(dp);
    const anchors=(groupDps||[]).filter(x=>x&&!x.estimated&&routeDisplayHasCoordSafe(x));
    if(anchors.length<2)return null;
    if(p!==null){
      const plateAnchors=anchors.filter(x=>plateNum(x)!==null).sort((a,b)=>plateNum(a)-plateNum(b)||((sourceOrderNum(a)||0)-(sourceOrderNum(b)||0)));
      let left=null,right=null;
      for(const a of plateAnchors){
        const ap=plateNum(a);
        if(ap<p)left=a;
        if(ap>p){right=a;break;}
      }
      if(left&&right&&plateNum(right)!==plateNum(left)){
        const t=(p-plateNum(left))/(plateNum(right)-plateNum(left));
        const ll=interpolate(left,right,Math.max(0,Math.min(1,t)));
        return {lat:ll.lat,lng:ll.lng,method:`between JSON assets ${plateNum(left)} and ${plateNum(right)}`};
      }
    }
    const ordered=(groupDps||[]).filter(x=>routeDisplayHasCoordSafe(x)).sort((a,b)=>(sourceOrderNum(a)??0)-(sourceOrderNum(b)??0));
    const idx=ordered.indexOf(dp);
    if(idx>=0){
      let left=null,right=null,leftIndex=-1,rightIndex=-1;
      for(let i=idx-1;i>=0;i--){if(ordered[i]&&!ordered[i].estimated){left=ordered[i];leftIndex=i;break;}}
      for(let i=idx+1;i<ordered.length;i++){if(ordered[i]&&!ordered[i].estimated){right=ordered[i];rightIndex=i;break;}}
      if(left&&right){
        const so=sourceOrderNum(dp), ls=sourceOrderNum(left), rs=sourceOrderNum(right);
        let t=(so!==null&&ls!==null&&rs!==null&&rs!==ls)?((so-ls)/(rs-ls)):((idx-leftIndex)/(rightIndex-leftIndex));
        t=Math.max(0,Math.min(1,Number.isFinite(t)?t:.5));
        const ll=interpolate(left,right,t);
        return {lat:ll.lat,lng:ll.lng,method:'between neighbouring JSON assets'};
      }
    }
    return null;
  }
  function cleanupCorrectionAfterJsonAlign(key,line){
    try{
      const all=routeEstimateCorrections();
      if(!all||!all[key])return;
      all[key]={...all[key],autoAligned:true,alignVersion:(typeof ROUTE_AUTO_ALIGN_VERSION!=='undefined'?ROUTE_AUTO_ALIGN_VERSION:'json-only'),alignKind:'jsonLineInterpolation',alignSource:'imported JSON only',lineName:line||'',publicPowerJsonMatch:null,publicPowerKind:null,publicPowerCrossCheckedAt:null,jsonOnlyAlignedAt:new Date().toISOString()};
      saveRouteEstimateCorrections(all);
    }catch(e){}
  }
  window.runJsonOnlyAutoAlign=function(){
    try{closeDrawer?.();closePlus?.();closeSettings?.();}catch(e){}
    let groups=[];
    try{groups=(routeLastDisplayGroups||[]).filter(g=>g&&Array.isArray(g.dps)&&g.dps.length);}catch(e){groups=[];}
    if(!groups.length){status('Load a route with estimate dots first. Auto Align uses current JSON route data only.');return;}
    let checked=0,moved=0,unable=0,lineFixed=0;
    groups.forEach(g=>{
      const line=cleanLine(g.name||'');
      const dps=g.dps||[];
      dps.forEach(dp=>{
        if(!dp||!dp.estimated||!routeDisplayHasCoordSafe(dp))return;
        checked++;
        try{if(dp.r){if(!lineOfRecord(dp.r)&&line)dp.r.__line=line; if(!lineOfRecord(dp.r))dp.r.__line='Unknown'; lineFixed++;}}catch(e){}
        const target=jsonOnlyAutoAlignTarget(dp,dps);
        if(!target||!gpsOk(target.lat,target.lng)){unable++;return;}
        let key='';try{key=routeEstimateKey(dp);}catch(e){}
        if(!key){unable++;return;}
        const ok=routeEstimateMoveKeyToNoRedraw(key,target.lat,target.lng,{kind:'jsonLineInterpolation',d:0,source:'imported-json-only',method:target.method,lineName:line||'Unknown'});
        cleanupCorrectionAfterJsonAlign(key,line||'Unknown');
        if(ok)moved++;
      });
    });
    try{routeRedrawReviewLinesFromGroups?.();applyMapToggleSettings?.();window.fieldMapApplyCleanDotSystem?.();}catch(e){}
    const msg=moved?`Auto Align: ${moved} estimate${moved===1?'':'s'} aligned from JSON only.`:`Auto Align checked ${checked} estimate${checked===1?'':'s'}; current JSON positions already looked aligned.`;
    status(`${msg}${unable?` ${unable} could not be aligned because there were not two JSON anchors.`:''}`);
  };
  window.openAutoEstimateCorrection=function(){return window.runJsonOnlyAutoAlign();};
  window.routeAutoAlignEstimatesFromLayers=function(){return window.runJsonOnlyAutoAlign();};

  function publicKindLabel(k){
    k=String(k||'public power').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^power$/i,'public power').replace(/^power vertex$/i,'public power vertex');
    return k.charAt(0).toUpperCase()+k.slice(1);
  }
  function featureKind(f){return String(f&&f.meta&&f.meta.kind||'public power');}
  function boundsForFeatures(features){
    try{
      const pts=[];
      (features||[]).forEach(f=>(f.pts||[]).forEach(p=>{if(gpsOk(p.lat,p.lng))pts.push([p.lat,p.lng]);}));
      if(pts.length&&typeof L!=='undefined')return L.latLngBounds(pts).pad(.2);
    }catch(e){}
    return null;
  }
  function annotatePublicFeatures(features,bounds){
    const lines=currentRouteLines();
    const candidates=importedGpsCandidates(bounds);
    (features||[]).forEach(f=>{
      if(!f||!Array.isArray(f.pts)||!f.pts.length)return;
      let best=f.__jsonMatch||f?.meta?.jsonMatch||null;
      const maxPts=f.pts.length>100?100:f.pts.length;
      const step=f.pts.length>maxPts?Math.ceil(f.pts.length/maxPts):1;
      for(let i=0;i<f.pts.length;i+=step){
        const p=f.pts[i];
        const m=nearestJson(p.lat,p.lng,{lines,candidates,bounds});
        if(m&&(!best||Number(m.distance)<Number(best.distance)))best=m;
      }
      if(best){f.__jsonMatch=best;f.meta=f.meta||{};f.meta.jsonMatch=best;}
    });
    return features;
  }
  function clearPublicOverlay(){
    try{routePublicPowerDebugLayers.forEach(l=>{try{if(assetLayer&&assetLayer.hasLayer(l))assetLayer.removeLayer(l);}catch(e){}});routePublicPowerDebugLayers=[];}catch(e){}
  }
  function popupForPublic(kind,match){
    const d=match&&Number.isFinite(Number(match.distance))?`${Math.round(Number(match.distance))} m`:'';
    const view=match&&Number.isInteger(Number(match.index))&&Number(match.index)>=0?`<button onclick="event.stopPropagation();assetViewMore(${Number(match.index)})">View JSON asset</button>`:'';
    return `<div class="public-power-json-pop split-public-check"><b>${html(publicKindLabel(kind))}</b><span class="source-pill public">PUBLIC REF</span>${match?`<span>JSON match: <b>${html(match.assetId||match.title||'JSON asset')}</b></span><span>${html(match.line||'No line name')}${d?` | ${html(d)}`:''}</span><small>${html(match.matchedBy||'matched imported JSON')}</small>${view}`:'<small>No nearby imported JSON asset matched. Reference only.</small>'}</div>`;
  }
  function drawPublicFeature(f,match){
    if(!f||!Array.isArray(f.pts)||!f.pts.length||!assetLayer||typeof L==='undefined')return null;
    const kind=featureKind(f);
    if(f.pts.length===1){
      const pt=f.pts[0];
      const marker=L.circleMarker([pt.lat,pt.lng],{radius:match?6.2:4.4,weight:match?3:1.8,color:match?'#0b7cff':'#7c2cff',fillColor:match?'#cfe8ff':'#ede9ff',fillOpacity:match?.95:.55,opacity:match?1:.52,interactive:true}).addTo(assetLayer);
      marker._tlRole='publicPowerReference';
      marker._jsonMatch=match||null;
      marker._fieldMapSourceStatus='public';
      marker.bindTooltip(match?`Public ref | JSON: ${match.assetId||match.title}`:publicKindLabel(kind));
      marker.bindPopup(popupForPublic(kind,match),{className:'asset-mini-popup'});
      routePublicPowerDebugLayers.push(marker);
      return marker;
    }
    const pts=f.pts.map(p=>[Number(p.lat),Number(p.lng)]).filter(p=>gpsOk(p[0],p[1]));
    if(pts.length<2)return null;
    const line=L.polyline(pts,{color:match?'#0b7cff':'#7c2cff',weight:match?3.2:2,opacity:match?.68:.26,dashArray:match?'8 6':'4 9',interactive:true}).addTo(assetLayer);
    line._tlRole='publicPowerReferenceLine';
    line._jsonMatch=match||null;
    line._fieldMapSourceStatus='public';
    line.bindPopup(popupForPublic(kind,match),{className:'asset-mini-popup'});
    routePublicPowerDebugLayers.push(line);
    return line;
  }
  window.routeClearPublicPowerDebug=function(){clearPublicOverlay();status('Public Power Check overlay cleared.');};
  window.runPublicPowerCheck=function(){return window.routeShowPublicPowerFeaturesForView();};
  window.routeShowPublicPowerFeaturesForView=async function(){
    try{closeDrawer?.();closePlus?.();closeSettings?.();}catch(e){}
    if(!map||!assetLayer||typeof L==='undefined'){status('Map not ready.');return;}
    clearPublicOverlay();
    const __alignJob=(window.fieldMapStartAlignmentJob?window.fieldMapStartAlignmentJob('Public Power Check'):null);
    const __alignCancelled=()=>!!(window.fieldMapAlignmentCancelled&&window.fieldMapAlignmentCancelled(__alignJob));
    try{routeAutoAlignSetStatus('Public Power Check',5,'Fetching public power references for the current map area.');}catch(e){status('Public Power Check: fetching public references.');}
    try{
      const b=map.getBounds().pad?map.getBounds().pad(.2):map.getBounds();
      let features=[];
      try{features=features.concat(await routeFetchOsmFeaturesForView(b,'powerNodes'));}catch(e){}
      if(__alignCancelled()){try{routeAutoAlignFinishStatus('Public Power Check cancelled','Stopped before drawing reference overlay.');}catch(e){status('Public Power Check cancelled.');}try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(e){}return;}
      try{features=features.concat(await routeFetchOsmFeaturesForView(b,'powerWays'));}catch(e){}
      if(__alignCancelled()){try{routeAutoAlignFinishStatus('Public Power Check cancelled','Stopped before drawing reference overlay.');}catch(e){status('Public Power Check cancelled.');}try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(e){}return;}
      features=annotatePublicFeatures(features,boundsForFeatures(features)||b);
      const matched=[],unmatched=[];
      features.forEach(f=>{if(!f||!Array.isArray(f.pts)||!f.pts.length)return;const m=f.__jsonMatch||f?.meta?.jsonMatch||null;(m?matched:unmatched).push({f,m});});
      matched.sort((a,b)=>(Number(a.m?.distance)||99999)-(Number(b.m?.distance)||99999));
      const pointByAsset=new Map(),lineItems=[];
      for(const item of matched){
        const f=item.f,m=item.m;
        if(f.pts.length===1){
          const key=String(Number.isInteger(Number(m.index))?m.index:(m.assetId||m.title||''));
          const old=pointByAsset.get(key);
          if(!old||Number(m.distance)<Number(old.m.distance))pointByAsset.set(key,item);
        }else lineItems.push(item);
      }
      let nodeCount=0,lineCount=0,unmatchedCount=0;
      Array.from(pointByAsset.values()).slice(0,PUBLIC_MAX_MATCHED_POINTS).forEach(item=>{if(drawPublicFeature(item.f,item.m))nodeCount++;});
      lineItems.slice(0,PUBLIC_MAX_MATCHED_LINES).forEach(item=>{if(drawPublicFeature(item.f,item.m))lineCount++;});
      if(nodeCount+lineCount===0){
        unmatched.slice(0,PUBLIC_MAX_UNMATCHED_SAMPLE).forEach(item=>{if(drawPublicFeature(item.f,null)){if(item.f.pts.length===1)nodeCount++; else lineCount++; unmatchedCount++;}});
      }
      try{window.fieldMapApplyCleanDotSystem?.();}catch(e){}
      const matchCount=pointByAsset.size+lineItems.length;
      const shown=nodeCount+lineCount;
      const detail=matchCount?`${matchCount.toLocaleString()} JSON match${matchCount===1?'':'es'} found | ${shown.toLocaleString()} reference item${shown===1?'':'s'} shown | public power remains reference only`:`No JSON matches found. ${unmatchedCount?`${unmatchedCount} sample public reference item${unmatchedCount===1?'':'s'} shown.`:'No public power features returned for this view.'}`;
      try{routeAutoAlignFinishStatus('Public Power Check complete',detail);}catch(e){status('Public Power Check complete. '+detail);}
      try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(e){}
    }catch(e){
      try{routeAutoAlignFinishStatus('Public Power Check failed',String(e&&e.message||e||'lookup unavailable'));}catch(_){status('Public Power Check failed.');}
      try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(_e){}
    }
  };

  window.runToolAction=function(id,ev){
    try{ev?.preventDefault?.();ev?.stopPropagation?.();}catch(e){}
    if(id==='autoCorrection')id='autoAlign';
    try{
      if(id==='viewArea')return viewCurrentMapArea();
      if(id==='clear')return clearSelected();
      if(id==='filter')return openFilter();
      if(id==='corrections')return openDataCorrections();
      if(id==='autoAlign')return window.runJsonOnlyAutoAlign();
      if(id==='publicPowerCheck')return window.runPublicPowerCheck();
      if(id==='crossings'){toggleLineCrossings();refreshMapControlState?.();return;}
      if(id==='displayAll')return openDisplayAllMenu();
      if(id==='measure')return toggleMeasureTool();
      if(id==='multi')return toggleMultiMeasureTool();
      if(id==='radius')return toggleRadiusLines();
      if(id==='poi')return openPOIAtGPS();
      if(id==='breadcrumb')return toggleBreadcrumbs();
      if(id==='patrol')return togglePatrolOverlayFromMenu(ev||window.event);
    }catch(e){alert('Tool failed: '+(e.message||e));}
    return false;
  };

  window.openEstimateReviewSheet=function(){
    let sheet=document.getElementById('estimateReviewSheet');
    if(!sheet){sheet=document.createElement('div');sheet.id='estimateReviewSheet';sheet.className='estimate-review-sheet';document.body.appendChild(sheet);}
    sheet.innerHTML=`
      <div class="estimate-review-card split-estimate-review">
        <div class="estimate-review-head"><div><b>Estimate Review</b><span>Auto Align uses imported JSON only. Public Power Check is a separate reference overlay.</span></div><button onclick="closeEstimateReviewSheet()">×</button></div>
        <div class="estimate-review-section-title">Map layer for checking</div>
        <div class="estimate-review-grid">
          <button onclick="setBaseMapLayer('google_hybrid')"><b>Google Hybrid</b><span>Satellite + labels</span></button>
          <button onclick="setBaseMapLayer('google_satellite')"><b>Google Sat</b><span>Clear aerial view</span></button>
          <button onclick="setBaseMapLayer('street')"><b>Street</b><span>Roads / symbols</span></button>
          <button onclick="setBaseMapLayer('humanitarian')"><b>Detailed</b><span>More local features</span></button>
        </div>
        <div class="estimate-review-section-title">Corrections</div>
        <div class="estimate-review-actions">
          <button class="green" onclick="runJsonOnlyAutoAlign()">Auto Align JSON estimates</button>
          <button class="secondary" onclick="runPublicPowerCheck()">Public Power Check</button>
          <button class="secondary" onclick="routeClearAutoAlignSavedChecks?.()">Clear saved checks</button>
          <button class="clay" onclick="routeClearPublicPowerDebug()">Clear public overlay</button>
        </div>
        <div id="estimateReviewProgress" class="estimate-review-progress"></div>
        <div class="estimate-review-help"><b>Auto Align:</b> moves current estimates using your imported JSON route anchors only. <b>Public Power Check:</b> shows external reference matches only and does not create or move assets.</div>
        <div class="estimate-review-section-title">Dot visibility</div>
        <div class="estimate-review-toggles">
          <label><input type="checkbox" data-review-toggle="trueGps" ${mapToggleSettings.trueGps!==false?'checked':''}> Blue true GPS dots</label>
          <label><input type="checkbox" data-review-toggle="noGpsEstimates" ${mapToggleSettings.noGpsEstimates!==false?'checked':''}> Yellow no-GPS source estimates</label>
          <label><input type="checkbox" data-review-toggle="gapEstimates" ${mapToggleSettings.gapEstimates!==false?'checked':''}> Orange missing-number estimates</label>
          <label><input type="checkbox" data-review-toggle="lines" ${mapToggleSettings.lines!==false?'checked':''}> Route/path lines</label>
        </div>
        <div class="estimate-review-section-title">Correct selected estimate</div>
        <div class="estimate-review-actions">
          <button class="green" onclick="routeEstimateMoveSelectedToCentre()">Move selected to map centre</button>
          <button class="secondary" onclick="routeEstimateArmMoveSelected()">Tap map to move selected</button>
          <button class="clay" onclick="routeEstimateHideSelected()">Hide selected estimate</button>
          <button class="secondary" onclick="routeEstimateResetSelected()">Reset selected</button>
        </div>
      </div>`;
    sheet.classList.add('show');
    sheet.querySelectorAll('[data-review-toggle]').forEach(el=>{
      el.addEventListener('change',()=>{
        const key=el.dataset.reviewToggle;
        mapToggleSettings[key]=!!el.checked;
        try{persistDisplayAndMapSettings?.();applyMapToggleSettings?.();}catch(e){}
        status((el.checked?'Showing ':'Hiding ')+el.parentElement.textContent.trim());
      });
    });
    try{closePlus?.();}catch(e){}
  };

  function injectCss(){
    if(document.getElementById('field-map-v401-css'))return;
    const s=document.createElement('style');s.id='field-map-v401-css';
    s.textContent=`
      .field-map-v401-controls .premium-action-card[data-action-id="autoAlign"]{border-color:rgba(46,125,246,.35)}
      .field-map-v401-controls .premium-action-card[data-action-id="publicPowerCheck"]{border-color:rgba(124,44,255,.35)}
      .split-public-check{min-width:210px;display:grid;gap:6px}.split-public-check .source-pill{display:inline-flex;width:max-content;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:900}.split-public-check .source-pill.public{background:#ede9ff;color:#2e1065;border:1px solid #8b5cf6}.split-public-check button{width:100%;margin-top:4px}.split-estimate-review .estimate-review-help{line-height:1.35}`;
    document.head.appendChild(s);
  }

  function boot(){
    injectCss();
    patchToolActions();
    migrateLayout();
    try{renderMapMenu?.();}catch(e){}
    try{renderToolLayoutSettings?.();}catch(e){}
    try{renderCustomPlusGrid?.();}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80));
  else setTimeout(boot,80);
})();


/* ---- js/features/field-map-fixes-v402.js ---- */
/* Field MAP v4.0.2 Guided Align
   - Adds Guided Align as a third correction mode.
   - Auto Align remains JSON-only.
   - Guided Align uses public power only as a shape guide between two confirmed JSON anchors.
   - Public Power Check remains reference-only and never creates/moves assets.
*/
(function(){
  'use strict';

  const VERSION='4.0.2-guided-align';
  const CONTROL_STORAGE_KEY='asset_tracker_v385_tool_layout_controls';
  const V402_MIGRATION_KEY='field_map_v402_guided_align_migrated';
  const CONTROL_MAX=7;
  const CONTROL_DEFAULT=['viewArea','clear','corrections','autoAlign','guidedAlign','publicPowerCheck','crossings'];
  const GUIDE_ANCHOR_MAX_M=1200;
  const GUIDE_SEGMENT_PAD_MIN_M=1000;
  const GUIDE_SEGMENT_PAD_MAX_M=2800;
  const GUIDE_NODE_CORRIDOR_MAX_M=420;

  function status(msg){try{showToolStatus?.(String(msg||''));}catch(e){}}
  function html(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function clean(s){return String(s||'').replace(/_/g,' ').replace(/\s+/g,' ').trim();}
  function compact(s){try{return compactSearch(s);}catch(e){return String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,'');}}
  function cleanLine(s){s=clean(s);try{s=canonicalRouteName(s)||s;}catch(e){}return s;}
  function badLine(s){const k=String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');return !k||['unknown','publicpower','powervertex','powerwayvertex','powernode','powersynthetic','power','wayvertex','noline','nolinenameline'].includes(k);}
  function getLineSafe(r){try{return cleanLine(getLine(r)||r?.__line||'');}catch(e){return cleanLine(r?.__line||'');}}
  function lineOfDp(dp,group){let l='';try{l=getLineSafe(dp?.r||{});}catch(e){} if(badLine(l)&&group&&group.name)l=cleanLine(group.name); try{if(badLine(l)&&window.routeLastSingleName)l=cleanLine(window.routeLastSingleName);}catch(e){} return badLine(l)?'Unknown':l;}
  function gpsOk(lat,lng){lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;}
  function point(dp){return dp&&gpsOk(dp.lat,dp.lng)?{lat:Number(dp.lat),lng:Number(dp.lng)}:null;}
  function routeHasCoord(dp){try{return routeDisplayHasCoord(dp);}catch(e){return !!point(dp);}}
  function distM(a,b,c,d){
    try{if(typeof distanceMeters==='function')return distanceMeters(Number(a),Number(b),Number(c),Number(d));}catch(e){}
    const R=6371000,p1=Number(a)*Math.PI/180,p2=Number(c)*Math.PI/180,dp=(Number(c)-Number(a))*Math.PI/180,dl=(Number(d)-Number(b))*Math.PI/180;
    const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  }
  function dPts(a,b){if(!a||!b)return Infinity;return distM(a.lat,a.lng,b.lat,b.lng);}
  function plateNum(dp){const n=Number(dp&&dp.plate);return Number.isFinite(n)?n:null;}
  function sourceOrderNum(dp){const n=Number(dp&&dp.sourceOrder);return Number.isFinite(n)?n:null;}
  function orderValue(dp){const p=plateNum(dp); if(p!==null)return p; const s=sourceOrderNum(dp); if(s!==null)return s; return 0;}
  function keyOf(dp){try{return routeEstimateKey(dp);}catch(e){return dp&&dp._key||'';}}
  function routeKeyOf(dp){try{return keyOf(dp)||compact(getLineSafe(dp?.r||{}))+':'+String(plateNum(dp)??sourceOrderNum(dp)??'');}catch(e){return '';}}

  function actionList(){
    return [
      {id:'viewArea',label:'View Area',short:'View Area',sub:'Assets in window',style:'primary',toolClass:'green',icon:'▣'},
      {id:'clear',label:'Clear',short:'Clear',sub:'Remove markers',style:'amber',toolClass:'sun',icon:'⌫'},
      {id:'corrections',label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete assets',style:'primary',toolClass:'green',icon:'✎'},
      {id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON straight estimates',style:'teal',toolClass:'teal',icon:'⌁'},
      {id:'guidedAlign',label:'Guided Align',short:'Guided Align',sub:'Public path guide',style:'purple',toolClass:'purple',icon:'〰'},
      {id:'publicPowerCheck',label:'Public Power Check',short:'Public Power',sub:'Reference check only',style:'purple',toolClass:'purple',icon:'⌘'},
      {id:'crossings',label:'Crossings',short:'Crossings',sub:'Red crossing zones',style:'amber',toolClass:'sun',icon:'✕'},
      {id:'filter',label:'Filter',short:'Filter',sub:'Layer toggles',style:'teal',toolClass:'teal',icon:'◉'},
      {id:'displayAll',label:'Display All',short:'Display All',sub:'Asset groups',style:'danger',toolClass:'redbtn',icon:'☷'},
      {id:'measure',label:'Measure',short:'Measure',sub:'Two point measure',style:'brown',toolClass:'brown',icon:'↔'},
      {id:'multi',label:'Multi Measure',short:'Multi',sub:'Measure a path',style:'brown',toolClass:'brown',icon:'⌁'},
      {id:'radius',label:'3 km Radius',short:'3 km',sub:'Nearby assets',style:'primary',toolClass:'green',icon:'◎'},
      {id:'poi',label:'POI',short:'POI',sub:'Save current GPS',style:'amber',toolClass:'sun',icon:'◆'},
      {id:'breadcrumb',label:'Breadcrumb',short:'Breadcrumb',sub:'GPS trail',style:'teal',toolClass:'teal',icon:'⋯'},
      {id:'patrol',label:'Patrol',short:'Patrol',sub:'GPS overlay',style:'primary',toolClass:'purple',icon:'⌖'}
    ];
  }
  function actionById(id){return actionList().find(a=>a.id===id);}
  function normalId(id){id=String(id||''); if(id==='autoCorrection')return 'autoAlign'; return id;}
  function cleanControls(ids){
    const valid=new Set(actionList().map(a=>a.id));
    const mapped=[];
    (Array.isArray(ids)?ids:[]).forEach(raw=>{const id=normalId(raw); if(valid.has(id)&&!mapped.includes(id)&&mapped.length<CONTROL_MAX)mapped.push(id);});
    if(mapped.includes('autoAlign')&&!mapped.includes('guidedAlign')&&mapped.length<CONTROL_MAX){mapped.splice(mapped.indexOf('autoAlign')+1,0,'guidedAlign');}
    CONTROL_DEFAULT.forEach(id=>{if(!mapped.includes(id)&&mapped.length<CONTROL_MAX)mapped.push(id);});
    return mapped.slice(0,CONTROL_MAX);
  }
  function migrateLayout(){
    try{
      if(localStorage.getItem(V402_MIGRATION_KEY)==='1')return;
      const old=JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null');
      localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(cleanControls(old&&old.length?old:CONTROL_DEFAULT)));
      localStorage.setItem(V402_MIGRATION_KEY,'1');
    }catch(e){try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(CONTROL_DEFAULT));localStorage.setItem(V402_MIGRATION_KEY,'1');}catch(_){}}
  }
  function patchToolActions(){
    try{
      if(typeof TOOL_ACTIONS!=='undefined'&&Array.isArray(TOOL_ACTIONS)){
        const byId=new Map(TOOL_ACTIONS.map((a,i)=>[a.id,{a,i}]));
        const corr=byId.get('corrections');
        if(corr)Object.assign(corr.a,{label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete assets',style:'primary',toolClass:'green',icon:'✎'});
        const old=byId.get('autoCorrection');
        if(old)Object.assign(old.a,{id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON straight estimates',style:'teal',toolClass:'teal',icon:'⌁'});
        if(!TOOL_ACTIONS.some(a=>a.id==='autoAlign')){
          const i=Math.max(0,(TOOL_ACTIONS.findIndex(a=>a.id==='corrections')+1)||3);
          TOOL_ACTIONS.splice(i,0,{id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON straight estimates',style:'teal',toolClass:'teal',icon:'⌁'});
        }
        if(!TOOL_ACTIONS.some(a=>a.id==='guidedAlign')){
          const i=Math.max(0,(TOOL_ACTIONS.findIndex(a=>a.id==='autoAlign')+1)||4);
          TOOL_ACTIONS.splice(i,0,{id:'guidedAlign',label:'Guided Align',short:'Guided Align',sub:'Public path guide',style:'purple',toolClass:'purple',icon:'〰'});
        }
        if(!TOOL_ACTIONS.some(a=>a.id==='publicPowerCheck')){
          const i=Math.max(0,(TOOL_ACTIONS.findIndex(a=>a.id==='guidedAlign')+1)||5);
          TOOL_ACTIONS.splice(i,0,{id:'publicPowerCheck',label:'Public Power Check',short:'Public Power',sub:'Reference check only',style:'purple',toolClass:'purple',icon:'⌘'});
        }
      }
    }catch(e){}
  }

  window.getToolLayoutControls=function(){migrateLayout();try{return cleanControls(JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null'));}catch(e){return CONTROL_DEFAULT.slice();}};
  window.saveToolLayoutControls=function(ids){
    const clean=cleanControls(ids);
    try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(clean));}catch(e){}
    try{renderToolLayoutSettings?.();}catch(e){}
    try{if(document.getElementById('drawer')?.classList.contains('open')&&document.getElementById('dTitle')?.textContent==='Map')renderMapMenu();}catch(e){}
    try{renderCustomPlusGrid?.();}catch(e){}
    try{refreshCustomToolActiveStates?.();}catch(e){}
  };
  window.resetToolLayoutControls=function(){window.saveToolLayoutControls(CONTROL_DEFAULT.slice());status('Button layout reset with Auto Align, Guided Align, Public Power Check and Crossings.');};
  window.toggleToolLayoutButton=function(id){id=normalId(id);const cur=window.getToolLayoutControls();if(cur.includes(id)){window.saveToolLayoutControls(cur.filter(x=>x!==id));return;}if(cur.length>=CONTROL_MAX){alert('Map Controls can hold '+CONTROL_MAX+' buttons. Move one back to Map Tools first.');return;}window.saveToolLayoutControls([...cur,id]);};
  window.moveToolLayoutButton=function(id,dir){id=normalId(id);const cur=window.getToolLayoutControls();const i=cur.indexOf(id),j=i+dir;if(i<0||j<0||j>=cur.length)return;[cur[i],cur[j]]=[cur[j],cur[i]];window.saveToolLayoutControls(cur);};

  function buttonHTML(a){
    const subId=a.id==='crossings'?' id="lineCrossingsSub"':'';
    const activeIds=['measure','multi','radius','breadcrumb','crossings','patrol'];
    const dataTool=activeIds.includes(a.id)?` data-tool="${a.id}"`:'';
    return `<button type="button" class="premium-action-card ${a.style}" data-action-id="${a.id}"${dataTool} onclick="return runToolAction('${a.id}',event)"><i>${a.icon}</i><b>${html(a.label)}</b><span${subId}>${html(a.sub)}</span></button>`;
  }
  window.renderMapMenu=function(){
    patchToolActions();
    const controls=window.getToolLayoutControls();
    const cards=controls.map(id=>actionById(id)).filter(Boolean).map(buttonHTML).join('');
    try{head('Map','Controls');body().innerHTML=`<div class="premium-map-menu compact-map-controls custom-map-controls field-map-fixed-controls field-map-v402-controls"><div class="compact-control-grid custom-control-grid seven-control-grid">${cards}</div><button type="button" class="layout-link-btn" onclick="openSettingsSectionFromMapTools()">Button layout</button></div>`;}catch(e){}
    try{refreshCustomToolActiveStates?.();refreshMapControlState?.();}catch(e){}
  };
  window.renderCustomPlusGrid=function(){
    const grid=document.querySelector('#plusSheet .plus-grid');
    if(!grid)return;
    const controls=window.getToolLayoutControls();
    const tools=actionList().filter(a=>!controls.includes(a.id));
    grid.innerHTML=tools.map(a=>{const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${a.id}"`:'';return `<button type="button" class="${a.toolClass||'green'} tool-btn"${dataTool} onclick="runToolAction('${a.id}',event);closePlus()"><span class="tool-emoji">${a.icon}</span>${html(a.short||a.label)}</button>`;}).join('')||'<div class="tool-layout-empty">All quick buttons are in Map Controls.</div>';
    const title=document.querySelector('#plusSheet .plus-title'); if(title)title.textContent='+ Map Tools';
    try{refreshCustomToolActiveStates?.();}catch(e){}
  };
  window.renderToolLayoutSettings=function(){
    const box=document.getElementById('toolLayoutSettings'); if(!box)return;
    const controls=window.getToolLayoutControls();
    const controlRows=controls.map((id,i)=>actionById(id)).filter(Boolean).map((a,i)=>`<div class="tool-layout-row in-controls"><div class="tool-layout-order">${i+1}</div><div class="tool-layout-name"><b>${html(a.label)}</b><span>${html(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" onclick="moveToolLayoutButton('${a.id}',-1)" ${i===0?'disabled':''}>Up</button><button type="button" onclick="moveToolLayoutButton('${a.id}',1)" ${i===controls.length-1?'disabled':''}>Down</button><button type="button" class="secondary" onclick="toggleToolLayoutButton('${a.id}')">To Tools</button></div></div>`).join('');
    const toolRows=actionList().filter(a=>!controls.includes(a.id)).map(a=>`<div class="tool-layout-row in-tools"><div class="tool-layout-order">+</div><div class="tool-layout-name"><b>${html(a.label)}</b><span>${html(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" class="green" onclick="toggleToolLayoutButton('${a.id}')" ${controls.length>=CONTROL_MAX?'disabled':''}>To Controls</button></div></div>`).join('');
    box.innerHTML=`<div class="tool-layout-panel clearer-tool-layout"><div class="tool-layout-summary"><b>${controls.length}/${CONTROL_MAX} in Map Controls</b><span>Auto Align is JSON-only. Guided Align uses public power as a path guide only. Public Power Check is reference-only.</span></div><h4>Shown in Map Controls</h4><div class="tool-layout-list">${controlRows||'<div class="help">No controls selected.</div>'}</div><h4>Left in Map Tools</h4><div class="tool-layout-list">${toolRows||'<div class="help">No extra tools.</div>'}</div><div class="actions"><button type="button" class="secondary" onclick="resetToolLayoutControls()">Reset guided default</button></div></div>`;
  };

  function boundsFromPoints(points,padMeters){
    const pts=(points||[]).filter(p=>p&&gpsOk(p.lat,p.lng));
    if(!pts.length)return null;
    let minLat=Infinity,maxLat=-Infinity,minLng=Infinity,maxLng=-Infinity;
    pts.forEach(p=>{const lat=Number(p.lat),lng=Number(p.lng);minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);minLng=Math.min(minLng,lng);maxLng=Math.max(maxLng,lng);});
    const midLat=(minLat+maxLat)/2;
    const metres=Math.max(250,Number(padMeters)||1000);
    const dLat=metres/111320;
    const dLng=metres/(111320*Math.max(.18,Math.cos(midLat*Math.PI/180)));
    try{return L.latLngBounds([[minLat-dLat,minLng-dLng],[maxLat+dLat,maxLng+dLng]]);}catch(e){return null;}
  }
  function segmentPointDistance(p,a,b){
    try{if(typeof routeNearestPointOnSegment==='function')return routeNearestPointOnSegment(p,a,b);}catch(e){}
    const origin={lat:p.lat,lng:p.lng};
    const R=6371000,lat0=origin.lat*Math.PI/180;
    const toXY=q=>({x:(q.lng-origin.lng)*Math.PI/180*Math.cos(lat0)*R,y:(q.lat-origin.lat)*Math.PI/180*R});
    const toLL=(x,y)=>({lat:origin.lat+(y/R)*180/Math.PI,lng:origin.lng+(x/(Math.cos(lat0)*R))*180/Math.PI});
    const P=toXY(p),A=toXY(a),B=toXY(b); const dx=B.x-A.x,dy=B.y-A.y,len2=dx*dx+dy*dy;
    const t=Math.max(0,Math.min(1,len2?((P.x-A.x)*dx+(P.y-A.y)*dy)/len2:0));
    const x=A.x+dx*t,y=A.y+dy*t,ll=toLL(x,y); return {lat:ll.lat,lng:ll.lng,d:Math.sqrt((P.x-x)*(P.x-x)+(P.y-y)*(P.y-y)),t};
  }
  function polyStats(pts){
    const cleanPts=(pts||[]).map(p=>({lat:Number(p.lat),lng:Number(p.lng)})).filter(p=>gpsOk(p.lat,p.lng));
    const cum=[0];
    for(let i=1;i<cleanPts.length;i++)cum[i]=cum[i-1]+dPts(cleanPts[i-1],cleanPts[i]);
    return {pts:cleanPts,cum,length:cum[cum.length-1]||0};
  }
  function nearestOnPolyline(p,pts){
    const st=polyStats(pts); if(st.pts.length<2)return null;
    let best=null;
    for(let i=0;i<st.pts.length-1;i++){
      const hit=segmentPointDistance(p,st.pts[i],st.pts[i+1]);
      const segLen=dPts(st.pts[i],st.pts[i+1]);
      const s=st.cum[i]+(Number(hit.t)||0)*segLen;
      if(!best||hit.d<best.d)best={...hit,index:i,t:Number(hit.t)||0,s,length:st.length,pts:st.pts,cum:st.cum};
    }
    return best;
  }
  function pointAtS(pts,s){
    const st=polyStats(pts); if(!st.pts.length)return null; if(st.pts.length===1)return st.pts[0];
    s=Math.max(0,Math.min(st.length,Number(s)||0));
    for(let i=0;i<st.pts.length-1;i++){
      const a=st.pts[i],b=st.pts[i+1],seg=st.cum[i+1]-st.cum[i];
      if(s<=st.cum[i+1]||i===st.pts.length-2){const t=seg?((s-st.cum[i])/seg):0; return {lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t};}
    }
    return st.pts[st.pts.length-1];
  }
  function isPowerWay(f){
    const kind=String(f&&f.meta&&f.meta.kind||''); const tags=f&&f.tags||{};
    return !!(f&&Array.isArray(f.pts)&&f.pts.length>=2&&(kind.startsWith('power')||tags.power||tags.voltage||tags.utility==='power'||tags.line));
  }
  function findAnchorsFor(dp,dps){
    const anchors=(dps||[]).filter(x=>x&&!x.estimated&&routeHasCoord(x));
    if(anchors.length<2)return null;
    const p=plateNum(dp);
    if(p!==null){
      const pa=anchors.filter(x=>plateNum(x)!==null).sort((a,b)=>plateNum(a)-plateNum(b)||((sourceOrderNum(a)||0)-(sourceOrderNum(b)||0)));
      let left=null,right=null;
      for(const a of pa){const ap=plateNum(a); if(ap<p)left=a; if(ap>p){right=a;break;}}
      if(left&&right&&plateNum(right)!==plateNum(left))return {left,right,t:Math.max(0,Math.min(1,(p-plateNum(left))/(plateNum(right)-plateNum(left)))),method:`plate ${p} between ${plateNum(left)} and ${plateNum(right)}`};
    }
    const ordered=(dps||[]).filter(routeHasCoord).sort((a,b)=>orderValue(a)-orderValue(b)||((sourceOrderNum(a)||0)-(sourceOrderNum(b)||0)));
    const k=routeKeyOf(dp);
    const idx=ordered.findIndex(x=>x===dp||(k&&routeKeyOf(x)===k));
    if(idx<0)return null;
    let left=null,right=null,leftIndex=-1,rightIndex=-1;
    for(let i=idx-1;i>=0;i--){if(ordered[i]&&!ordered[i].estimated){left=ordered[i];leftIndex=i;break;}}
    for(let i=idx+1;i<ordered.length;i++){if(ordered[i]&&!ordered[i].estimated){right=ordered[i];rightIndex=i;break;}}
    if(left&&right){
      const so=sourceOrderNum(dp),ls=sourceOrderNum(left),rs=sourceOrderNum(right);
      let t=(so!==null&&ls!==null&&rs!==null&&rs!==ls)?((so-ls)/(rs-ls)):((idx-leftIndex)/(rightIndex-leftIndex));
      t=Math.max(0,Math.min(1,Number.isFinite(t)?t:.5));
      return {left,right,t,method:'between neighbouring JSON anchors'};
    }
    return null;
  }
  function segmentId(seg){return [routeKeyOf(seg.left),routeKeyOf(seg.right)].join('|');}
  function findPowerRailForSegment(seg,features){
    const A=point(seg.left),B=point(seg.right); if(!A||!B)return null;
    const chord=dPts(A,B); const anchorLimit=Math.min(GUIDE_ANCHOR_MAX_M,Math.max(250,chord*.42));
    let best=null;
    (features||[]).filter(isPowerWay).forEach(f=>{
      const a=nearestOnPolyline(A,f.pts),b=nearestOnPolyline(B,f.pts); if(!a||!b)return;
      if(a.d>anchorLimit||b.d>anchorLimit)return;
      const pathLen=Math.abs(b.s-a.s); if(pathLen<Math.max(12,chord*.45)||pathLen>Math.max(900,chord*5.2))return;
      const score=a.d+b.d+Math.abs(pathLen-chord)*.12+(String(f?.meta?.kind||'').startsWith('power')?-75:0);
      if(!best||score<best.score)best={type:'way',feature:f,pts:polyStats(f.pts).pts,startS:a.s,endS:b.s,dA:a.d,dB:b.d,pathLen,score};
    });
    if(best)return best;

    const nodes=[];
    (features||[]).forEach(f=>{
      if(!f||!Array.isArray(f.pts)||f.pts.length!==1)return;
      const pt=f.pts[0]; if(!gpsOk(pt.lat,pt.lng))return;
      const on=segmentPointDistance(pt,A,B); const along=Number(on.t)||0;
      if(on.d<=GUIDE_NODE_CORRIDOR_MAX_M&&along>=-.05&&along<=1.05)nodes.push({lat:Number(pt.lat),lng:Number(pt.lng),d:on.d,t:along});
    });
    nodes.sort((a,b)=>a.t-b.t||a.d-b.d);
    const dedup=[]; nodes.forEach(n=>{if(!dedup.some(x=>dPts(x,n)<8))dedup.push(n);});
    if(dedup.length>=1){
      const pts=[A].concat(dedup.map(n=>({lat:n.lat,lng:n.lng}))).concat([B]);
      const st=polyStats(pts);
      if(st.length>=chord*.8&&st.length<=Math.max(900,chord*4.2))return {type:'nodes',pts,startS:0,endS:st.length,dA:0,dB:0,pathLen:st.length,score:9000+dedup.length,feature:null};
    }
    return null;
  }
  async function fetchGuideFeaturesForSegment(seg,estimates){
    const A=point(seg.left),B=point(seg.right); if(!A||!B)return [];
    const pts=[A,B].concat((estimates||[]).map(point).filter(Boolean));
    const chord=dPts(A,B);
    const pad=Math.min(GUIDE_SEGMENT_PAD_MAX_M,Math.max(GUIDE_SEGMENT_PAD_MIN_M,chord*.35));
    const bounds=boundsFromPoints(pts,pad);
    let features=[];
    try{features=features.concat(await routeFetchOsmFeaturesForView(bounds,'powerWays'));}catch(e){}
    try{features=features.concat(await routeFetchOsmFeaturesForView(bounds,'powerNodes'));}catch(e){}
    return features||[];
  }
  function writeGuidedCorrection(key,line,rail,seg,target){
    try{
      const all=routeEstimateCorrections(); if(!all||!key)return;
      all[key]={...(all[key]||{}),lat:Number(target.lat),lng:Number(target.lng),hidden:false,autoAligned:true,alignVersion:(typeof ROUTE_AUTO_ALIGN_VERSION!=='undefined'?ROUTE_AUTO_ALIGN_VERSION:'guided-public-power'),alignKind:'guidedPublicPowerRail',alignSource:'public power guide between JSON anchors',guidedAligned:true,guidedAlignedAt:new Date().toISOString(),guidedMethod:rail.type==='way'?'public power way between JSON anchors':'public power node rail between JSON anchors',publicPowerUsedAs:'guide-only',publicPowerJsonMatch:null,publicPowerKind:null,lineName:line||'Unknown',leftAnchor:plateNum(seg.left)??sourceOrderNum(seg.left)??'',rightAnchor:plateNum(seg.right)??sourceOrderNum(seg.right)??'',pathDistanceM:Math.round(Number(rail.pathLen)||0),anchorDistanceM:Math.round(Math.max(Number(rail.dA)||0,Number(rail.dB)||0))};
      saveRouteEstimateCorrections(all);
    }catch(e){}
  }
  async function runGuidedAlign(){
    try{closeDrawer?.();closePlus?.();closeSettings?.();}catch(e){}
    if(!map){status('Map not ready.');return;}
    let groups=[]; try{groups=(routeLastDisplayGroups||[]).filter(g=>g&&Array.isArray(g.dps)&&g.dps.length);}catch(e){groups=[];}
    if(!groups.length){status('Load a route with estimate dots first. Guided Align needs current route data.');return;}
    const __alignJob=(window.fieldMapStartAlignmentJob?window.fieldMapStartAlignmentJob('Guided Align'):null);
    const __alignCancelled=()=>!!(window.fieldMapAlignmentCancelled&&window.fieldMapAlignmentCancelled(__alignJob));
    try{routeAutoAlignSetStatus('Guided Align',2,'Preparing JSON anchors. Public power will only guide the path between anchors.');}catch(e){status('Guided Align: preparing.');}

    let total=0,moved=0,segmentsChecked=0,segmentsGuided=0,skippedNoAnchor=0,skippedNoGuide=0,featureCount=0;
    for(const group of groups){
      if(__alignCancelled()){try{routeAutoAlignFinishStatus('Guided Align cancelled',`${moved} estimate${moved===1?'':'s'} moved before cancellation.`);}catch(e){status('Guided Align cancelled.');}try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(e){}return;}
      const line=lineOfDp((group.dps||[])[0],group);
      const estimates=(group.dps||[]).filter(dp=>dp&&dp.estimated&&routeHasCoord(dp));
      total+=estimates.length;
      const bySeg=new Map();
      for(const dp of estimates){
        const seg=findAnchorsFor(dp,group.dps||[]);
        if(!seg){skippedNoAnchor++;continue;}
        const id=segmentId(seg);
        if(!bySeg.has(id))bySeg.set(id,{seg,dps:[]});
        bySeg.get(id).dps.push({dp,t:seg.t});
      }
      const segs=Array.from(bySeg.values());
      for(let i=0;i<segs.length;i++){
        if(__alignCancelled()){try{routeAutoAlignFinishStatus('Guided Align cancelled',`${moved} estimate${moved===1?'':'s'} moved before cancellation.`);}catch(e){status('Guided Align cancelled.');}try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(e){}return;}
        const item=segs[i],seg=item.seg;
        segmentsChecked++;
        try{routeAutoAlignSetStatus('Guided Align',Math.min(96,Math.max(3,Math.floor((segmentsChecked/Math.max(1,segs.length))*90))),`${line||'Unknown'} | section ${i+1} / ${segs.length} | ${moved} moved`);}catch(e){}
        const features=await fetchGuideFeaturesForSegment(seg,item.dps.map(x=>x.dp));
        if(__alignCancelled()){try{routeAutoAlignFinishStatus('Guided Align cancelled',`${moved} estimate${moved===1?'':'s'} moved before cancellation.`);}catch(e){status('Guided Align cancelled.');}try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(e){}return;}
        featureCount+=features.length;
        const rail=findPowerRailForSegment(seg,features);
        if(!rail){skippedNoGuide+=item.dps.length;continue;}
        segmentsGuided++;
        for(const x of item.dps){
          const dp=x.dp; const key=keyOf(dp); if(!key)continue;
          const s=Number(rail.startS)+(Number(rail.endS)-Number(rail.startS))*Math.max(0,Math.min(1,Number(x.t)||0));
          const target=pointAtS(rail.pts,s); if(!target||!gpsOk(target.lat,target.lng))continue;
          const meta={kind:'guidedPublicPowerRail',d:Math.max(Number(rail.dA)||0,Number(rail.dB)||0),source:'public-power-guide-between-json-anchors',method:(rail.type==='way'?'public power way':'public power node rail')+' | '+(seg.method||''),lineName:line||'Unknown',guided:true};
          if(routeEstimateMoveKeyToNoRedraw(key,target.lat,target.lng,meta)){
            try{dp._alignKind='guidedPublicPowerRail';dp.guidedAligned=true;dp._guidedAlignMethod=meta.method;}catch(e){}
            writeGuidedCorrection(key,line,rail,seg,target);
            moved++;
          }
        }
        try{routeRedrawReviewLinesFromGroups?.();applyMapToggleSettings?.();window.fieldMapApplyCleanDotSystem?.();}catch(e){}
        await new Promise(r=>setTimeout(r,20));
        if(__alignCancelled()){try{routeAutoAlignFinishStatus('Guided Align cancelled',`${moved} estimate${moved===1?'':'s'} moved before cancellation.`);}catch(e){status('Guided Align cancelled.');}try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(e){}return;}
      }
    }
    try{routeRedrawReviewLinesFromGroups?.();applyMapToggleSettings?.();window.fieldMapApplyCleanDotSystem?.();fieldMapRefreshSourceStatusClean?.();}catch(e){}
    const detail=`${moved} guided estimate${moved===1?'':'s'} moved | ${segmentsGuided}/${segmentsChecked} sections had a public guide | ${featureCount} public feature${featureCount===1?'':'s'} checked | ${skippedNoAnchor} no JSON anchor | ${skippedNoGuide} no guide`;
    try{routeAutoAlignFinishStatus('Guided Align complete',detail);}catch(e){status('Guided Align complete. '+detail);}
    try{window.fieldMapFinishAlignmentJob?.(__alignJob);}catch(e){}
  }
  window.runGuidedAlign=runGuidedAlign;
  window.routeGuidedAlignEstimates=function(){return runGuidedAlign();};

  window.runToolAction=function(id,ev){
    try{ev?.preventDefault?.();ev?.stopPropagation?.();}catch(e){}
    id=normalId(id);
    try{
      if(id==='viewArea')return viewCurrentMapArea();
      if(id==='clear')return clearSelected();
      if(id==='filter')return openFilter();
      if(id==='corrections')return openDataCorrections();
      if(id==='autoAlign')return window.runJsonOnlyAutoAlign();
      if(id==='guidedAlign')return window.runGuidedAlign();
      if(id==='publicPowerCheck')return window.runPublicPowerCheck();
      if(id==='crossings'){toggleLineCrossings();refreshMapControlState?.();return;}
      if(id==='displayAll')return openDisplayAllMenu();
      if(id==='measure')return toggleMeasureTool();
      if(id==='multi')return toggleMultiMeasureTool();
      if(id==='radius')return toggleRadiusLines();
      if(id==='poi')return openPOIAtGPS();
      if(id==='breadcrumb')return toggleBreadcrumbs();
      if(id==='patrol')return togglePatrolOverlayFromMenu(ev||window.event);
    }catch(e){alert('Tool failed: '+(e.message||e));}
    return false;
  };

  function isGuidedDp(dp){
    try{if(dp&&(dp.guidedAligned||String(dp._alignKind||'').includes('guidedPublicPower')))return true;}catch(e){}
    try{const k=keyOf(dp); const c=k?routeEstimateCorrections()[k]:null; return !!(c&&(c.guidedAligned||String(c.alignKind||'').includes('guidedPublicPower')));}catch(e){return false;}
  }
  function guidedStatusBlock(dp){
    const line=lineOfDp(dp,null);
    return `<div class="field-map-source-status status-guided"><b>GUIDED</b><span>${html(line||'Unknown line')}</span><small>Estimated from your JSON sequence, shaped by public power between confirmed JSON anchors. Public power is guide-only.</small></div>`;
  }
  try{
    const oldApply=routeEstimateApplyCorrection;
    routeEstimateApplyCorrection=function(dp){
      const out=oldApply?oldApply.apply(this,arguments):dp;
      try{const k=keyOf(out);const c=k?routeEstimateCorrections()[k]:null;if(out&&c&&(c.guidedAligned||String(c.alignKind||'').includes('guidedPublicPower'))){out._alignKind='guidedPublicPowerRail';out.guidedAligned=true;out._guidedAlignMethod=c.guidedMethod||'';}}
      catch(e){}
      return out;
    };
  }catch(e){}
  try{
    const oldStyle=routeDisplayMarkerStyle;
    routeDisplayMarkerStyle=function(dp){
      const out=oldStyle?oldStyle.apply(this,arguments):{};
      try{if(isGuidedDp(dp)){out.className=clean((out.className||'')+' field-map-source-guided field-map-status-guided-dot');out.color='#075985';out.fillColor='#7dd3fc';out.weight=Math.max(Number(out.weight)||2.3,2.8);out.fillOpacity=.98;}}
      catch(e){}
      return out;
    };
  }catch(e){}
  try{
    const oldPopup=routeAssetPopupHTML;
    routeAssetPopupHTML=function(index,lat,lng,estimated,dp){
      let h=oldPopup?oldPopup.apply(this,arguments):'';
      try{
        if(estimated&&isGuidedDp(dp)){
          h=String(h).replace(/<div class="field-map-source-status status-estimated">[\s\S]*?<\/div>/,guidedStatusBlock(dp));
          if(!h.includes('status-guided'))h=String(h).replace('<div class="asset-popup-actions">',guidedStatusBlock(dp)+'<div class="asset-popup-actions">');
          h=String(h).replace('Auto-aligned warning dot - not trusted for blue line','Guided estimate — follows public power path between JSON anchors; not source truth');
        }
      }catch(e){}
      return h;
    };
  }catch(e){}

  window.openEstimateReviewSheet=function(){
    let sheet=document.getElementById('estimateReviewSheet');
    if(!sheet){sheet=document.createElement('div');sheet.id='estimateReviewSheet';sheet.className='estimate-review-sheet';document.body.appendChild(sheet);}
    sheet.innerHTML=`
      <div class="estimate-review-card split-estimate-review guided-estimate-review">
        <div class="estimate-review-head"><div><b>Estimate Review</b><span>Choose JSON-only, guided route-shape, or public reference check.</span></div><button onclick="closeEstimateReviewSheet()">×</button></div>
        <div class="estimate-review-section-title">Map layer for checking</div>
        <div class="estimate-review-grid">
          <button onclick="setBaseMapLayer('google_hybrid')"><b>Google Hybrid</b><span>Satellite + labels</span></button>
          <button onclick="setBaseMapLayer('google_satellite')"><b>Google Sat</b><span>Clear aerial view</span></button>
          <button onclick="setBaseMapLayer('street')"><b>Street</b><span>Roads / symbols</span></button>
          <button onclick="setBaseMapLayer('humanitarian')"><b>Detailed</b><span>More local features</span></button>
        </div>
        <div class="estimate-review-section-title">Correction modes</div>
        <div class="estimate-review-actions guided-actions">
          <button class="green" onclick="runJsonOnlyAutoAlign()">Auto Align JSON only</button>
          <button class="secondary guided-btn" onclick="runGuidedAlign()">Guided Align</button>
          <button class="secondary" onclick="runPublicPowerCheck()">Public Power Check</button>
          <button class="secondary" onclick="routeClearAutoAlignSavedChecks?.()">Clear saved checks</button>
          <button class="clay" onclick="routeClearPublicPowerDebug()">Clear public overlay</button>
        </div>
        <div id="estimateReviewProgress" class="estimate-review-progress"></div>
        <div class="estimate-review-help"><b>Auto Align:</b> JSON anchors only, straight fallback. <b>Guided Align:</b> uses public power as a bend/route rail only between two confirmed JSON anchors. <b>Public Power Check:</b> reference overlay only, no asset movement.</div>
        <div class="estimate-review-section-title">Dot visibility</div>
        <div class="estimate-review-toggles">
          <label><input type="checkbox" data-review-toggle="trueGps" ${mapToggleSettings.trueGps!==false?'checked':''}> Blue true GPS dots</label>
          <label><input type="checkbox" data-review-toggle="noGpsEstimates" ${mapToggleSettings.noGpsEstimates!==false?'checked':''}> Yellow no-GPS source estimates</label>
          <label><input type="checkbox" data-review-toggle="gapEstimates" ${mapToggleSettings.gapEstimates!==false?'checked':''}> Orange missing-number estimates</label>
          <label><input type="checkbox" data-review-toggle="lines" ${mapToggleSettings.lines!==false?'checked':''}> Route/path lines</label>
        </div>
        <div class="estimate-review-section-title">Correct selected estimate</div>
        <div class="estimate-review-actions">
          <button class="green" onclick="routeEstimateMoveSelectedToCentre()">Move selected to map centre</button>
          <button class="secondary" onclick="routeEstimateArmMoveSelected()">Tap map to move selected</button>
          <button class="clay" onclick="routeEstimateHideSelected()">Hide selected estimate</button>
          <button class="secondary" onclick="routeEstimateResetSelected()">Reset selected</button>
        </div>
      </div>`;
    sheet.classList.add('show');
    sheet.querySelectorAll('[data-review-toggle]').forEach(el=>{el.addEventListener('change',()=>{const key=el.dataset.reviewToggle;mapToggleSettings[key]=!!el.checked;try{persistDisplayAndMapSettings?.();applyMapToggleSettings?.();}catch(e){}status((el.checked?'Showing ':'Hiding ')+el.parentElement.textContent.trim());});});
    try{closePlus?.();}catch(e){}
  };

  function upgradeSourceHud(){
    try{
      const panel=document.getElementById('fieldMapSourcePanel');
      if(panel&&!panel.querySelector('.source-mini-dot.guided')){
        const ref=Array.from(panel.querySelectorAll('.source-hud-row')).find(r=>/PUBLIC REF/.test(r.textContent||''));
        const row=document.createElement('div');
        row.className='source-hud-row guided-row';
        row.innerHTML='<i class="source-mini-dot guided"></i><b>GUIDED</b><span>JSON estimate shaped by public power between anchors.</span>';
        if(ref)panel.insertBefore(row,ref); else panel.appendChild(row);
      }
      const dots=document.querySelector('.source-dot-row');
      if(dots&&!dots.querySelector('.guided')){
        const i=document.createElement('i');i.className='source-mini-dot guided';
        const pub=dots.querySelector('.public'); if(pub)dots.insertBefore(i,pub); else dots.appendChild(i);
      }
    }catch(e){}
  }
  function injectCss(){
    if(document.getElementById('field-map-v402-css'))return;
    const s=document.createElement('style'); s.id='field-map-v402-css';
    s.textContent=`
      .field-map-v402-controls .premium-action-card[data-action-id="guidedAlign"]{border-color:rgba(14,165,233,.45)}
      .field-map-v402-controls .premium-action-card[data-action-id="guidedAlign"] i{color:#075985}
      .seven-control-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;overflow:visible!important;}
      .source-mini-dot.guided{background:#7dd3fc!important;}
      .field-map-source-status.status-guided{background:#ecfeff;border-color:#0891b2}.field-map-source-status.status-guided b{background:#075985;color:#fff}
      .guided-actions .guided-btn{background:#e0f2fe!important;border-color:#0284c7!important;color:#0c4a6e!important;font-weight:950!important;}
      path.field-map-status-guided-dot{filter:drop-shadow(0 0 3px rgba(14,165,233,.45));}
    `;
    document.head.appendChild(s);
  }

  function boot(){
    injectCss(); patchToolActions(); migrateLayout(); upgradeSourceHud();
    try{renderMapMenu?.();}catch(e){}
    try{renderToolLayoutSettings?.();}catch(e){}
    try{renderCustomPlusGrid?.();}catch(e){}
    setTimeout(upgradeSourceHud,350); setTimeout(upgradeSourceHud,1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,90)); else setTimeout(boot,90);
})();


/* ---- js/features/field-map-fixes-v403.js ---- */
/* Field MAP v4.0.3 Filter + Source HUD controls
   - Restores Filter as a visible Map Controls button.
   - Raises Map Controls capacity to 8 so Filter does not push out Guided Align/Crossings.
   - Adds Source status / Source labels controls inside Filter > Interface.
   - Does not change GPS, import, route, estimate or public-power alignment logic.
*/
(function(){
  'use strict';

  const VERSION='4.0.3-filter-source-status';
  const CONTROL_STORAGE_KEY='asset_tracker_v385_tool_layout_controls';
  const V403_MIGRATION_KEY='field_map_v403_filter_restored_migrated';
  const CONTROL_MAX=8;
  const CONTROL_DEFAULT=['viewArea','filter','clear','corrections','autoAlign','guidedAlign','publicPowerCheck','crossings'];
  const LS_SOURCE_HUD='fieldMap.sourceHud.enabled';
  const LS_SOURCE_LABELS='fieldMap.sourceLabels.closeZoom.enabled';

  function status(msg){try{showToolStatus?.(String(msg||''));}catch(e){}}
  function html(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function actionList(){
    return [
      {id:'viewArea',label:'View Area',short:'View Area',sub:'Assets in window',style:'primary',toolClass:'green',icon:'▣'},
      {id:'filter',label:'Filter',short:'Filter',sub:'Layer toggles',style:'teal',toolClass:'teal',icon:'◉'},
      {id:'clear',label:'Clear',short:'Clear',sub:'Remove markers',style:'amber',toolClass:'sun',icon:'⌫'},
      {id:'corrections',label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete assets',style:'primary',toolClass:'green',icon:'✎'},
      {id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON straight estimates',style:'teal',toolClass:'teal',icon:'⌁'},
      {id:'guidedAlign',label:'Guided Align',short:'Guided Align',sub:'Public path guide',style:'purple',toolClass:'purple',icon:'〰'},
      {id:'publicPowerCheck',label:'Public Power Check',short:'Public Power',sub:'Reference check only',style:'purple',toolClass:'purple',icon:'⌘'},
      {id:'crossings',label:'Crossings',short:'Crossings',sub:'Red crossing zones',style:'amber',toolClass:'sun',icon:'✕'},
      {id:'displayAll',label:'Display All',short:'Display All',sub:'Asset groups',style:'danger',toolClass:'redbtn',icon:'☷'},
      {id:'measure',label:'Measure',short:'Measure',sub:'Two point measure',style:'brown',toolClass:'brown',icon:'↔'},
      {id:'multi',label:'Multi Measure',short:'Multi',sub:'Measure a path',style:'brown',toolClass:'brown',icon:'⌁'},
      {id:'radius',label:'3 km Radius',short:'3 km',sub:'Nearby assets',style:'primary',toolClass:'green',icon:'◎'},
      {id:'poi',label:'POI',short:'POI',sub:'Save current GPS',style:'amber',toolClass:'sun',icon:'◆'},
      {id:'breadcrumb',label:'Breadcrumb',short:'Breadcrumb',sub:'GPS trail',style:'teal',toolClass:'teal',icon:'⋯'},
      {id:'patrol',label:'Patrol',short:'Patrol',sub:'GPS overlay',style:'primary',toolClass:'purple',icon:'⌖'}
    ];
  }
  function actionById(id){return actionList().find(a=>a.id===id);}
  function normalId(id){id=String(id||''); if(id==='autoCorrection')return 'autoAlign'; return id;}

  function cleanControls(ids, opts){
    const valid=new Set(actionList().map(a=>a.id));
    const arr=[];
    (Array.isArray(ids)?ids:[]).forEach(raw=>{
      const id=normalId(raw);
      if(valid.has(id)&&!arr.includes(id)&&arr.length<CONTROL_MAX)arr.push(id);
    });
    if(!arr.length)arr.push(...CONTROL_DEFAULT);
    if(opts&&opts.ensureFilter&&!arr.includes('filter')){
      const viewIndex=arr.indexOf('viewArea');
      const insertAt=viewIndex>=0?viewIndex+1:Math.min(1,arr.length);
      arr.splice(insertAt,0,'filter');
    }
    return arr.slice(0,CONTROL_MAX);
  }

  function migrateLayout(){
    try{
      if(localStorage.getItem(V403_MIGRATION_KEY)==='1')return;
      const old=JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null');
      localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(cleanControls(old&&old.length?old:CONTROL_DEFAULT,{ensureFilter:true})));
      localStorage.setItem(V403_MIGRATION_KEY,'1');
    }catch(e){
      try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(CONTROL_DEFAULT));localStorage.setItem(V403_MIGRATION_KEY,'1');}catch(_){ }
    }
  }

  window.getToolLayoutControls=function(){
    migrateLayout();
    try{return cleanControls(JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null'));}catch(e){return CONTROL_DEFAULT.slice();}
  };
  window.saveToolLayoutControls=function(ids){
    const clean=cleanControls(ids);
    try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(clean));}catch(e){}
    try{renderToolLayoutSettings?.();}catch(e){}
    try{if(document.getElementById('drawer')?.classList.contains('open')&&document.getElementById('dTitle')?.textContent==='Map')renderMapMenu();}catch(e){}
    try{renderCustomPlusGrid?.();}catch(e){}
    try{refreshCustomToolActiveStates?.();}catch(e){}
  };
  window.resetToolLayoutControls=function(){window.saveToolLayoutControls(CONTROL_DEFAULT.slice());status('Button layout reset. Filter is back in Map Controls.');};
  window.toggleToolLayoutButton=function(id){
    id=normalId(id);
    const cur=window.getToolLayoutControls();
    if(cur.includes(id)){window.saveToolLayoutControls(cur.filter(x=>x!==id));return;}
    if(cur.length>=CONTROL_MAX){alert('Map Controls can hold '+CONTROL_MAX+' buttons. Move one back to Map Tools first.');return;}
    window.saveToolLayoutControls([...cur,id]);
  };
  window.moveToolLayoutButton=function(id,dir){
    id=normalId(id);
    const cur=window.getToolLayoutControls();
    const i=cur.indexOf(id),j=i+dir;
    if(i<0||j<0||j>=cur.length)return;
    [cur[i],cur[j]]=[cur[j],cur[i]];
    window.saveToolLayoutControls(cur);
  };

  window.renderToolLayoutSettings=function(){
    const box=document.getElementById('toolLayoutSettings'); if(!box)return;
    const controls=window.getToolLayoutControls();
    const controlRows=controls.map((id,i)=>actionById(id)).filter(Boolean).map((a,i)=>`<div class="tool-layout-row in-controls"><div class="tool-layout-order">${i+1}</div><div class="tool-layout-name"><b>${html(a.label)}</b><span>${html(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" onclick="moveToolLayoutButton('${a.id}',-1)" ${i===0?'disabled':''}>Up</button><button type="button" onclick="moveToolLayoutButton('${a.id}',1)" ${i===controls.length-1?'disabled':''}>Down</button><button type="button" class="secondary" onclick="toggleToolLayoutButton('${a.id}')">To Tools</button></div></div>`).join('');
    const toolRows=actionList().filter(a=>!controls.includes(a.id)).map(a=>`<div class="tool-layout-row in-tools"><div class="tool-layout-order">+</div><div class="tool-layout-name"><b>${html(a.label)}</b><span>${html(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" class="green" onclick="toggleToolLayoutButton('${a.id}')" ${controls.length>=CONTROL_MAX?'disabled':''}>To Controls</button></div></div>`).join('');
    box.innerHTML=`<div class="tool-layout-panel clearer-tool-layout"><div class="tool-layout-summary"><b>${controls.length}/${CONTROL_MAX} in Map Controls</b><span>Filter is available here. Auto Align is JSON-only. Guided Align uses public power as a path guide only.</span></div><h4>Shown in Map Controls</h4><div class="tool-layout-list">${controlRows||'<div class="help">No controls selected.</div>'}</div><h4>Left in Map Tools</h4><div class="tool-layout-list">${toolRows||'<div class="help">No extra tools.</div>'}</div><div class="actions"><button type="button" class="secondary" onclick="resetToolLayoutControls()">Reset default</button></div></div>`;
  };

  function sourceHudEnabled(){
    try{return localStorage.getItem(LS_SOURCE_HUD)!=='0';}catch(e){return true;}
  }
  function sourceLabelsEnabled(){
    try{return localStorage.getItem(LS_SOURCE_LABELS)==='1';}catch(e){return false;}
  }
  function setSourceLabelsEnabled(on){
    try{localStorage.setItem(LS_SOURCE_LABELS,on?'1':'0');}catch(e){}
    try{fieldMapRefreshSourceStatusClean?.();}catch(e){}
  }
  function applySourceHudVisibility(){
    const on=sourceHudEnabled();
    try{document.body.classList.toggle('field-map-source-hud-off',!on);}catch(e){}
    try{
      const hud=document.getElementById('fieldMapSourceHud');
      if(hud){hud.classList.toggle('source-hud-disabled',!on); if(!on)hud.classList.remove('open');}
    }catch(e){}
  }
  window.setFieldMapSourceHudVisible=function(on){
    try{localStorage.setItem(LS_SOURCE_HUD,on?'1':'0');}catch(e){}
    applySourceHudVisibility();
    status(on?'Top source status on.':'Top source status off.');
  };
  window.toggleFieldMapSourceHud=function(){window.setFieldMapSourceHudVisible(!sourceHudEnabled());};

  function injectFilterSourceControls(){
    try{
      if(document.getElementById('showSourceHud'))return;
      const interfaceBox=document.querySelector('#showFab')?.closest('.compact-filter')||document.querySelector('[data-display-toggle="fab"]')?.closest('.compact-filter');
      if(!interfaceBox)return;
      const hudLabel=document.createElement('label');
      hudLabel.className='check-item source-status-filter-toggle';
      hudLabel.innerHTML=`<input type="checkbox" id="showSourceHud" ${sourceHudEnabled()?'checked':''}> Top source status key`;
      interfaceBox.appendChild(hudLabel);
      hudLabel.querySelector('input')?.addEventListener('change',e=>window.setFieldMapSourceHudVisible(!!e.target.checked));

      const labelToggle=document.createElement('label');
      labelToggle.className='check-item source-status-filter-toggle';
      labelToggle.innerHTML=`<input type="checkbox" id="showSourceLabels" ${sourceLabelsEnabled()?'checked':''}> Close-up source labels`;
      interfaceBox.appendChild(labelToggle);
      labelToggle.querySelector('input')?.addEventListener('change',e=>{setSourceLabelsEnabled(!!e.target.checked);status(e.target.checked?'Close-up source labels on.':'Close-up source labels off.');});
    }catch(e){}
  }

  try{
    const oldRenderFilter=window.renderFilter;
    window.renderFilter=function(){
      const r=oldRenderFilter?oldRenderFilter.apply(this,arguments):undefined;
      injectFilterSourceControls();
      applySourceHudVisibility();
      return r;
    };
  }catch(e){}

  function injectCss(){
    if(document.getElementById('field-map-v403-css'))return;
    const s=document.createElement('style');
    s.id='field-map-v403-css';
    s.textContent=`
      body.field-map-source-hud-off #fieldMapSourceHud,
      #fieldMapSourceHud.source-hud-disabled{display:none!important;pointer-events:none!important;}
      .field-map-v402-controls .custom-control-grid,
      .field-map-v403-controls .custom-control-grid{overflow:visible!important;}
      .field-map-v402-controls .premium-action-card[data-action-id="filter"]{border-color:rgba(20,184,166,.45)}
      .source-status-filter-toggle{border-color:rgba(15,118,110,.22)!important;}
      @media (max-height:740px){.seven-control-grid .premium-action-card{min-height:54px!important;padding:8px 8px!important}.seven-control-grid .premium-action-card span{font-size:10px!important}}
    `;
    document.head.appendChild(s);
  }

  function boot(){
    injectCss();
    migrateLayout();
    applySourceHudVisibility();
    try{renderMapMenu?.();}catch(e){}
    try{renderToolLayoutSettings?.();}catch(e){}
    try{renderCustomPlusGrid?.();}catch(e){}
    setTimeout(applySourceHudVisibility,250);
    setTimeout(applySourceHudVisibility,1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,120)); else setTimeout(boot,120);
})();


/* ---- js/features/field-map-fixes-v404.js ---- */
/* Field MAP v4.0.4 - Background-friendly data work.
   Browser/PWA limits still apply: Android/iOS can suspend a killed/backgrounded app.
   This patch prevents app code from stalling on requestAnimationFrame while hidden,
   keeps import/index/save jobs registered, requests wake lock during heavy work,
   and resumes cleanly when the app returns to foreground. */
(function(){
  'use strict';
  const VERSION='4.0.4';
  const STATUS_KEY='field_map_background_work_status_v1';
  const SETTINGS_KEY='field_map_background_work_enabled_v1';
  const PERSIST_KEY='field_map_storage_persist_requested_v1';
  let activeOps=0;
  let wakeLock=null;
  let pulseTimer=null;
  let pillTimer=null;
  const opStack=[];

  function enabled(){
    try{
      const raw=localStorage.getItem(SETTINGS_KEY);
      return raw==null?true:JSON.parse(raw)!==false;
    }catch(e){return true;}
  }
  function esc(s){
    if(typeof window.esc==='function')return window.esc(s);
    return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function setStatus(status){
    const payload={
      version:VERSION,
      enabled:enabled(),
      activeOps,
      hidden:!!document.hidden,
      status:status||'idle',
      ops:opStack.slice(-6),
      updatedAt:new Date().toISOString(),
      heartbeat:Date.now()
    };
    try{localStorage.setItem(STATUS_KEY,JSON.stringify(payload));}catch(e){}
    renderPill(payload);
    return payload;
  }
  function readStatus(){
    try{return JSON.parse(localStorage.getItem(STATUS_KEY)||'null')||null;}catch(e){return null;}
  }
  function latestOpName(){
    const x=opStack[opStack.length-1];
    return x&&x.name?x.name:'Background work';
  }
  function renderPill(status){
    let el=document.getElementById('fieldMapBgWorkPill');
    if(!el){
      el=document.createElement('div');
      el.id='fieldMapBgWorkPill';
      el.style.cssText='position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:99999;max-width:calc(100vw - 34px);padding:10px 14px;border-radius:999px;background:rgba(18,36,24,.94);color:#fff;font:700 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.25);display:none;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      document.body.appendChild(el);
    }
    const active=(status&&status.activeOps>0);
    if(active){
      el.textContent=(document.hidden?'Background: ':'Working: ')+latestOpName();
      el.style.display='block';
      clearTimeout(pillTimer);
    }else{
      if(el.style.display==='block'){
        el.textContent='Background work complete';
        clearTimeout(pillTimer);
        pillTimer=setTimeout(()=>{el.style.display='none';},1800);
      }
    }
  }
  async function requestStoragePersist(){
    try{
      if(localStorage.getItem(PERSIST_KEY)==='1')return;
      if(navigator.storage&&navigator.storage.persist){
        await navigator.storage.persist();
        localStorage.setItem(PERSIST_KEY,'1');
      }
    }catch(e){}
  }
  async function requestWakeLock(){
    if(!enabled()||!activeOps||document.hidden)return;
    try{
      if('wakeLock' in navigator){
        if(!wakeLock){
          wakeLock=await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release',()=>{wakeLock=null;});
        }
      }
    }catch(e){wakeLock=null;}
  }
  async function releaseWakeLock(){
    try{if(wakeLock){const wl=wakeLock;wakeLock=null;await wl.release();}}catch(e){wakeLock=null;}
  }
  function startPulse(){
    if(pulseTimer)return;
    pulseTimer=setInterval(()=>{
      if(activeOps>0){
        setStatus('running');
        requestWakeLock();
        try{navigator.serviceWorker&&navigator.serviceWorker.controller&&navigator.serviceWorker.controller.postMessage({type:'FIELD_MAP_BACKGROUND_HEARTBEAT',version:VERSION,activeOps,op:latestOpName(),ts:Date.now()});}catch(e){}
      }else{
        clearInterval(pulseTimer); pulseTimer=null;
      }
    },5000);
  }
  function beginOp(name,detail){
    if(!enabled())return function(){};
    activeOps++;
    const op={id:Date.now()+'-'+Math.random().toString(16).slice(2),name:name||'Background work',detail:detail||'',startedAt:new Date().toISOString()};
    opStack.push(op);
    requestStoragePersist();
    requestWakeLock();
    startPulse();
    setStatus('running');
    try{document.body.classList.add('field-map-background-work-active');}catch(e){}
    let done=false;
    return function finish(finalStatus){
      if(done)return; done=true;
      activeOps=Math.max(0,activeOps-1);
      const idx=opStack.findIndex(x=>x.id===op.id);
      if(idx>=0)opStack.splice(idx,1);
      setStatus(finalStatus||'idle');
      if(activeOps===0){
        try{document.body.classList.remove('field-map-background-work-active');}catch(e){}
        releaseWakeLock();
      }
    };
  }
  function installSleepFramePatch(){
    const oldSleep=window.sleepFrame;
    window.sleepFrame=function fieldMapSleepFrameBackgroundSafe(){
      return new Promise(resolve=>{
        // requestAnimationFrame is normally paused when the PWA/tab is hidden.
        // The old sleepFrame waited on RAF, so imports/indexing could freeze in background.
        if(document.hidden){
          setTimeout(resolve,35);
          return;
        }
        try{
          requestAnimationFrame(()=>setTimeout(resolve,0));
        }catch(e){
          if(typeof oldSleep==='function'){
            try{oldSleep().then(resolve).catch(()=>setTimeout(resolve,0));return;}catch(_e){}
          }
          setTimeout(resolve,0);
        }
      });
    };
  }
  function wrapAsync(name,label){
    const old=window[name];
    if(typeof old!=='function'||old.__fieldMapBgWrapped)return false;
    const wrapped=async function(){
      const end=beginOp(label||name);
      try{return await old.apply(this,arguments);}
      finally{end('complete');}
    };
    try{Object.defineProperty(wrapped,'name',{value:old.name||name});}catch(e){}
    wrapped.__fieldMapBgWrapped=true;
    wrapped.__fieldMapOriginal=old;
    window[name]=wrapped;
    return true;
  }
  function installWrappers(){
    wrapAsync('loadFilesFrom','Import / load files');
    wrapAsync('restorePersistedRecords','Load saved data');
    wrapAsync('loadRecordsFromIndexedDB','Read local database');
    wrapAsync('saveRecordsToIndexedDB','Save local database');
    wrapAsync('rebuildIndexAsync','Build search index');
    wrapAsync('clearRecordsDB','Clear local database');
  }
  function patchRenderProductionPanel(){
    const old=window.renderProductionPanel;
    if(typeof old!=='function'||old.__fieldMapBgPatched)return;
    window.renderProductionPanel=function(){
      const r=old.apply(this,arguments);
      setTimeout(()=>{
        const host=document.getElementById('productionPanel')||document.getElementById('settingsContent')||document.querySelector('.settings-body');
        if(!host||document.getElementById('backgroundWorkSettingsBlock'))return;
        const st=readStatus();
        const stale=st&&st.heartbeat?(Date.now()-Number(st.heartbeat)):null;
        const block=document.createElement('div');
        block.id='backgroundWorkSettingsBlock';
        block.className='card';
        block.innerHTML=`<h3>Background data work</h3>
          <p class="small">Keeps imports, local saves and indexing moving when the app is hidden. Browser/phone power saving can still suspend a fully backgrounded or killed app.</p>
          <div class="actions">
            <button id="backgroundWorkToggle" class="${enabled()?'green':'secondary'}" type="button">Background work: ${enabled()?'On':'Off'}</button>
          </div>
          <div class="small">Last status: ${esc(st?`${st.status||'idle'} · ${st.activeOps||0} active · ${st.hidden?'hidden':'visible'}`:'none')}${stale!=null?` · heartbeat ${Math.round(stale/1000)}s ago`:''}</div>`;
        host.appendChild(block);
        const btn=block.querySelector('#backgroundWorkToggle');
        if(btn)btn.onclick=()=>{
          try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(!enabled()));}catch(e){}
          if(window.renderProductionPanel)window.renderProductionPanel();
          setStatus('settings changed');
        };
      },0);
      return r;
    };
    window.renderProductionPanel.__fieldMapBgPatched=true;
  }
  function patchSettingsHome(){
    const old=window.renderSettingsStats;
    if(typeof old!=='function'||old.__fieldMapBgPatched)return;
    window.renderSettingsStats=function(){
      const r=old.apply(this,arguments);
      const st=readStatus();
      const target=[...document.querySelectorAll('.settings-kpi,.settings-stat,.stat-row,.settings-row')].find(x=>/Storage used|IndexedDB|Local data/i.test(x.textContent||''));
      // Keep this non-invasive; production panel has the full control.
      if(st&&st.activeOps>0)showToolStatus?.('Background data work running: '+latestOpName());
      return r;
    };
    window.renderSettingsStats.__fieldMapBgPatched=true;
  }
  function installLifecycleHandlers(){
    document.addEventListener('visibilitychange',()=>{
      if(activeOps>0){
        setStatus(document.hidden?'hidden-running':'visible-running');
        if(!document.hidden)requestWakeLock();
      }else setStatus(document.hidden?'hidden':'idle');
    },{passive:true});
    window.addEventListener('pagehide',()=>{setStatus(activeOps>0?'pagehide-running':'pagehide');},{passive:true});
    window.addEventListener('pageshow',()=>{
      setStatus(activeOps>0?'resumed-running':'resumed');
      if(activeOps>0){requestWakeLock();showToolStatus?.('Background data work resumed.');}
    },{passive:true});
  }

  installSleepFramePatch();
  installWrappers();
  installLifecycleHandlers();
  patchRenderProductionPanel();
  patchSettingsHome();
  setStatus('ready');
  window.FieldMapBackgroundWork={
    version:VERSION,
    beginOp,
    status:readStatus,
    enabled,
    setEnabled(v){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(!!v));}catch(e){} setStatus('settings changed');},
    requestWakeLock,
    releaseWakeLock
  };
  setTimeout(()=>{installWrappers();patchRenderProductionPanel();patchSettingsHome();},500);
})();


/* ---- js/features/field-map-fixes-v412.js ---- */
/* Field MAP v4.1.2 Stable Controls + PWA restore
   Fixes missing Map Controls after the clean-base/PWA builds.
   Does not alter route maths, GPS import, Guided Align, Public Power Check, or local data.
*/
(function(){
  'use strict';
  const VERSION='4.1.2-stable-controls';
  const CONTROL_STORAGE_KEY='asset_tracker_v385_tool_layout_controls';
  const MIGRATION_KEY='field_map_v412_controls_restored';
  const CONTROL_MAX=8;
  const CONTROL_DEFAULT=['viewArea','filter','clear','corrections','autoAlign','guidedAlign','publicPowerCheck','crossings'];

  function status(msg){try{showToolStatus?.(String(msg||''));}catch(e){try{console.info('[Field MAP]',msg);}catch(_){}}}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normalId(id){id=String(id||''); if(id==='autoCorrection')return 'autoAlign'; if(id==='poi')return 'note'; return id;}
  function actions(){
    return [
      {id:'viewArea',label:'View Area',short:'View Area',sub:'Records in window',style:'primary',toolClass:'green',icon:'▣'},
      {id:'filter',label:'Filter',short:'Filter',sub:'Layer toggles',style:'teal',toolClass:'teal',icon:'◉'},
      {id:'clear',label:'Clear',short:'Clear',sub:'Remove markers',style:'amber',toolClass:'sun',icon:'⌫'},
      {id:'corrections',label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete records',style:'primary',toolClass:'green',icon:'✎'},
      {id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON straight estimates',style:'teal',toolClass:'teal',icon:'⌁'},
      {id:'guidedAlign',label:'Guided Align',short:'Guided Align',sub:'Public path guide',style:'purple',toolClass:'purple',icon:'〰'},
      {id:'publicPowerCheck',label:'Public Power Check',short:'Public Power',sub:'Reference check only',style:'purple',toolClass:'purple',icon:'⌘'},
      {id:'crossings',label:'Crossings',short:'Crossings',sub:'Red crossing zones',style:'amber',toolClass:'sun',icon:'✕'},
      {id:'displayAll',label:'Display All',short:'Display All',sub:'Record groups',style:'danger',toolClass:'redbtn',icon:'☷'},
      {id:'measure',label:'Measure',short:'Measure',sub:'Two point measure',style:'brown',toolClass:'brown',icon:'↔'},
      {id:'multi',label:'Multi Measure',short:'Multi',sub:'Measure a path',style:'brown',toolClass:'brown',icon:'⌁'},
      {id:'radius',label:'Area Radius',short:'Area',sub:'Nearby points',style:'primary',toolClass:'green',icon:'◎'},
      {id:'note',label:'Note',short:'Note',sub:'Save current GPS',style:'amber',toolClass:'sun',icon:'◆'},
      {id:'breadcrumb',label:'Breadcrumb',short:'Breadcrumb',sub:'GPS trail',style:'teal',toolClass:'teal',icon:'⋯'},
      {id:'patrol',label:'Field',short:'Field',sub:'GPS overlay',style:'primary',toolClass:'purple',icon:'⌖'}
    ];
  }
  function actionById(id){return actions().find(a=>a.id===normalId(id));}
  function cleanControls(ids,forceDefault){
    const valid=new Set(actions().map(a=>a.id));
    const out=[];
    (Array.isArray(ids)?ids:[]).forEach(raw=>{const id=normalId(raw); if(valid.has(id)&&!out.includes(id)&&out.length<CONTROL_MAX)out.push(id);});
    if(forceDefault || out.length<6){return CONTROL_DEFAULT.slice();}
    CONTROL_DEFAULT.forEach(id=>{if(!out.includes(id)&&out.length<CONTROL_MAX)out.push(id);});
    return out.slice(0,CONTROL_MAX);
  }
  function migrateLayout(){
    try{
      if(localStorage.getItem(MIGRATION_KEY)==='1')return;
      localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(CONTROL_DEFAULT));
      localStorage.setItem(MIGRATION_KEY,'1');
      // Allow the v4.0.3 filter migration to re-evaluate cleanly if old storage existed.
      localStorage.setItem('field_map_v403_filter_restored_migrated','1');
    }catch(e){}
  }
  window.getToolLayoutControls=function(){
    migrateLayout();
    try{return cleanControls(JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null'),false);}catch(e){return CONTROL_DEFAULT.slice();}
  };
  window.saveToolLayoutControls=function(ids){
    const clean=cleanControls(ids,false);
    try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(clean));}catch(e){}
    try{window.renderToolLayoutSettings?.();}catch(e){}
    try{if(document.getElementById('drawer')?.classList.contains('open') && /Map/i.test(document.getElementById('dTitle')?.textContent||'')) window.renderMapMenu?.();}catch(e){}
    try{window.renderCustomPlusGrid?.();}catch(e){}
    try{window.refreshCustomToolActiveStates?.();}catch(e){}
  };
  window.resetToolLayoutControls=function(){window.saveToolLayoutControls(CONTROL_DEFAULT.slice());status('Map Controls restored.');};
  window.toggleToolLayoutButton=function(id){
    id=normalId(id);
    const cur=window.getToolLayoutControls();
    if(cur.includes(id)){window.saveToolLayoutControls(cur.filter(x=>x!==id));return;}
    if(cur.length>=CONTROL_MAX){alert('Map Controls can hold '+CONTROL_MAX+' buttons. Move one back to Map Tools first.');return;}
    window.saveToolLayoutControls(cur.concat(id));
  };
  window.moveToolLayoutButton=function(id,dir){
    id=normalId(id);
    const cur=window.getToolLayoutControls();
    const i=cur.indexOf(id), j=i+Number(dir||0);
    if(i<0||j<0||j>=cur.length)return;
    [cur[i],cur[j]]=[cur[j],cur[i]];
    window.saveToolLayoutControls(cur);
  };

  function mapButton(a){
    const subId=a.id==='crossings'?' id="lineCrossingsSub"':'';
    const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${a.id}"`:'';
    return `<button type="button" class="premium-action-card ${esc(a.style)}" data-action-id="${esc(a.id)}"${dataTool} onclick="return runToolAction('${esc(a.id)}',event)"><i>${esc(a.icon)}</i><b>${esc(a.label)}</b><span${subId}>${esc(a.sub)}</span></button>`;
  }
  window.renderMapMenu=function(){
    const controls=window.getToolLayoutControls();
    const html=controls.map(id=>actionById(id)).filter(Boolean).map(mapButton).join('');
    try{head?.('Map','Controls');}catch(e){const t=document.getElementById('dTitle'); if(t)t.textContent='Map'; const s=document.getElementById('dSub'); if(s)s.textContent='Controls';}
    const b=typeof body==='function'?body():document.getElementById('body');
    if(!b)return;
    b.innerHTML=`<div class="premium-map-menu compact-map-controls custom-map-controls field-map-v412-controls"><div class="compact-control-title"><b>Map Controls</b><span>${controls.length}/${CONTROL_MAX} quick buttons selected</span></div><div class="compact-control-grid custom-control-grid">${html}</div><button type="button" class="layout-link-btn" onclick="openSettingsSectionFromMapTools()">Map Controls Layout</button></div>`;
    try{window.refreshCustomToolActiveStates?.();}catch(e){}
    try{window.refreshMapControlState?.();}catch(e){}
  };
  window.openMapMenu=function(){
    try{openDrawer?.('map','tabMap',window.renderMapMenu);return;}catch(e){}
    try{window.renderMapMenu();document.getElementById('drawer')?.classList.add('open');}catch(_e){}
  };
  window.renderCustomPlusGrid=function(){
    const grid=document.querySelector('#plusSheet .plus-grid'); if(!grid)return;
    const controls=window.getToolLayoutControls();
    const tools=actions().filter(a=>!controls.includes(a.id));
    grid.innerHTML=tools.map(a=>{
      const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${a.id}"`:'';
      return `<button type="button" class="${esc(a.toolClass||'green')} tool-btn"${dataTool} onclick="runToolAction('${esc(a.id)}',event);closePlus?.()"><span class="tool-emoji">${esc(a.icon)}</span>${esc(a.short||a.label)}</button>`;
    }).join('') || '<div class="tool-layout-empty">All quick buttons are in Map Controls.</div>';
    const title=document.querySelector('#plusSheet .plus-title'); if(title)title.textContent='+ Map Tools';
    try{window.refreshCustomToolActiveStates?.();}catch(e){}
  };
  window.renderToolLayoutSettings=function(){
    const box=document.getElementById('toolLayoutSettings'); if(!box)return;
    const controls=window.getToolLayoutControls();
    const shown=controls.map((id,i)=>actionById(id)).filter(Boolean).map((a,i)=>`<div class="tool-layout-row in-controls"><div class="tool-layout-order">${i+1}</div><div class="tool-layout-name"><b>${esc(a.label)}</b><span>${esc(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" onclick="moveToolLayoutButton('${esc(a.id)}',-1)" ${i===0?'disabled':''}>Up</button><button type="button" onclick="moveToolLayoutButton('${esc(a.id)}',1)" ${i===controls.length-1?'disabled':''}>Down</button><button type="button" class="secondary" onclick="toggleToolLayoutButton('${esc(a.id)}')">To Tools</button></div></div>`).join('');
    const left=actions().filter(a=>!controls.includes(a.id)).map(a=>`<div class="tool-layout-row in-tools"><div class="tool-layout-order">+</div><div class="tool-layout-name"><b>${esc(a.label)}</b><span>${esc(a.sub)}</span></div><div class="tool-layout-actions"><button type="button" class="green" onclick="toggleToolLayoutButton('${esc(a.id)}')" ${controls.length>=CONTROL_MAX?'disabled':''}>To Controls</button></div></div>`).join('');
    box.innerHTML=`<div class="tool-layout-panel clearer-tool-layout"><div class="tool-layout-summary"><b>${controls.length}/${CONTROL_MAX} in Map Controls</b><span>Filter, Auto Align, Guided Align and Public Power Check are restored.</span></div><h4>Shown in Map Controls</h4><div class="tool-layout-list">${shown||'<div class="help">No controls selected.</div>'}</div><h4>Left in Map Tools</h4><div class="tool-layout-list">${left||'<div class="help">No extra tools.</div>'}</div><div class="actions"><button type="button" class="secondary" onclick="resetToolLayoutControls()">Reset default</button></div></div>`;
  };
  window.openSettingsSectionFromMapTools=function(){
    try{closeDrawer?.();}catch(e){}
    try{if(typeof toggleSettings==='function'&&!document.getElementById('settingsPage')?.classList.contains('open'))toggleSettings();}catch(e){}
    setTimeout(()=>{try{openSettingsSection?.('toolLayout');window.renderToolLayoutSettings();}catch(e){}},80);
  };

  window.runToolAction=function(id,ev){
    id=normalId(id);
    try{ev?.preventDefault?.();ev?.stopPropagation?.();}catch(e){}
    try{
      if(id==='viewArea')return (typeof viewCurrentMapArea==='function'?viewCurrentMapArea():openFilter?.());
      if(id==='filter')return openFilter?.();
      if(id==='clear')return clearSelected?.();
      if(id==='corrections')return openDataCorrections?.();
      if(id==='autoAlign')return (window.runJsonOnlyAutoAlign?window.runJsonOnlyAutoAlign():window.openAutoEstimateCorrection?.());
      if(id==='guidedAlign')return (window.runGuidedAlign?window.runGuidedAlign():status('Guided Align not ready. Load a route first.'));
      if(id==='publicPowerCheck')return (window.runPublicPowerCheck?window.runPublicPowerCheck():status('Public Power Check not ready.'));
      if(id==='crossings'){toggleLineCrossings?.();window.refreshMapControlState?.();return false;}
      if(id==='displayAll')return openDisplayAllMenu?.();
      if(id==='measure')return toggleMeasureTool?.();
      if(id==='multi')return toggleMultiMeasureTool?.();
      if(id==='radius')return toggleRadiusLines?.();
      if(id==='note')return openPOIAtGPS?.();
      if(id==='breadcrumb')return toggleBreadcrumbs?.();
      if(id==='patrol')return togglePatrolOverlayFromMenu?.(ev||window.event);
    }catch(e){alert('Tool failed: '+(e.message||e));}
    return false;
  };

  function patchSettingsText(){
    try{
      document.querySelectorAll('.settings-card b,h3,#settingsTitle').forEach(el=>{
        if(/^Button layout$/i.test((el.textContent||'').trim()))el.textContent='Map Controls Layout';
      });
      document.querySelectorAll('.settings-card small,.tool-layout-summary span').forEach(el=>{
        const t=el.textContent||'';
        if(/Choose the 6 buttons/i.test(t))el.textContent='Choose the 8 buttons shown in Map Controls. Others stay in Map Tools.';
      });
    }catch(e){}
  }
  function patchOpenSettings(){
    const old=window.openSettingsSection;
    if(typeof old==='function'&&!old.__fieldMapV412Wrapped){
      const fn=function(section){const r=old.apply(this,arguments); if(section==='toolLayout')setTimeout(()=>{patchSettingsText();window.renderToolLayoutSettings();},0); return r;};
      fn.__fieldMapV412Wrapped=true;
      window.openSettingsSection=fn;
    }
  }
  function init(){
    migrateLayout(); patchSettingsText(); patchOpenSettings();
    try{window.renderCustomPlusGrid();}catch(e){}
    try{if(document.getElementById('toolLayoutSettings'))window.renderToolLayoutSettings();}catch(e){}
    window.FIELD_MAP_VERSION='4.1.2-stable-controls';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  setTimeout(init,400); setTimeout(init,1600);
})();


/* ---- js/features/field-map-fixes-v413.js ---- */
/* Field MAP v4.1.3 - alignment cancel + cleaner drag layout
   - Adds cancel support for long Guided Align / Public Power Check runs.
   - Renames Area Radius to Proximity Check and Field to Patrol.
   - Adds hold/drag layout management between Map Controls and Map Tools.
*/
(function(){
  'use strict';

  const VERSION='4.1.3-cancel-drag-layout';
  const CONTROL_STORAGE_KEY='asset_tracker_v385_tool_layout_controls';
  const CONTROL_MAX=8;
  const CONTROL_DEFAULT=['viewArea','filter','clear','corrections','autoAlign','guidedAlign','publicPowerCheck','crossings'];
  const DRAG_MIME='application/x-field-map-tool';

  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function status(msg){try{showToolStatus?.(String(msg||''));}catch(e){try{console.info('[Field MAP]',msg);}catch(_){}}}
  function normalId(id){id=String(id||''); if(id==='autoCorrection')return 'autoAlign'; if(id==='poi')return 'note'; if(id==='area')return 'radius'; if(id==='field')return 'patrol'; return id;}
  function actions(){
    return [
      {id:'viewArea',label:'View Area',short:'View Area',sub:'Records in window',style:'primary',toolClass:'green',icon:'▣'},
      {id:'filter',label:'Filter',short:'Filter',sub:'Layer toggles',style:'teal',toolClass:'teal',icon:'◉'},
      {id:'clear',label:'Clear',short:'Clear',sub:'Remove markers',style:'amber',toolClass:'sun',icon:'⌫'},
      {id:'corrections',label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete records',style:'primary',toolClass:'green',icon:'✎'},
      {id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON straight estimates',style:'teal',toolClass:'teal',icon:'⌁'},
      {id:'guidedAlign',label:'Guided Align',short:'Guided Align',sub:'Public path guide',style:'purple',toolClass:'purple',icon:'〰'},
      {id:'publicPowerCheck',label:'Public Power Check',short:'Public Power',sub:'Reference check only',style:'purple',toolClass:'purple',icon:'⌘'},
      {id:'crossings',label:'Crossings',short:'Crossings',sub:'Red crossing zones',style:'amber',toolClass:'sun',icon:'✕'},
      {id:'displayAll',label:'Display All',short:'Display All',sub:'Record groups',style:'danger',toolClass:'redbtn',icon:'☷'},
      {id:'measure',label:'Measure',short:'Measure',sub:'Two point measure',style:'brown',toolClass:'brown',icon:'↔'},
      {id:'multi',label:'Multi Measure',short:'Multi',sub:'Measure a path',style:'brown',toolClass:'brown',icon:'⌁'},
      {id:'radius',label:'Proximity Check',short:'Proximity',sub:'Nearby points',style:'primary',toolClass:'green',icon:'◎'},
      {id:'note',label:'Note',short:'Note',sub:'Save current GPS',style:'amber',toolClass:'sun',icon:'◆'},
      {id:'breadcrumb',label:'Breadcrumb',short:'Breadcrumb',sub:'GPS trail',style:'teal',toolClass:'teal',icon:'⋯'},
      {id:'patrol',label:'Patrol',short:'Patrol',sub:'GPS overlay',style:'primary',toolClass:'purple',icon:'⌖'}
    ];
  }
  function actionById(id){id=normalId(id);return actions().find(a=>a.id===id);}
  function cleanControls(ids,forceDefault){
    const valid=new Set(actions().map(a=>a.id));
    const out=[];
    (Array.isArray(ids)?ids:[]).forEach(raw=>{const id=normalId(raw);if(valid.has(id)&&!out.includes(id)&&out.length<CONTROL_MAX)out.push(id);});
    if(forceDefault||out.length<1)return CONTROL_DEFAULT.slice();
    return out.slice(0,CONTROL_MAX);
  }
  window.getToolLayoutControls=function(){
    try{return cleanControls(JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null'),false);}catch(e){return CONTROL_DEFAULT.slice();}
  };
  window.saveToolLayoutControls=function(ids){
    const clean=cleanControls(ids,false);
    try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(clean));}catch(e){}
    try{window.renderToolLayoutSettings?.();}catch(e){}
    try{if(document.getElementById('drawer')?.classList.contains('open') && /Map/i.test(document.getElementById('dTitle')?.textContent||'')) window.renderMapMenu?.();}catch(e){}
    try{window.renderCustomPlusGrid?.();}catch(e){}
    try{window.refreshCustomToolActiveStates?.();window.refreshMapControlState?.();}catch(e){}
  };
  window.resetToolLayoutControls=function(){window.saveToolLayoutControls(CONTROL_DEFAULT.slice());status('Map Controls reset.');};
  window.toggleToolLayoutButton=function(id){
    id=normalId(id); const cur=window.getToolLayoutControls();
    if(cur.includes(id)){window.saveToolLayoutControls(cur.filter(x=>x!==id));return;}
    if(cur.length>=CONTROL_MAX){alert('Map Controls can hold '+CONTROL_MAX+' buttons. Drag a Map Controls button back to Map Tools, or drop this on top of a control to swap.');return;}
    window.saveToolLayoutControls(cur.concat(id));
  };
  window.moveToolLayoutButton=function(id,dir){
    id=normalId(id); const cur=window.getToolLayoutControls(); const i=cur.indexOf(id),j=i+Number(dir||0);
    if(i<0||j<0||j>=cur.length)return; [cur[i],cur[j]]=[cur[j],cur[i]]; window.saveToolLayoutControls(cur);
  };

  function mapButton(a){
    const subId=a.id==='crossings'?' id="lineCrossingsSub"':'';
    const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${esc(a.id)}"`:'';
    return `<button type="button" class="premium-action-card ${esc(a.style)}" data-action-id="${esc(a.id)}"${dataTool} onclick="return runToolAction('${esc(a.id)}',event)"><i>${esc(a.icon)}</i><b>${esc(a.label)}</b><span${subId}>${esc(a.sub)}</span></button>`;
  }
  window.renderMapMenu=function(){
    const controls=window.getToolLayoutControls();
    const html=controls.map(id=>actionById(id)).filter(Boolean).map(mapButton).join('');
    try{head?.('Map','Controls');}catch(e){const t=document.getElementById('dTitle'); if(t)t.textContent='Map'; const s=document.getElementById('dSub'); if(s)s.textContent='Controls';}
    const b=typeof body==='function'?body():document.getElementById('body'); if(!b)return;
    b.innerHTML=`<div class="premium-map-menu compact-map-controls custom-map-controls field-map-v413-controls"><div class="compact-control-title"><b>Map Controls</b><span>${controls.length}/${CONTROL_MAX} quick buttons selected</span></div><div class="compact-control-grid custom-control-grid">${html}</div><button type="button" class="layout-link-btn" onclick="openSettingsSectionFromMapTools()">Map Controls Layout</button></div>`;
    try{window.refreshCustomToolActiveStates?.();window.refreshMapControlState?.();}catch(e){}
  };
  window.openMapMenu=function(){
    try{openDrawer?.('map','tabMap',window.renderMapMenu);return;}catch(e){}
    try{window.renderMapMenu();document.getElementById('drawer')?.classList.add('open');}catch(_e){}
  };
  window.renderCustomPlusGrid=function(){
    const grid=document.querySelector('#plusSheet .plus-grid'); if(!grid)return;
    const controls=window.getToolLayoutControls();
    const tools=actions().filter(a=>!controls.includes(a.id));
    grid.innerHTML=tools.map(a=>{
      const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${esc(a.id)}"`:'';
      return `<button type="button" class="${esc(a.toolClass||'green')} tool-btn"${dataTool} onclick="runToolAction('${esc(a.id)}',event);closePlus?.()"><span class="tool-emoji">${esc(a.icon)}</span>${esc(a.short||a.label)}</button>`;
    }).join('') || '<div class="tool-layout-empty">All quick buttons are in Map Controls.</div>';
    const title=document.querySelector('#plusSheet .plus-title'); if(title)title.textContent='+ Map Tools';
    try{window.refreshCustomToolActiveStates?.();}catch(e){}
  };

  function rowHTML(a,zone,index,controls){
    const inControls=zone==='controls';
    const disabledToControls=!inControls && controls.length>=CONTROL_MAX;
    const top=inControls&&index===0, bottom=inControls&&index===controls.length-1;
    return `<div class="tool-layout-row fieldmap-drag-row ${inControls?'in-controls':'in-tools'}" data-tool-id="${esc(a.id)}" data-zone="${esc(zone)}" draggable="true" ondragstart="fieldMapLayoutDragStart(event,'${esc(a.id)}','${esc(zone)}')" ondragover="fieldMapLayoutDragOver(event)" ondrop="fieldMapLayoutDrop(event,'${esc(zone)}','${esc(a.id)}')" onpointerdown="fieldMapLayoutPointerDown(event,'${esc(a.id)}','${esc(zone)}')">
      <div class="tool-layout-order drag-handle" title="Hold and drag">☰</div>
      <div class="tool-layout-name"><b>${esc(a.label)}</b><span>${esc(a.sub)}</span></div>
      <div class="tool-layout-actions fieldmap-layout-actions">
        ${inControls?`<button type="button" onclick="event.stopPropagation();moveToolLayoutButton('${esc(a.id)}',-1)" ${top?'disabled':''}>↑</button><button type="button" onclick="event.stopPropagation();moveToolLayoutButton('${esc(a.id)}',1)" ${bottom?'disabled':''}>↓</button><button type="button" class="secondary" onclick="event.stopPropagation();toggleToolLayoutButton('${esc(a.id)}')">To Tools</button>`:`<button type="button" class="green" onclick="event.stopPropagation();toggleToolLayoutButton('${esc(a.id)}')" ${disabledToControls?'disabled':''}>To Controls</button>`}
      </div>
    </div>`;
  }
  window.renderToolLayoutSettings=function(){
    const box=document.getElementById('toolLayoutSettings'); if(!box)return;
    const controls=window.getToolLayoutControls();
    const shown=controls.map((id,i)=>actionById(id)).filter(Boolean).map((a,i)=>rowHTML(a,'controls',i,controls)).join('');
    const left=actions().filter(a=>!controls.includes(a.id)).map((a,i)=>rowHTML(a,'tools',i,controls)).join('');
    box.innerHTML=`<div class="tool-layout-panel clearer-tool-layout fieldmap-layout-drag-panel">
      <div class="tool-layout-summary"><b>${controls.length}/${CONTROL_MAX} in Map Controls</b><span>Hold and drag buttons to reorder. Drag between Map Controls and Map Tools to swap placement.</span></div>
      <div class="fieldmap-layout-drop-grid">
        <section class="fieldmap-drop-zone" data-layout-zone="controls" ondragover="fieldMapLayoutDragOver(event)" ondrop="fieldMapLayoutDrop(event,'controls','')"><h4>Map Controls</h4><p>Shown in the Map Controls drawer.</p><div class="tool-layout-list">${shown||'<div class="help">No controls selected.</div>'}</div></section>
        <section class="fieldmap-drop-zone" data-layout-zone="tools" ondragover="fieldMapLayoutDragOver(event)" ondrop="fieldMapLayoutDrop(event,'tools','')"><h4>Map Tools</h4><p>Held in the + Map Tools panel.</p><div class="tool-layout-list">${left||'<div class="help">No extra tools.</div>'}</div></section>
      </div>
      <div class="actions"><button type="button" class="secondary" onclick="resetToolLayoutControls()">Reset default</button></div>
    </div>`;
  };

  window.fieldMapHandleLayoutDrop=function(id,from,to,beforeId){
    id=normalId(id); from=String(from||''); to=String(to||''); beforeId=normalId(beforeId||'');
    if(!actionById(id)||!['controls','tools'].includes(to))return;
    let controls=window.getToolLayoutControls().map(normalId).filter(Boolean);
    controls=controls.filter((x,i,a)=>a.indexOf(x)===i&&actionById(x));
    const wasIn=controls.includes(id);
    const remove=()=>{controls=controls.filter(x=>x!==id);};
    if(to==='tools'){
      if(wasIn){remove(); window.saveToolLayoutControls(controls); status(actionById(id).label+' moved to Map Tools.');}
      return;
    }
    remove();
    let insertAt=beforeId&&controls.includes(beforeId)?controls.indexOf(beforeId):controls.length;
    if(controls.length<CONTROL_MAX){
      controls.splice(insertAt,0,id);
    }else{
      if(insertAt>=controls.length)insertAt=controls.length-1;
      controls.splice(insertAt,1,id);
    }
    window.saveToolLayoutControls(controls.slice(0,CONTROL_MAX));
    status(actionById(id).label+' moved to Map Controls.');
  };
  window.fieldMapLayoutDragStart=function(ev,id,from){
    try{ev.dataTransfer.setData(DRAG_MIME,JSON.stringify({id:normalId(id),from:String(from||'')}));ev.dataTransfer.effectAllowed='move';}catch(e){}
    try{ev.currentTarget.classList.add('dragging');}catch(e){}
  };
  window.fieldMapLayoutDragOver=function(ev){try{ev.preventDefault();ev.dataTransfer.dropEffect='move';}catch(e){}};
  window.fieldMapLayoutDrop=function(ev,to,beforeId){
    try{ev.preventDefault();ev.stopPropagation();}catch(e){}
    let data=null;
    try{data=JSON.parse(ev.dataTransfer.getData(DRAG_MIME)||'null');}catch(e){data=null;}
    if(data&&data.id)window.fieldMapHandleLayoutDrop(data.id,data.from,to,beforeId||'');
  };

  let pointerDrag=null;
  function clearPointerDrag(){
    if(pointerDrag){try{clearTimeout(pointerDrag.timer);}catch(e){} try{document.body.classList.remove('fieldmap-layout-dragging');}catch(e){} }
    pointerDrag=null;
    document.removeEventListener('pointermove',onPointerMove,true);
    document.removeEventListener('pointerup',onPointerUp,true);
    document.removeEventListener('pointercancel',onPointerUp,true);
  }
  function zoneFromPoint(x,y){return document.elementFromPoint(x,y)?.closest?.('[data-layout-zone]')||null;}
  function rowFromPoint(x,y){return document.elementFromPoint(x,y)?.closest?.('[data-tool-id]')||null;}
  function onPointerMove(ev){
    if(!pointerDrag)return;
    const dx=Math.abs(ev.clientX-pointerDrag.x),dy=Math.abs(ev.clientY-pointerDrag.y);
    if(!pointerDrag.active && (dx>14||dy>14)){/* allow normal scroll until long press activates */}
    if(pointerDrag.active){
      try{ev.preventDefault();ev.stopPropagation();}catch(e){}
      document.querySelectorAll('.fieldmap-drop-zone.drop-hover').forEach(el=>el.classList.remove('drop-hover'));
      const zone=zoneFromPoint(ev.clientX,ev.clientY); if(zone)zone.classList.add('drop-hover');
    }
  }
  function onPointerUp(ev){
    if(pointerDrag&&pointerDrag.active){
      try{ev.preventDefault();ev.stopPropagation();}catch(e){}
      const zone=zoneFromPoint(ev.clientX,ev.clientY);
      const row=rowFromPoint(ev.clientX,ev.clientY);
      const to=zone?.getAttribute('data-layout-zone')||row?.getAttribute('data-zone')||pointerDrag.from;
      const before=row&&row.getAttribute('data-tool-id')!==pointerDrag.id?row.getAttribute('data-tool-id'):'';
      window.fieldMapHandleLayoutDrop(pointerDrag.id,pointerDrag.from,to,before);
    }
    clearPointerDrag();
  }
  window.fieldMapLayoutPointerDown=function(ev,id,from){
    if(ev.button!=null&&ev.button!==0)return;
    if(ev.target&&String(ev.target.tagName||'').toLowerCase()==='button')return;
    clearPointerDrag();
    pointerDrag={id:normalId(id),from:String(from||''),x:ev.clientX,y:ev.clientY,active:false,timer:null};
    document.addEventListener('pointermove',onPointerMove,true);
    document.addEventListener('pointerup',onPointerUp,true);
    document.addEventListener('pointercancel',onPointerUp,true);
    pointerDrag.timer=setTimeout(()=>{
      if(!pointerDrag)return;
      pointerDrag.active=true;
      try{document.body.classList.add('fieldmap-layout-dragging');ev.currentTarget?.classList?.add('dragging');if(navigator.vibrate)navigator.vibrate(18);}catch(e){}
      status('Drag to Map Controls or Map Tools, then release.');
    },320);
  };

  // Alignment cancellation controls. Modified alignment functions call these checks.
  window.fieldMapStartAlignmentJob=function(name){
    const job={id:Date.now()+Math.random(),name:String(name||'Alignment'),cancelled:false,startedAt:Date.now()};
    window.__fieldMapCurrentAlignmentJob=job;
    return job;
  };
  window.fieldMapCancelCurrentAlignment=function(){
    const job=window.__fieldMapCurrentAlignmentJob;
    if(job){job.cancelled=true; status(job.name+' cancelling…'); try{routeAutoAlignSetStatus(job.name+' cancelling',99,'Stopping after the current fetch/section finishes.');}catch(e){} }
  };
  window.fieldMapAlignmentCancelled=function(job){return !!(job&&job.cancelled||window.__fieldMapCurrentAlignmentJob&&window.__fieldMapCurrentAlignmentJob.cancelled);};
  window.fieldMapFinishAlignmentJob=function(job){if(!job||window.__fieldMapCurrentAlignmentJob===job)window.__fieldMapCurrentAlignmentJob=null;};

  const oldSet=window.routeAutoAlignSetStatus;
  if(typeof oldSet==='function'&&!oldSet.__fieldMapV413Wrapped){
    const wrapped=function(message,pct,details){
      const r=oldSet.apply(this,arguments);
      try{
        const job=window.__fieldMapCurrentAlignmentJob;
        const el=document.getElementById('routeAutoAlignStatus');
        if(el&&job&&!job.cancelled){
          el.classList.add('cancellable');
          if(!el.querySelector('.auto-align-cancel-btn')){
            const btn=document.createElement('button');
            btn.type='button'; btn.className='auto-align-cancel-btn'; btn.textContent='Cancel';
            btn.onclick=function(e){try{e.preventDefault();e.stopPropagation();}catch(_e){} window.fieldMapCancelCurrentAlignment();};
            el.appendChild(btn);
          }
        }
      }catch(e){}
      return r;
    };
    wrapped.__fieldMapV413Wrapped=true;
    window.routeAutoAlignSetStatus=wrapped;
  }

  const oldRunJson=window.runJsonOnlyAutoAlign;
  if(typeof oldRunJson==='function'&&!oldRunJson.__fieldMapV413Wrapped){
    const wrapped=function(){
      const job=window.fieldMapStartAlignmentJob('Auto Align');
      try{return oldRunJson.apply(this,arguments);}finally{window.fieldMapFinishAlignmentJob(job);}
    };
    wrapped.__fieldMapV413Wrapped=true;
    window.runJsonOnlyAutoAlign=wrapped;
    window.openAutoEstimateCorrection=function(){return window.runJsonOnlyAutoAlign();};
    window.routeAutoAlignEstimatesFromLayers=function(){return window.runJsonOnlyAutoAlign();};
  }

  window.runToolAction=function(id,ev){
    id=normalId(id);
    try{ev?.preventDefault?.();ev?.stopPropagation?.();}catch(e){}
    try{
      if(id==='viewArea')return (typeof viewCurrentMapArea==='function'?viewCurrentMapArea():openFilter?.());
      if(id==='filter')return openFilter?.();
      if(id==='clear')return clearSelected?.();
      if(id==='corrections')return openDataCorrections?.();
      if(id==='autoAlign')return (window.runJsonOnlyAutoAlign?window.runJsonOnlyAutoAlign():window.openAutoEstimateCorrection?.());
      if(id==='guidedAlign')return (window.runGuidedAlign?window.runGuidedAlign():status('Guided Align not ready. Load a route first.'));
      if(id==='publicPowerCheck')return (window.runPublicPowerCheck?window.runPublicPowerCheck():status('Public Power Check not ready.'));
      if(id==='crossings'){toggleLineCrossings?.();window.refreshMapControlState?.();return false;}
      if(id==='displayAll')return openDisplayAllMenu?.();
      if(id==='measure')return toggleMeasureTool?.();
      if(id==='multi')return toggleMultiMeasureTool?.();
      if(id==='radius')return toggleRadiusLines?.();
      if(id==='note')return openPOIAtGPS?.();
      if(id==='breadcrumb')return toggleBreadcrumbs?.();
      if(id==='patrol')return togglePatrolOverlayFromMenu?.(ev||window.event);
    }catch(e){alert('Tool failed: '+(e.message||e));}
    return false;
  };

  function patchText(){
    try{
      document.querySelectorAll('button,.tool-btn,.premium-action-card b,.tool-layout-name b').forEach(el=>{
        const t=(el.textContent||'').trim();
        if(/^Area Radius$|^Area$/i.test(t))el.textContent='Proximity Check';
        if(/^Field$/i.test(t))el.textContent='Patrol';
      });
    }catch(e){}
  }
  function patchSettings(){
    const old=window.openSettingsSection;
    if(typeof old==='function'&&!old.__fieldMapV413Wrapped){
      const fn=function(section){const r=old.apply(this,arguments); if(section==='toolLayout')setTimeout(()=>{window.renderToolLayoutSettings?.();patchText();},0); return r;};
      fn.__fieldMapV413Wrapped=true;
      window.openSettingsSection=fn;
    }
  }
  window.openSettingsSectionFromMapTools=function(){
    try{closeDrawer?.();}catch(e){}
    try{if(typeof toggleSettings==='function'&&!document.getElementById('settingsPage')?.classList.contains('open'))toggleSettings();}catch(e){}
    setTimeout(()=>{try{openSettingsSection?.('toolLayout');window.renderToolLayoutSettings();}catch(e){}},80);
  };

  function init(){
    patchSettings(); patchText();
    try{window.renderCustomPlusGrid();}catch(e){}
    try{if(document.getElementById('toolLayoutSettings'))window.renderToolLayoutSettings();}catch(e){}
    window.FIELD_MAP_VERSION='4.1.3-cancel-drag-layout';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  setTimeout(init,500); setTimeout(init,1600);
})();


/* ---- js/features/field-map-fixes-v414.js ---- */
/* Field MAP v4.1.4 - settings/order, source HUD default off, wake lock, layout polish
   - Source status key is hidden by default and controlled from Filter > Interface.
   - Settings home is reordered into logical groups and adds Display & Power.
   - Keep screen on setting uses the Screen Wake Lock API when supported.
   - Tools + button only receives active highlight when a tool is actually running.
   - Keeps v4.1.3 alignment cancel / Proximity / Patrol / drag layout behaviour and hardens it.
*/
(function(){
  'use strict';

  const VERSION='4.1.4-settings-source-power-layout';
  const CONTROL_STORAGE_KEY='asset_tracker_v385_tool_layout_controls';
  const CONTROL_MAX=8;
  const CONTROL_DEFAULT=['viewArea','filter','clear','corrections','autoAlign','guidedAlign','publicPowerCheck','crossings'];
  const DRAG_MIME='application/x-field-map-tool';
  const LS_SOURCE_HUD='fieldMap.sourceHud.enabled';
  const LS_SOURCE_LABELS='fieldMap.sourceLabels.closeZoom.enabled';
  const LS_SOURCE_DEFAULT_MIGRATED='fieldMap.v414.sourceHudDefaultHidden';
  const LS_KEEP_SCREEN_ON='fieldMap.keepScreenOn.enabled';

  let wakeLock=null;
  let wakeLockRequesting=false;

  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function status(msg){try{showToolStatus?.(String(msg||''));}catch(e){try{console.info('[Field MAP]',msg);}catch(_){}}}
  function byId(id){return document.getElementById(id);}
  function normalId(id){id=String(id||''); if(id==='autoCorrection')return 'autoAlign'; if(id==='poi')return 'note'; if(id==='area')return 'radius'; if(id==='field')return 'patrol'; return id;}
  function actions(){
    return [
      {id:'viewArea',label:'Proximity Check',short:'Proximity',sub:'Records in current map',style:'primary',toolClass:'green',icon:'▣'},
      {id:'filter',label:'Filter',short:'Filter',sub:'Layer toggles',style:'teal',toolClass:'teal',icon:'◉'},
      {id:'clear',label:'Clear',short:'Clear',sub:'Remove markers',style:'amber',toolClass:'sun',icon:'⌫'},
      {id:'corrections',label:'Data Corrections',short:'Data Corrections',sub:'Add / edit / delete records',style:'primary',toolClass:'green',icon:'✎'},
      {id:'autoAlign',label:'Auto Align',short:'Auto Align',sub:'JSON straight estimates',style:'teal',toolClass:'teal',icon:'⌁'},
      {id:'guidedAlign',label:'Guided Align',short:'Guided Align',sub:'Public path guide',style:'purple',toolClass:'purple',icon:'〰'},
      {id:'publicPowerCheck',label:'Public Power Check',short:'Public Power',sub:'Reference check only',style:'purple',toolClass:'purple',icon:'⌘'},
      {id:'crossings',label:'Crossings',short:'Crossings',sub:'Red crossing zones',style:'amber',toolClass:'sun',icon:'✕'},
      {id:'displayAll',label:'Display All',short:'Display All',sub:'Record groups',style:'danger',toolClass:'redbtn',icon:'☷'},
      {id:'measure',label:'Measure',short:'Measure',sub:'Two point measure',style:'brown',toolClass:'brown',icon:'↔'},
      {id:'multi',label:'Multi Measure',short:'Multi',sub:'Measure a path',style:'brown',toolClass:'brown',icon:'⌁'},
      {id:'radius',label:'3 km Radius',short:'3 km',sub:'Nearby points',style:'primary',toolClass:'green',icon:'◎'},
      {id:'note',label:'Note',short:'Note',sub:'Save current GPS',style:'amber',toolClass:'sun',icon:'◆'},
      {id:'breadcrumb',label:'Breadcrumb',short:'Breadcrumb',sub:'GPS trail',style:'teal',toolClass:'teal',icon:'⋯'},
      {id:'patrol',label:'Patrol',short:'Patrol',sub:'GPS overlay',style:'primary',toolClass:'purple',icon:'⌖'}
    ];
  }
  function actionById(id){id=normalId(id); return actions().find(a=>a.id===id);}
  function cleanControls(ids,forceDefault){
    const valid=new Set(actions().map(a=>a.id));
    const out=[];
    (Array.isArray(ids)?ids:[]).forEach(raw=>{const id=normalId(raw); if(valid.has(id)&&!out.includes(id)&&out.length<CONTROL_MAX)out.push(id);});
    return (forceDefault||!out.length)?CONTROL_DEFAULT.slice():out.slice(0,CONTROL_MAX);
  }

  // ---------- Alignment cancel hardening ----------
  window.fieldMapStartAlignmentJob=function(name){
    const old=window.__fieldMapCurrentAlignmentJob;
    if(old)old.cancelled=true;
    const job={id:Date.now()+Math.random(),name:String(name||'Alignment'),cancelled:false,startedAt:Date.now()};
    window.__fieldMapCurrentAlignmentJob=job;
    document.body.classList.add('field-map-aligning');
    return job;
  };
  window.fieldMapCancelCurrentAlignment=function(){
    const job=window.__fieldMapCurrentAlignmentJob;
    if(job){
      job.cancelled=true;
      document.body.classList.add('field-map-align-cancelling');
      status(job.name+' cancelling…');
      try{routeAutoAlignSetStatus(job.name+' cancelling',99,'Stopping after the current fetch/section finishes.');}catch(e){}
    }
  };
  window.fieldMapAlignmentCancelled=function(job){return !!((job&&job.cancelled)||(window.__fieldMapCurrentAlignmentJob&&window.__fieldMapCurrentAlignmentJob.cancelled));};
  window.fieldMapFinishAlignmentJob=function(job){
    if(!job||window.__fieldMapCurrentAlignmentJob===job){
      window.__fieldMapCurrentAlignmentJob=null;
      document.body.classList.remove('field-map-aligning','field-map-align-cancelling');
    }
  };
  function addCancelToStatus(){
    try{
      const job=window.__fieldMapCurrentAlignmentJob;
      const el=byId('routeAutoAlignStatus')||document.querySelector('.auto-align-status');
      if(!el||!job)return;
      el.classList.add('cancellable');
      let btn=el.querySelector('.auto-align-cancel-btn');
      if(!btn){
        btn=document.createElement('button');
        btn.type='button';
        btn.className='auto-align-cancel-btn';
        btn.textContent='Cancel';
        btn.onclick=function(e){try{e.preventDefault();e.stopPropagation();}catch(_e){} window.fieldMapCancelCurrentAlignment();};
        el.appendChild(btn);
      }
      btn.disabled=!!job.cancelled;
      btn.textContent=job.cancelled?'Cancelling…':'Cancel';
    }catch(e){}
  }
  const oldStatus=window.routeAutoAlignSetStatus;
  if(typeof oldStatus==='function'&&!oldStatus.__fieldMapV414Wrapped){
    const wrapped=function(){const r=oldStatus.apply(this,arguments); addCancelToStatus(); return r;};
    wrapped.__fieldMapV414Wrapped=true;
    window.routeAutoAlignSetStatus=wrapped;
  }
  const oldFinish=window.routeAutoAlignFinishStatus;
  if(typeof oldFinish==='function'&&!oldFinish.__fieldMapV414Wrapped){
    const wrapped=function(){const r=oldFinish.apply(this,arguments); setTimeout(addCancelToStatus,0); return r;};
    wrapped.__fieldMapV414Wrapped=true;
    window.routeAutoAlignFinishStatus=wrapped;
  }

  // ---------- Tools and map controls ----------
  window.getToolLayoutControls=function(){
    try{return cleanControls(JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY)||'null'),false);}catch(e){return CONTROL_DEFAULT.slice();}
  };
  window.saveToolLayoutControls=function(ids){
    const clean=cleanControls(ids,false);
    try{localStorage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(clean));}catch(e){}
    try{window.renderToolLayoutSettings?.();}catch(e){}
    try{if(byId('drawer')?.classList.contains('open') && /Map/i.test(byId('dTitle')?.textContent||'')) window.renderMapMenu?.();}catch(e){}
    try{window.renderCustomPlusGrid?.();}catch(e){}
    try{window.refreshCustomToolActiveStates?.();window.refreshMapControlState?.();}catch(e){}
  };
  window.resetToolLayoutControls=function(){window.saveToolLayoutControls(CONTROL_DEFAULT.slice());status('Map Controls reset.');};
  window.toggleToolLayoutButton=function(id){
    id=normalId(id); const cur=window.getToolLayoutControls();
    if(cur.includes(id)){window.saveToolLayoutControls(cur.filter(x=>x!==id));return;}
    if(cur.length>=CONTROL_MAX){alert('Map Controls can hold '+CONTROL_MAX+' buttons. Hold and drag a control back to Map Tools, or drop this onto a control to swap.');return;}
    window.saveToolLayoutControls(cur.concat(id));
  };
  window.moveToolLayoutButton=function(id,dir){
    id=normalId(id); const cur=window.getToolLayoutControls(); const i=cur.indexOf(id),j=i+Number(dir||0);
    if(i<0||j<0||j>=cur.length)return; [cur[i],cur[j]]=[cur[j],cur[i]]; window.saveToolLayoutControls(cur);
  };
  function mapButton(a){
    const subId=a.id==='crossings'?' id="lineCrossingsSub"':'';
    const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${esc(a.id)}"`:'';
    return `<button type="button" class="premium-action-card ${esc(a.style)}" data-action-id="${esc(a.id)}"${dataTool} onclick="return runToolAction('${esc(a.id)}',event)"><i>${esc(a.icon)}</i><b>${esc(a.label)}</b><span${subId}>${esc(a.sub)}</span></button>`;
  }
  window.renderMapMenu=function(){
    const controls=window.getToolLayoutControls();
    const html=controls.map(id=>actionById(id)).filter(Boolean).map(mapButton).join('');
    try{head?.('Map','Controls');}catch(e){const t=byId('dTitle'); if(t)t.textContent='Map'; const s=byId('dSub'); if(s)s.textContent='Controls';}
    const b=typeof body==='function'?body():byId('body'); if(!b)return;
    b.innerHTML=`<div class="premium-map-menu compact-map-controls custom-map-controls field-map-v414-controls"><div class="compact-control-title"><b>Map Controls</b><span>${controls.length}/${CONTROL_MAX} quick buttons selected</span></div><div class="compact-control-grid custom-control-grid">${html}</div><button type="button" class="layout-link-btn" onclick="openSettingsSectionFromMapTools()">Hold / drag button layout</button></div>`;
    try{window.refreshCustomToolActiveStates?.();window.refreshMapControlState?.();}catch(e){}
  };
  window.openMapMenu=function(){
    try{openDrawer?.('map','tabMap',window.renderMapMenu);return;}catch(e){}
    try{window.renderMapMenu();byId('drawer')?.classList.add('open');}catch(_e){}
  };
  window.renderCustomPlusGrid=function(){
    const grid=document.querySelector('#plusSheet .plus-grid'); if(!grid)return;
    const controls=window.getToolLayoutControls();
    const tools=actions().filter(a=>!controls.includes(a.id));
    grid.innerHTML=tools.map(a=>{
      const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${esc(a.id)}"`:'';
      return `<button type="button" class="${esc(a.toolClass||'green')} tool-btn"${dataTool} onclick="runToolAction('${esc(a.id)}',event);closePlus?.()"><span class="tool-emoji">${esc(a.icon)}</span>${esc(a.short||a.label)}</button>`;
    }).join('') || '<div class="tool-layout-empty">All quick buttons are in Map Controls.</div>';
    const title=document.querySelector('#plusSheet .plus-title'); if(title)title.textContent='+ Map Tools';
    try{window.refreshCustomToolActiveStates?.();}catch(e){}
  };
  function isToolActive(id){
    id=normalId(id);
    try{
      if(id==='measure')return !!((typeof measureOn!=='undefined'&&measureOn)||window.measureOn);
      if(id==='multi')return !!((typeof multiMeasureOn!=='undefined'&&multiMeasureOn)||window.multiMeasureOn);
      if(id==='radius')return !!((typeof radiusOn!=='undefined'&&radiusOn)||window.radiusOn);
      if(id==='breadcrumb')return !!((typeof breadcrumbOn!=='undefined'&&breadcrumbOn)||window.breadcrumbOn);
      if(id==='crossings')return !!((typeof crossingsEnabled!=='undefined'&&crossingsEnabled)||window.crossingsEnabled);
      if(id==='patrol')return !!byId('heliPage')?.classList.contains('open');
    }catch(e){}
    return false;
  }
  window.refreshCustomToolActiveStates=function(){
    let any=false;
    document.querySelectorAll('[data-tool]').forEach(btn=>{
      const active=isToolActive(btn.dataset.tool);
      btn.classList.toggle('tool-active',active);
      if(active)any=true;
    });
    const sub=byId('lineCrossingsSub');
    if(sub)sub.textContent=((typeof crossingsEnabled!=='undefined'&&crossingsEnabled)||window.crossingsEnabled)?'Shown on map':'Red crossing zones';
    const fab=document.querySelector('.fab');
    if(fab){
      fab.classList.toggle('has-active-tool',any);
      // Opening the tools sheet can keep .active for state, but it must not show active-tool highlight by itself.
      if(!any)fab.classList.remove('heli-active');
    }
  };
  window.refreshMapControlState=function(){window.refreshCustomToolActiveStates();};
  window.runToolAction=function(id,ev){
    id=normalId(id);
    try{ev?.preventDefault?.();ev?.stopPropagation?.();}catch(e){}
    try{
      if(id==='viewArea')return (typeof viewCurrentMapArea==='function'?viewCurrentMapArea():openFilter?.());
      if(id==='filter')return openFilter?.();
      if(id==='clear')return clearSelected?.();
      if(id==='corrections')return openDataCorrections?.();
      if(id==='autoAlign')return (window.runJsonOnlyAutoAlign?window.runJsonOnlyAutoAlign():window.openAutoEstimateCorrection?.());
      if(id==='guidedAlign')return (window.runGuidedAlign?window.runGuidedAlign():status('Guided Align not ready. Load a route first.'));
      if(id==='publicPowerCheck')return (window.runPublicPowerCheck?window.runPublicPowerCheck():status('Public Power Check not ready.'));
      if(id==='crossings'){toggleLineCrossings?.();window.refreshMapControlState?.();return false;}
      if(id==='displayAll')return openDisplayAllMenu?.();
      if(id==='measure')return toggleMeasureTool?.();
      if(id==='multi')return toggleMultiMeasureTool?.();
      if(id==='radius')return toggleRadiusLines?.();
      if(id==='note')return openPOIAtGPS?.();
      if(id==='breadcrumb')return toggleBreadcrumbs?.();
      if(id==='patrol')return togglePatrolOverlayFromMenu?.(ev||window.event);
    }catch(e){alert('Tool failed: '+(e.message||e));}
    return false;
  };

  function rowHTML(a,zone,index,controls){
    const inControls=zone==='controls';
    const disabledToControls=!inControls&&controls.length>=CONTROL_MAX;
    const top=inControls&&index===0, bottom=inControls&&index===controls.length-1;
    return `<div class="tool-layout-row fieldmap-drag-row ${inControls?'in-controls':'in-tools'}" data-tool-id="${esc(a.id)}" data-zone="${esc(zone)}" draggable="true" ondragstart="fieldMapLayoutDragStart(event,'${esc(a.id)}','${esc(zone)}')" ondragover="fieldMapLayoutDragOver(event)" ondrop="fieldMapLayoutDrop(event,'${esc(zone)}','${esc(a.id)}')" onpointerdown="fieldMapLayoutPointerDown(event,'${esc(a.id)}','${esc(zone)}')">
      <div class="tool-layout-order drag-handle" title="Hold and drag">☰</div>
      <div class="tool-layout-name"><b>${esc(a.label)}</b><span>${esc(a.sub)}</span></div>
      <div class="tool-layout-actions fieldmap-layout-actions">
        ${inControls?`<button type="button" onclick="event.stopPropagation();moveToolLayoutButton('${esc(a.id)}',-1)" ${top?'disabled':''}>↑</button><button type="button" onclick="event.stopPropagation();moveToolLayoutButton('${esc(a.id)}',1)" ${bottom?'disabled':''}>↓</button><button type="button" class="secondary" onclick="event.stopPropagation();toggleToolLayoutButton('${esc(a.id)}')">To Tools</button>`:`<button type="button" class="green" onclick="event.stopPropagation();toggleToolLayoutButton('${esc(a.id)}')" ${disabledToControls?'disabled':''}>To Controls</button>`}
      </div>
    </div>`;
  }
  window.renderToolLayoutSettings=function(){
    const box=byId('toolLayoutSettings'); if(!box)return;
    const controls=window.getToolLayoutControls();
    const shown=controls.map((id,i)=>actionById(id)).filter(Boolean).map((a,i)=>rowHTML(a,'controls',i,controls)).join('');
    const left=actions().filter(a=>!controls.includes(a.id)).map((a,i)=>rowHTML(a,'tools',i,controls)).join('');
    box.innerHTML=`<div class="tool-layout-panel clearer-tool-layout fieldmap-layout-drag-panel v414-layout">
      <div class="tool-layout-summary"><b>${controls.length}/${CONTROL_MAX} in Map Controls</b><span>Hold a row until it lifts, then drag it between Map Controls and Map Tools. Drop onto a row to place it there. If controls are full, dropping a tool onto a control swaps that slot.</span></div>
      <div class="fieldmap-layout-drop-grid">
        <section class="fieldmap-drop-zone controls-zone" data-layout-zone="controls" ondragover="fieldMapLayoutDragOver(event)" ondrop="fieldMapLayoutDrop(event,'controls','')"><h4>Map Controls</h4><p>Quick buttons shown in the Map panel.</p><div class="tool-layout-list">${shown||'<div class="help">No controls selected.</div>'}</div></section>
        <section class="fieldmap-drop-zone tools-zone" data-layout-zone="tools" ondragover="fieldMapLayoutDragOver(event)" ondrop="fieldMapLayoutDrop(event,'tools','')"><h4>Map Tools</h4><p>Extra tools kept behind the orange + button.</p><div class="tool-layout-list">${left||'<div class="help">No extra tools.</div>'}</div></section>
      </div>
      <div class="actions"><button type="button" class="secondary" onclick="resetToolLayoutControls()">Reset default</button></div>
    </div>`;
  };
  window.fieldMapHandleLayoutDrop=function(id,from,to,beforeId){
    id=normalId(id); from=String(from||''); to=String(to||''); beforeId=normalId(beforeId||'');
    if(!actionById(id)||!['controls','tools'].includes(to))return;
    let controls=window.getToolLayoutControls().map(normalId).filter(Boolean);
    controls=controls.filter((x,i,a)=>a.indexOf(x)===i&&actionById(x));
    const wasIn=controls.includes(id);
    const remove=()=>{controls=controls.filter(x=>x!==id);};
    if(to==='tools'){
      if(wasIn){remove(); window.saveToolLayoutControls(controls); status(actionById(id).label+' moved to Map Tools.');}
      return;
    }
    remove();
    let insertAt=beforeId&&controls.includes(beforeId)?controls.indexOf(beforeId):controls.length;
    if(controls.length<CONTROL_MAX)controls.splice(insertAt,0,id);
    else{if(insertAt>=controls.length)insertAt=controls.length-1; controls.splice(insertAt,1,id);}
    window.saveToolLayoutControls(controls.slice(0,CONTROL_MAX));
    status(actionById(id).label+' moved to Map Controls.');
  };
  window.fieldMapLayoutDragStart=function(ev,id,from){try{ev.dataTransfer.setData(DRAG_MIME,JSON.stringify({id:normalId(id),from:String(from||'')}));ev.dataTransfer.effectAllowed='move';}catch(e){} try{ev.currentTarget.classList.add('dragging');}catch(e){}};
  window.fieldMapLayoutDragOver=function(ev){try{ev.preventDefault();ev.dataTransfer.dropEffect='move';}catch(e){}};
  window.fieldMapLayoutDrop=function(ev,to,beforeId){
    try{ev.preventDefault();ev.stopPropagation();}catch(e){}
    let data=null; try{data=JSON.parse(ev.dataTransfer.getData(DRAG_MIME)||'null');}catch(e){}
    if(data&&data.id)window.fieldMapHandleLayoutDrop(data.id,data.from,to,beforeId||'');
  };
  let pointerDrag=null;
  function clearPointerDrag(){
    if(pointerDrag){try{clearTimeout(pointerDrag.timer);}catch(e){} try{document.body.classList.remove('fieldmap-layout-dragging');document.querySelectorAll('.fieldmap-drag-row.dragging,.fieldmap-drop-zone.drop-hover').forEach(el=>el.classList.remove('dragging','drop-hover'));}catch(e){}}
    pointerDrag=null;
    document.removeEventListener('pointermove',onPointerMove,true); document.removeEventListener('pointerup',onPointerUp,true); document.removeEventListener('pointercancel',onPointerUp,true);
  }
  function zoneFromPoint(x,y){return document.elementFromPoint(x,y)?.closest?.('[data-layout-zone]')||null;}
  function rowFromPoint(x,y){return document.elementFromPoint(x,y)?.closest?.('[data-tool-id]')||null;}
  function onPointerMove(ev){
    if(!pointerDrag)return;
    if(pointerDrag.active){
      try{ev.preventDefault();ev.stopPropagation();}catch(e){}
      document.querySelectorAll('.fieldmap-drop-zone.drop-hover').forEach(el=>el.classList.remove('drop-hover'));
      const zone=zoneFromPoint(ev.clientX,ev.clientY); if(zone)zone.classList.add('drop-hover');
    }
  }
  function onPointerUp(ev){
    if(pointerDrag&&pointerDrag.active){
      try{ev.preventDefault();ev.stopPropagation();}catch(e){}
      const zone=zoneFromPoint(ev.clientX,ev.clientY);
      const row=rowFromPoint(ev.clientX,ev.clientY);
      const to=zone?.getAttribute('data-layout-zone')||row?.getAttribute('data-zone')||pointerDrag.from;
      const before=row&&row.getAttribute('data-tool-id')!==pointerDrag.id?row.getAttribute('data-tool-id'):'';
      window.fieldMapHandleLayoutDrop(pointerDrag.id,pointerDrag.from,to,before);
    }
    clearPointerDrag();
  }
  window.fieldMapLayoutPointerDown=function(ev,id,from){
    if(ev.button!=null&&ev.button!==0)return;
    if(ev.target&&String(ev.target.tagName||'').toLowerCase()==='button')return;
    clearPointerDrag();
    pointerDrag={id:normalId(id),from:String(from||''),x:ev.clientX,y:ev.clientY,active:false,timer:null,el:ev.currentTarget};
    document.addEventListener('pointermove',onPointerMove,true); document.addEventListener('pointerup',onPointerUp,true); document.addEventListener('pointercancel',onPointerUp,true);
    pointerDrag.timer=setTimeout(()=>{
      if(!pointerDrag)return;
      pointerDrag.active=true;
      try{document.body.classList.add('fieldmap-layout-dragging');pointerDrag.el?.classList?.add('dragging');if(navigator.vibrate)navigator.vibrate(18);}catch(e){}
      status('Drag to Map Controls or Map Tools, then release.');
    },290);
  };

  // ---------- Source HUD hidden by default + Filter toggle ----------
  function applySourceHudVisibility(){
    const on=localStorage.getItem(LS_SOURCE_HUD)==='1';
    document.body.classList.toggle('field-map-source-hud-off',!on);
    const hud=byId('fieldMapSourceHud');
    if(hud){hud.classList.toggle('source-hud-disabled',!on); if(!on)hud.classList.remove('open');}
    const cb=byId('showSourceHud'); if(cb)cb.checked=on;
    const lab=byId('showSourceLabels'); if(lab)lab.checked=localStorage.getItem(LS_SOURCE_LABELS)==='1';
  }
  window.setFieldMapSourceHudVisible=function(on){
    try{localStorage.setItem(LS_SOURCE_HUD,on?'1':'0');}catch(e){}
    applySourceHudVisibility();
    status(on?'Top source status on.':'Top source status hidden.');
  };
  window.toggleFieldMapSourceHud=function(){window.setFieldMapSourceHudVisible(localStorage.getItem(LS_SOURCE_HUD)!=='1');};
  function setSourceLabels(on){
    try{localStorage.setItem(LS_SOURCE_LABELS,on?'1':'0');}catch(e){}
    try{fieldMapRefreshSourceStatusClean?.();}catch(e){}
    applySourceHudVisibility();
    status(on?'Close-up source labels on.':'Close-up source labels off.');
  }
  function ensureSourceDefaultOff(){
    try{
      if(localStorage.getItem(LS_SOURCE_DEFAULT_MIGRATED)!=='1'){
        localStorage.setItem(LS_SOURCE_HUD,'0');
        localStorage.setItem(LS_SOURCE_LABELS,'0');
        localStorage.setItem(LS_SOURCE_DEFAULT_MIGRATED,'1');
      }
    }catch(e){}
    applySourceHudVisibility();
  }
  function injectFilterSourceControls(){
    try{
      const interfaceBox=byId('showFab')?.closest('.compact-filter')||document.querySelector('[data-display-toggle="fab"]')?.closest('.compact-filter');
      if(!interfaceBox)return;
      let hudLabel=byId('showSourceHud')?.closest('label');
      if(!hudLabel){
        hudLabel=document.createElement('label'); hudLabel.className='check-item source-status-filter-toggle';
        hudLabel.innerHTML='<input type="checkbox" id="showSourceHud"> Top source status key';
        interfaceBox.appendChild(hudLabel);
      }
      let hudCb=byId('showSourceHud');
      if(hudCb&&!hudCb.__fieldMapV414Bound){hudCb.__fieldMapV414Bound=true; hudCb.addEventListener('change',e=>window.setFieldMapSourceHudVisible(!!e.target.checked));}
      let labels=byId('showSourceLabels')?.closest('label');
      if(!labels){
        labels=document.createElement('label'); labels.className='check-item source-status-filter-toggle';
        labels.innerHTML='<input type="checkbox" id="showSourceLabels"> Close-up source labels';
        interfaceBox.appendChild(labels);
      }
      let labCb=byId('showSourceLabels');
      if(labCb&&!labCb.__fieldMapV414Bound){labCb.__fieldMapV414Bound=true; labCb.addEventListener('change',e=>setSourceLabels(!!e.target.checked));}
      applySourceHudVisibility();
    }catch(e){}
  }
  const oldOpenFilter=window.openFilter;
  if(typeof oldOpenFilter==='function'&&!oldOpenFilter.__fieldMapV414Wrapped){
    const fn=function(){const r=oldOpenFilter.apply(this,arguments); setTimeout(()=>{injectFilterSourceControls();applySourceHudVisibility();},0); return r;};
    fn.__fieldMapV414Wrapped=true; window.openFilter=fn;
  }
  const oldRenderFilter=window.renderFilter;
  if(typeof oldRenderFilter==='function'&&!oldRenderFilter.__fieldMapV414Wrapped){
    const fn=function(){const r=oldRenderFilter.apply(this,arguments); setTimeout(()=>{injectFilterSourceControls();applySourceHudVisibility();},0); return r;};
    fn.__fieldMapV414Wrapped=true; window.renderFilter=fn;
  }

  // ---------- Keep screen on ----------
  function keepScreenOnEnabled(){try{return localStorage.getItem(LS_KEEP_SCREEN_ON)==='1';}catch(e){return false;}}
  async function requestWakeLock(){
    if(!keepScreenOnEnabled()||wakeLock||wakeLockRequesting||document.visibilityState==='hidden')return;
    wakeLockRequesting=true;
    try{
      if(!('wakeLock' in navigator))throw new Error('Screen Wake Lock is not supported in this browser');
      wakeLock=await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release',()=>{wakeLock=null;renderPowerSettings();});
      document.body.classList.add('field-map-keep-screen-on');
    }catch(e){
      document.body.classList.remove('field-map-keep-screen-on');
      if(keepScreenOnEnabled())status('Keep screen on is enabled, but this browser may not support forced wake lock.');
    }finally{wakeLockRequesting=false; renderPowerSettings();}
  }
  async function releaseWakeLock(){
    try{if(wakeLock){const w=wakeLock; wakeLock=null; await w.release?.();}}catch(e){wakeLock=null;}
    document.body.classList.remove('field-map-keep-screen-on');
    renderPowerSettings();
  }
  window.fieldMapSetKeepScreenOn=function(on){
    try{localStorage.setItem(LS_KEEP_SCREEN_ON,on?'1':'0');}catch(e){}
    if(on){requestWakeLock();status('Keep screen on enabled.');}
    else{releaseWakeLock();status('Keep screen on disabled.');}
    renderPowerSettings();
  };
  window.fieldMapToggleKeepScreenOn=function(){window.fieldMapSetKeepScreenOn(!keepScreenOnEnabled());};
  window.renderPowerSettings=function(){
    const box=byId('powerSettings'); if(!box)return;
    const enabled=keepScreenOnEnabled();
    const supported='wakeLock' in navigator;
    box.innerHTML=`<div class="power-settings-card">
      <div class="power-toggle-row"><div><b>Keep screen on</b><span>Requests forced no-dimming while Field MAP is open and visible.</span></div><button type="button" class="${enabled?'green':'secondary'}" onclick="fieldMapToggleKeepScreenOn()">${enabled?'On':'Off'}</button></div>
      <div class="power-status ${enabled?'on':'off'}"><b>Status:</b> ${enabled?(wakeLock?'Active wake lock':'Enabled / waiting for browser permission'):'Off'} · ${supported?'Supported by this browser':'Not supported by this browser'}</div>
      <div class="help">Android/Chrome may release the wake lock if the app is hidden, the phone locks, or battery saver interferes. It will request it again when you return to the app.</div>
    </div>`;
  };
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&keepScreenOnEnabled())requestWakeLock();});

  // ---------- Settings order and section ----------
  function ensurePowerSection(){
    try{
      if(typeof SETTINGS_SECTIONS==='object'&&SETTINGS_SECTIONS)SETTINGS_SECTIONS.power={title:'Display & Power',id:'settingsSectionPower'};
    }catch(e){}
    const bodyEl=document.querySelector('#settingsPage .settings-body');
    if(bodyEl&&!byId('settingsSectionPower')){
      const div=document.createElement('div');
      div.className='settings-section-page';
      div.id='settingsSectionPower';
      div.innerHTML='<div class="block"><h3>Display & Power</h3><div class="help">Screen behaviour and field visibility settings.</div><div id="powerSettings"></div></div>';
      bodyEl.appendChild(div);
    }
  }
  function settingsCard(section,title,sub){
    return `<button class="settings-card" onclick="openSettingsSection('${esc(section)}')" type="button"><span><b>${esc(title)}</b><small>${esc(sub)}</small></span><em>›</em></button>`;
  }
  function organiseSettingsHome(){
    ensurePowerSection();
    const home=byId('settingsHome'); if(!home)return;
    home.innerHTML=`
      ${settingsCard('import','Import Data','Import CSV/JSON/TXT files, test imports, and auto-index.')}
      ${settingsCard('save','Save Location','Choose the one folder used for app saves, exports, and tests.')}
      ${settingsCard('toolLayout','Map Buttons','Hold and drag Map Controls / Map Tools placement.')}
      ${settingsCard('power','Display & Power','Keep screen on and screen behaviour for field use.')}
      ${settingsCard('security','Security & Privacy','PIN lock, auto-lock, external links, and network protection.')}
      ${settingsCard('storage','Storage & Backups','Record counts, index count, local backups, and clear data.')}
      ${settingsCard('corrections','Data Corrections','Estimate corrections, Auto Align, Guided Align, and corrected JSON export.')}
      ${settingsCard('production','Diagnostics & Recovery','Health check, Safe Mode, Hard Refresh, and Export Everything.')}`;
  }
  const oldOpenSettingsSection=window.openSettingsSection;
  if(typeof oldOpenSettingsSection==='function'&&!oldOpenSettingsSection.__fieldMapV414Wrapped){
    const fn=function(section){ensurePowerSection(); organiseSettingsHome(); const r=oldOpenSettingsSection.apply(this,arguments); if(section==='power')setTimeout(renderPowerSettings,0); if(section==='toolLayout')setTimeout(()=>window.renderToolLayoutSettings?.(),0); return r;};
    fn.__fieldMapV414Wrapped=true; window.openSettingsSection=fn;
  }
  const oldShowHome=window.showSettingsHome;
  if(typeof oldShowHome==='function'&&!oldShowHome.__fieldMapV414Wrapped){
    const fn=function(){const r=oldShowHome.apply(this,arguments); organiseSettingsHome(); return r;};
    fn.__fieldMapV414Wrapped=true; window.showSettingsHome=fn;
  }
  const oldToggleSettings=window.toggleSettings;
  if(typeof oldToggleSettings==='function'&&!oldToggleSettings.__fieldMapV414Wrapped){
    const fn=function(){ensurePowerSection(); organiseSettingsHome(); const r=oldToggleSettings.apply(this,arguments); setTimeout(()=>{organiseSettingsHome();renderPowerSettings();},0); return r;};
    fn.__fieldMapV414Wrapped=true; window.toggleSettings=fn;
  }

  function patchText(){
    try{
      document.querySelectorAll('button,.tool-btn,.premium-action-card b,.tool-layout-name b,.settings-card b,h3').forEach(el=>{
        const t=(el.textContent||'').trim();
        if(/^View Area$|^Area$/i.test(t))el.textContent='Proximity Check';
        if(/^Field$/i.test(t))el.textContent='Patrol';
        if(/^Estimate corrections$/i.test(t))el.textContent='Data Corrections';
        if(/^Button layout$/i.test(t))el.textContent='Map Buttons';
      });
    }catch(e){}
  }

  function init(){
    ensureSourceDefaultOff(); ensurePowerSection(); organiseSettingsHome(); renderPowerSettings(); patchText();
    try{window.renderCustomPlusGrid();}catch(e){}
    try{window.refreshCustomToolActiveStates();}catch(e){}
    try{if(byId('toolLayoutSettings'))window.renderToolLayoutSettings();}catch(e){}
    if(keepScreenOnEnabled())setTimeout(requestWakeLock,250);
    window.FIELD_MAP_VERSION=VERSION;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  setTimeout(init,500); setTimeout(init,1600); setTimeout(()=>{injectFilterSourceControls();applySourceHudVisibility();},2400);
})();

