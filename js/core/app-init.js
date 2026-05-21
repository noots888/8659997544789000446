/* Map boot, localStorage load/save, and service-worker registration. */
function init(){
  // Map setup now lives in js/modules/map/map-core.js
  // Keep app-init focused on boot/storage/startup so map changes do not break import/search.
  if(typeof initMapCore === "function") initMapCore();
  else console.error("initMapCore missing: map module did not load");
  if(typeof initExportFolderModule === "function") initExportFolderModule().catch(e=>console.warn("Export folder init skipped",e));
  allRecords=load(KEY,[]);if(typeof assignRecordIndexes==='function')assignRecordIndexes();pois=load(POI_KEY,[]);heliMarks=load(HELI_KEY,[]);assetInfoFields=load(INFO_KEY,assetInfoFields);displaySettings=load(DISPLAY_KEY,displaySettings);mapToggleSettings=load(MAP_TOGGLE_KEY,mapToggleSettings);
  // v3.7.1 estimate visibility migration: show yellow/orange estimate dots by default while keeping them out of the trusted blue route line.
  mapToggleSettings={...mapToggleSettings,dots:true,lines:true,trueGps:true,noGpsEstimates:true,gapEstimates:true,selected:true};
  try{localStorage.setItem(MAP_TOGGLE_KEY,JSON.stringify(mapToggleSettings));}catch(e){}
  try{routeAutoAlignOnLineLoad=false;}catch(e){}
  updateKPIs();applyDisplaySettings();setActive(document.getElementById("tabHome")?"tabHome":"tabMap");
  // Restore saved imports after first paint. Always show a short startup loading panel so large saved data never looks frozen.
  setTimeout(async()=>{
    let splash=false;
    const minSplashMs=900;
    const splashStart=Date.now();
    const waitMinSplash=async()=>{
      const left=minSplashMs-(Date.now()-splashStart);
      if(left>0) await new Promise(r=>setTimeout(r,left));
    };
    try{
      let filesBeingLoaded=[];
      try{
        filesBeingLoaded=(typeof sourceFileSummary==='function')?sourceFileSummary(allRecords,14):[];
        if(typeof loadRecordsMetaFromIndexedDB==='function'){
          const meta=await loadRecordsMetaFromIndexedDB();
          if(meta && Array.isArray(meta.sources) && meta.sources.length) filesBeingLoaded=meta.sources.slice(0,14);
        }
      }catch(metaErr){console.warn('Startup source summary skipped',metaErr);}

      splash=true;
      const startupTitle=importAutoIndex?'Auto-indexing. Please wait...':'Loading saved data...';
      const startupDetail=(typeof autoIndexBusyHTML==='function')
        ? autoIndexBusyHTML('Opening saved records...',filesBeingLoaded)
        : 'Opening saved records...';
      showBusyOverlay(startupTitle,startupDetail,{html:typeof autoIndexBusyHTML==='function'});
      if(typeof sleepFrame==='function') await sleepFrame();

      await restorePersistedRecords((p)=>{
        if(!p)return;
        const src=(p.sources&&p.sources.length)?p.sources:filesBeingLoaded;
        if(p.phase==='meta'){
          if(src&&src.length)filesBeingLoaded=src.slice(0,14);
          const msg=`Loading saved data... ${Number(p.count||0).toLocaleString()} records`;
          if(typeof autoIndexBusyHTML==='function')updateBusy(autoIndexBusyHTML(msg,filesBeingLoaded),{html:true});
          else updateBusy(msg);
        }
        if(p.phase==='chunk'){
          if(src&&src.length)filesBeingLoaded=src.slice(0,14);
          const msg=`Loading saved data... chunk ${Number(p.done||0).toLocaleString()} / ${Number(p.total||0).toLocaleString()} · ${Number(p.count||0).toLocaleString()} records`;
          if(typeof autoIndexBusyHTML==='function')updateBusy(autoIndexBusyHTML(msg,filesBeingLoaded),{html:true});
          else updateBusy(msg);
        }
      });
      searchIndex=[];
      lineSearchCache=[];
      searchIndexReady=false;
      updateKPIs();

      const filesBeingIndexed=(typeof sourceFileSummary==='function')?sourceFileSummary(allRecords,14):filesBeingLoaded;
      if(importAutoIndex && allRecords.length){
        if(typeof autoIndexBusyHTML==='function')updateBusy(autoIndexBusyHTML('Preparing fast index...',filesBeingIndexed),{html:true});
        else updateBusy('Preparing fast index...');
        if(typeof sleepFrame==='function') await sleepFrame();
        try{
          await rebuildIndexAsync((done,total)=>{
            const msg=`Auto-indexing. Please wait... ${Number(done||0).toLocaleString()} / ${Number(total||0).toLocaleString()} records`;
            if(typeof autoIndexBusyHTML==='function')updateBusy(autoIndexBusyHTML(msg,filesBeingIndexed),{html:true});
            else updateBusy(msg);
          });
          updateKPIs();
          showToolStatus?.(`Loaded and indexed ${allRecords.length.toLocaleString()} records`);
          await waitMinSplash();
          await finishBusyOverlay('Auto index completed');
        }catch(idxErr){
          console.warn('Startup auto-index skipped',idxErr);
          searchIndex=[]; lineSearchCache=[]; searchIndexReady=false;
          await waitMinSplash();
          hideBusyOverlay();
          showToolStatus?.('Loaded records. Auto-index failed; Search can rebuild it.');
        }
      }else{
        const msg=allRecords.length
          ? `Loaded ${allRecords.length.toLocaleString()} records. Auto Index is off; search index builds when needed.`
          : 'Ready';
        if(typeof autoIndexBusyHTML==='function')updateBusy(autoIndexBusyHTML(msg,filesBeingIndexed),{html:true});
        else updateBusy(msg);
        await waitMinSplash();
        await finishBusyOverlay(allRecords.length?'Loaded saved data':'Ready');
        showToolStatus?.(allRecords.length ? `Loaded ${allRecords.length.toLocaleString()} records. Index builds on first search.` : 'Ready');
      }
    }catch(e){
      console.warn('Startup data restore skipped',e);
      if(splash)hideBusyOverlay();
    }
  },60);
  if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});
}
function load(k,f){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch(e){return f}}
function save(){
  // Keep localStorage only for small datasets. Large JSON is stored in IndexedDB chunks.
  try{
    if(allRecords.length<12000){localStorage.setItem(KEY,JSON.stringify(allRecords));}
    else{localStorage.removeItem(KEY);}
  }catch(e){console.warn('localStorage save skipped',e)}
}
function idbOpen(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return;}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta',{keyPath:'key'});
      if(!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks',{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
  });
}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));});}
async function clearRecordsDB(){
  try{
    const db=await idbOpen();
    const tx=db.transaction(['meta','chunks'],'readwrite');
    tx.objectStore('chunks').clear();
    tx.objectStore('meta').delete('records');
    await txDone(tx); db.close();
  }catch(e){console.warn('IndexedDB clear skipped',e)}
}
async function saveRecordsToIndexedDB(records,onProgress){
  const db=await idbOpen();
  const chunkSize=600;
  const sources=(typeof sourceFileSummary==='function')?sourceFileSummary(records,30):[];
  let tx=db.transaction(['meta','chunks'],'readwrite');
  tx.objectStore('chunks').clear();
  tx.objectStore('meta').put({key:'records',count:records.length,chunks:Math.ceil(records.length/chunkSize),savedAt:new Date().toISOString(),sources});
  await txDone(tx);
  for(let i=0,chunkId=0;i<records.length;i+=chunkSize,chunkId++){
    tx=db.transaction('chunks','readwrite');
    tx.objectStore('chunks').put({id:chunkId,records:records.slice(i,i+chunkSize)});
    await txDone(tx);
    if(onProgress)onProgress(Math.min(i+chunkSize,records.length),records.length);
    if(typeof sleepFrame==='function') await sleepFrame();
  }
  db.close();
  try{localStorage.removeItem(KEY)}catch(e){}
}
async function loadRecordsMetaFromIndexedDB(){
  try{
    const db=await idbOpen();
    const tx=db.transaction('meta','readonly');
    const meta=await new Promise(resolve=>{
      const r=tx.objectStore('meta').get('records');
      r.onsuccess=()=>resolve(r.result||null);
      r.onerror=()=>resolve(null);
    });
    await txDone(tx).catch(()=>{});
    db.close();
    return meta||null;
  }catch(e){console.warn('IndexedDB meta load skipped',e);return null;}
}
async function loadRecordsFromIndexedDB(onProgress){
  const db=await idbOpen();
  let tx=db.transaction('meta','readonly');
  const meta=await new Promise(resolve=>{const r=tx.objectStore('meta').get('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});
  await txDone(tx).catch(()=>{});
  if(!meta||!meta.chunks){db.close();return[];}
  if(onProgress)onProgress({phase:'meta',done:0,total:meta.chunks,count:meta.count||0,sources:meta.sources||[]});
  const out=[];
  for(let id=0;id<meta.chunks;id++){
    tx=db.transaction('chunks','readonly');
    const chunk=await new Promise(resolve=>{const r=tx.objectStore('chunks').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});
    await txDone(tx).catch(()=>{});
    if(chunk&&Array.isArray(chunk.records)) out.push(...chunk.records);
    if(onProgress)onProgress({phase:'chunk',done:id+1,total:meta.chunks,count:out.length,sources:meta.sources||[]});
    if(typeof sleepFrame==='function') await sleepFrame();
  }
  db.close();
  return out;
}
async function restorePersistedRecords(onProgress){
  try{
    const saved=await loadRecordsFromIndexedDB(onProgress);
    if(saved&&saved.length){
      let restored=saved;
      let cleanup=null;
      if(typeof cleanupImportedRecords==='function'){
        cleanup=cleanupImportedRecords(saved,{mode:'restore'});
        restored=cleanup.records||saved;
      }
      allRecords=restored;
      if(typeof assignRecordIndexes==='function')assignRecordIndexes();
      if(typeof invalidatePatrolRouteCache==='function')invalidatePatrolRouteCache();
      if(typeof clearRouteSegmentCache==='function')clearRouteSegmentCache();
      if(typeof invalidateFastCounts==='function')invalidateFastCounts();
      if(typeof linkConductors==='function') linkConductors();
      updateKPIs();
      if(typeof renderSettingsStats==='function')renderSettingsStats();
      if(cleanup&&(cleanup.removedGeometry||cleanup.removedDuplicates)){
        showToolStatus?.(`Cleaned saved data: removed ${cleanup.removedGeometry} geometry-only and ${cleanup.removedDuplicates} duplicate records`);
        setTimeout(()=>saveRecordsToIndexedDB(allRecords).catch(e=>console.warn('Cleaned data save skipped',e)),120);
      }
      if(onProgress)onProgress({phase:'sources',files:(typeof sourceFileSummary==='function'?sourceFileSummary(allRecords,30):[]),count:allRecords.length});
    }
  }catch(e){console.warn('IndexedDB load skipped',e)}
}
