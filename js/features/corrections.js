/* Estimate correction export/import and corrected JSON builder. v3.8.7 */
(function(){
  function nowStamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
  function downloadJSON(name,data,title){
    try{
      if(typeof window.safeExportJSON==='function'){
        return window.safeExportJSON(name,data,{title:title||'Export ready',forcePanel:true});
      }
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download=name;
      document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
      return true;
    }catch(e){alert('Export failed: '+(e.message||e));return false;}
  }
  function parseAndImportCorrectionText(text,mode){
    const parsed=JSON.parse(String(text||''));
    const incoming=extractCorrectionsFromImport(parsed);
    if(!incoming)throw new Error('No estimate corrections found in that JSON.');
    const base=(mode==='replace')?{}:getCorrections();
    const merged={...base,...incoming};
    setCorrections(merged);
    renderCorrectionSettings();
    showToolStatus?.(`Imported ${Object.keys(incoming).length.toLocaleString()} estimate correction${Object.keys(incoming).length===1?'':'s'} (${mode==='replace'?'replaced':'merged'}).`);
    try{routeRefreshCurrentAfterEstimateChange?.();}catch(e){}
    return Object.keys(incoming).length;
  }
  function ensureCorrectionImporter(){
    let sheet=document.getElementById('estimateCorrectionImportSheet');
    if(sheet)return sheet;
    sheet=document.createElement('div');
    sheet.id='estimateCorrectionImportSheet';
    sheet.className='correction-import-sheet';
    sheet.innerHTML=`
      <div class="correction-import-card">
        <div class="correction-import-head"><div><b id="correctionImportTitle">Import corrections</b><span>Works with file picker or pasted JSON.</span></div><button type="button" onclick="closeEstimateCorrectionImporter()">×</button></div>
        <div class="correction-import-body">
          <input accept=".json,application/json,text/plain" id="estimateCorrectionVisibleFileInput" type="file" />
          <textarea id="estimateCorrectionPasteBox" placeholder="Paste exported corrections JSON here if Spck / HTML editor blocks the file picker..."></textarea>
          <div class="correction-import-actions"><button class="green" type="button" onclick="importEstimateCorrectionsFromPaste()">Import pasted JSON</button><button class="secondary" type="button" onclick="document.getElementById('estimateCorrectionVisibleFileInput')?.click()">Choose file</button></div>
          <div class="help">Use <b>Export corrections</b> on one device, then paste or import that JSON here on another install. Use Replace only when you want to wipe current saved corrections first.</div>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    const fi=sheet.querySelector('#estimateCorrectionVisibleFileInput');
    if(fi){fi.addEventListener('change',async()=>{
      const file=fi.files&&fi.files[0];
      if(!file)return;
      try{
        const text=await file.text();
        const count=parseAndImportCorrectionText(text,window.__estimateCorrectionPendingMode||'merge');
        fi.value='';
        closeEstimateCorrectionImporter();
      }catch(e){alert('Correction import failed: '+(e.message||e));}
    });}
    return sheet;
  }
  window.openEstimateCorrectionImporter=function openEstimateCorrectionImporter(mode){
    window.__estimateCorrectionPendingMode=mode||'merge';
    const sheet=ensureCorrectionImporter();
    const title=document.getElementById('correctionImportTitle');
    if(title)title.textContent=(mode==='replace')?'Import / replace corrections':'Import / merge corrections';
    const ta=document.getElementById('estimateCorrectionPasteBox');
    if(ta)ta.value='';
    sheet.classList.add('show');
    setTimeout(()=>{try{ta&&ta.focus();}catch(e){}},80);
  };
  window.closeEstimateCorrectionImporter=function closeEstimateCorrectionImporter(){
    const sheet=document.getElementById('estimateCorrectionImportSheet');
    if(sheet)sheet.classList.remove('show');
  };
  window.importEstimateCorrectionsFromPaste=function importEstimateCorrectionsFromPaste(){
    const ta=document.getElementById('estimateCorrectionPasteBox');
    const text=ta&&ta.value;
    if(!String(text||'').trim()){alert('Paste corrections JSON first.');return;}
    try{
      parseAndImportCorrectionText(text,window.__estimateCorrectionPendingMode||'merge');
      closeEstimateCorrectionImporter();
    }catch(e){alert('Correction import failed: '+(e.message||e));}
  };
  function getCorrections(){try{return (typeof routeEstimateCorrections==='function'?routeEstimateCorrections():JSON.parse(localStorage.getItem('asset_tracker_v37_manual_estimate_corrections_v1')||'{}'))||{};}catch(e){return {};}}
  function setCorrections(obj){try{if(typeof saveRouteEstimateCorrections==='function')saveRouteEstimateCorrections(obj||{});else localStorage.setItem('asset_tracker_v37_manual_estimate_corrections_v1',JSON.stringify(obj||{}));}catch(e){}}
  function correctionRows(){
    const all=getCorrections();
    return Object.entries(all||{}).filter(([k,v])=>k&&v&&typeof v==='object');
  }
  function correctionStats(){
    const rows=correctionRows();
    let moved=0,hidden=0,virtual=0,record=0,auto=0;
    for(const [k,v] of rows){
      if(k.startsWith('V:'))virtual++; else if(k.startsWith('R:'))record++;
      if(v.hidden)hidden++;
      if(v.autoAligned)auto++;
      if(Number.isFinite(Number(v.lat))&&Number.isFinite(Number(v.lng))&&!v.hidden)moved++;
    }
    return {total:rows.length,moved,hidden,virtual,record,auto};
  }
  function parseVirtualKey(key){
    const m=String(key||'').match(/^V:(.*):([^:]+)$/);
    if(!m)return null;
    const plateNum=Number(m[2]);
    return {line:m[1]||'',plate:Number.isFinite(plateNum)?plateNum:m[2]};
  }
  function originalishRecord(r){
    if(!r||typeof r!=='object')return {};
    // Keep normalised app fields as well so the corrected JSON re-imports quickly and predictably.
    try{return JSON.parse(JSON.stringify(r));}catch(e){return {...r};}
  }
  function applyCorrectionToRecord(rec,key,c){
    const lat=Number(c&&c.lat), lng=Number(c&&c.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||!rec)return rec;
    rec.__lat=lat; rec.__lng=lng; rec.__hasGPS=true;
    rec.LATITUDE=lat; rec.LONGITUDE=lng;
    rec.GPS_LATITUDE=lat; rec.GPS_LONGITUDE=lng;
    rec.APP_ESTIMATE_CORRECTION='manual';
    rec.APP_ESTIMATE_CORRECTION_KEY=key;
    rec.APP_ESTIMATE_CORRECTION_UPDATED_AT=c.updatedAt||new Date().toISOString();
    if(rec.original&&typeof rec.original==='object'){
      rec.original={...rec.original,LATITUDE:lat,LONGITUDE:lng,GPS_LATITUDE:lat,GPS_LONGITUDE:lng,APP_ESTIMATE_CORRECTION:'manual',APP_ESTIMATE_CORRECTION_KEY:key};
    }
    return rec;
  }
  function virtualRecordFromCorrection(key,c){
    const lat=Number(c&&c.lat), lng=Number(c&&c.lng), parsed=parseVirtualKey(key);
    if(!parsed||!Number.isFinite(lat)||!Number.isFinite(lng)||c.hidden)return null;
    const plate=String(parsed.plate);
    const line=String(parsed.line||'');
    return {
      __kind:'pole',
      __line:line,
      __lines:[line].filter(Boolean),
      __pole:plate,
      __title:'Estimated missing '+plate,
      __lat:lat,
      __lng:lng,
      __hasGPS:true,
      LINE_NAME:line,
      STRUCTURE_LABEL:plate,
      NAMEPLATE_ID:plate,
      LATITUDE:lat,
      LONGITUDE:lng,
      GPS_LATITUDE:lat,
      GPS_LONGITUDE:lng,
      APP_CREATED_RECORD:'true',
      APP_ESTIMATE_TYPE:'manual-corrected-missing-number',
      APP_ESTIMATE_WARNING:'App-created estimate only. No matching source record existed in the imported data.',
      APP_ESTIMATE_CORRECTION_KEY:key,
      APP_ESTIMATE_CORRECTION_UPDATED_AT:c.updatedAt||new Date().toISOString(),
      __search:[line,plate,'estimated missing app corrected'].join(' '),
      __compact:[line,plate,'estimated'].join('').replace(/[^A-Za-z0-9]/g,'').toUpperCase()
    };
  }
  window.renderCorrectionSettings=function renderCorrectionSettings(){
    const el=document.getElementById('correctionStats');
    if(!el)return;
    const st=correctionStats();
    el.innerHTML=`<div class="correction-stat-grid"><span><b>${Number(st.total).toLocaleString()}</b><small>saved corrections</small></span><span><b>${Number(st.moved).toLocaleString()}</b><small>moved GPS positions</small></span><span><b>${Number(st.hidden).toLocaleString()}</b><small>hidden estimates</small></span><span><b>${Number(st.virtual).toLocaleString()}</b><small>missing-number estimates</small></span></div>`;
  };
  window.exportEstimateCorrections=function exportEstimateCorrections(){
    const corrections=getCorrections();
    const stats=correctionStats();
    const data={
      type:'field-map-estimate-corrections',
      version:'3.8.8',
      exportedAt:new Date().toISOString(),
      correctionCount:stats.total,
      movedCount:stats.moved,
      hiddenCount:stats.hidden,
      recordCount:(window.allRecords||allRecords||[]).length,
      corrections
    };
    if(downloadJSON('field-map-estimate-corrections-'+nowStamp()+'.json',data,'Estimate corrections export'))showToolStatus?.('Estimate corrections exported. Saved/exported through Field MAP export system.');
  };
  function extractCorrectionsFromImport(data){
    if(!data)return null;
    if(data.type==='field-map-estimate-corrections'&&data.corrections)return data.corrections;
    if(data.estimateCorrections)return data.estimateCorrections;
    if(data.corrections&&typeof data.corrections==='object')return data.corrections;
    // Allow raw correction map.
    if(typeof data==='object'&&!Array.isArray(data)){
      const keys=Object.keys(data);
      if(keys.some(k=>/^([RV]):/.test(k)))return data;
    }
    return null;
  }
  window.importEstimateCorrectionsFromInput=async function importEstimateCorrectionsFromInput(mode){
    const input=document.getElementById('estimateCorrectionFileInput');
    const file=input&&input.files&&input.files[0];
    if(!file){document.getElementById('estimateCorrectionFileInput')?.click();return;}
    try{
      const text=await file.text();
      parseAndImportCorrectionText(text,mode||'merge');
      if(input)input.value='';
      window.__estimateCorrectionPendingMode='merge';
    }catch(e){alert('Correction import failed: '+(e.message||e));}
  };
  window.clearEstimateCorrections=function clearEstimateCorrections(){
    const st=correctionStats();
    if(!st.total){showToolStatus?.('No estimate corrections to clear.');return;}
    if(!confirm(`Clear ${st.total.toLocaleString()} saved estimate correction${st.total===1?'':'s'} from this device?`))return;
    setCorrections({});
    renderCorrectionSettings();
    showToolStatus?.('Estimate corrections cleared locally.');
    try{routeRefreshCurrentAfterEstimateChange?.();}catch(e){}
  };
  window.createCorrectedAssetJSON=function createCorrectedAssetJSON(){
    try{
      const records=(window.allRecords||allRecords||[]);
      if(!records.length){alert('No imported records loaded. Import data first.');return;}
      const corrections=getCorrections();
      const corrected=records.map(originalishRecord);
      let baked=0,hidden=0,virtualAdded=0;
      for(const [key,c] of Object.entries(corrections||{})){
        if(!c||typeof c!=='object')continue;
        if(c.hidden){hidden++;continue;}
        if(key.startsWith('R:')){
          const idx=Number(key.slice(2));
          if(Number.isInteger(idx)&&idx>=0&&idx<corrected.length&&Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lng))){
            applyCorrectionToRecord(corrected[idx],key,c);baked++;
          }
        }else if(key.startsWith('V:')){
          const v=virtualRecordFromCorrection(key,c);
          if(v){corrected.push(v);virtualAdded++;baked++;}
        }
      }
      const data={
        type:'field-map-corrected-asset-json',
        version:'3.8.8',
        exportedAt:new Date().toISOString(),
        sourceRecordCount:records.length,
        exportedRecordCount:corrected.length,
        bakedCorrectionCount:baked,
        hiddenCorrectionCount:hidden,
        virtualEstimateRecordCount:virtualAdded,
        warning:'Corrected estimate coordinates are app/user corrections. Verify before field use.',
        estimateCorrections:corrections,
        records:corrected
      };
      if(downloadJSON('field-map-corrected-assets-'+nowStamp()+'.json',data,'Corrected asset JSON export')){
        showToolStatus?.(`Corrected JSON created: ${corrected.length.toLocaleString()} records | ${baked.toLocaleString()} correction${baked===1?'':'s'} baked in. Saved/exported through Field MAP export system.`);
      }
    }catch(e){alert('Corrected JSON export failed: '+(e.message||e));}
  };
})();
