/* Asset Editor module
   - Isolated full-page editor for selected map/search assets.
   - Opens only after double pressing the Edit button on an asset card.
   - Allows editing every imported field, adding fields, deleting asset, and adding a new asset.
*/
let assetEditorUnlockTimer=null;
let assetEditorPendingIndex=null;
let assetEditorIndex=-1;
let assetEditorOriginal=null;



function genericFieldIsHidden(key){
  const u=String(key||'').toUpperCase();
  if(u.startsWith('__'))return true;
  return /(OWNER|AER_NSP|COMPANY|ORGANISATION|ORGANIZATION|BUSINESS|UTILITY|NETWORK_OPERATOR|POWER|ELECTRICITY|NETWORK_OWNER)/.test(u);
}

function genericFieldLabel(key){
  const raw=String(key||'');
  const u=raw.toUpperCase();
  const map={
    LINE_NAME:'ROUTE NAME',LINE_NAME_1:'ROUTE NAME 1',LINE_NAME_2:'ROUTE NAME 2',LINE_NAME_3:'ROUTE NAME 3',LINE:'ROUTE',CIRCUIT:'ROUTE',CIRCUIT_NAME:'ROUTE NAME',FEEDER:'GROUP',FEEDER_NAME:'GROUP NAME',
    STRUCTURE_LABEL:'POINT LABEL',EQUIP_NO:'ASSET ID',PARENT_EQUIP_NO:'PARENT ASSET ID',NAMEPLATE_ID_1:'POINT ID 1',NAMEPLATE_ID_2:'POINT ID 2',NAMEPLATE_ID_3:'POINT ID 3',OBJECTID:'OBJECT ID',
    POLE_HEIGHT_M:'HEIGHT M',POLE_LEN_M:'LENGTH M',TOWER_HEIGHT:'HEIGHT',STRUC_TYP_DESC:'TYPE DETAIL',SUB_STRUC_DESC:'SUBTYPE DETAIL',STRUC_CAT_DESC:'CATEGORY DETAIL',MATRL_TYP_DESC:'MATERIAL',
    CONDUCTOR_ID_DESC:'DETAIL DESC',STRUNG_SECTION_TYP_ID_DESC:'SECTION DETAIL',SUBSTATION:'SITE',SUBSTATION_NAME:'SITE NAME',TERMINAL:'SITE',TERMINAL_NAME:'SITE NAME',DEPOT:'BASE',DEPOT_NAME:'BASE NAME',
    OWNER:'SOURCE',AER_NSP:'SOURCE',TS_DRWG_NO:'DRAWING NO',NP_DWG_NO:'DRAWING NO',FOUNDATION_DWG_NO:'DRAWING NO'
  };
  if(map[u])return map[u];
  let out=raw.replace(/^__/, '').replace(/_/g,' ');
  out=out.replace(/\bLINES\b/gi,'ROUTES').replace(/\bLINE\b/gi,'ROUTE').replace(/\bCIRCUIT\b/gi,'ROUTE').replace(/\bPOLES\b/gi,'POINTS').replace(/\bPOLE\b/gi,'POINT').replace(/\bTOWERS\b/gi,'STRUCTURES').replace(/\bTOWER\b/gi,'STRUCTURE').replace(/\bSUBSTATIONS\b/gi,'SITES').replace(/\bSUBSTATION\b/gi,'SITE').replace(/\bTERMINALS\b/gi,'SITES').replace(/\bTERMINAL\b/gi,'SITE').replace(/\bCONDUCTORS\b/gi,'DETAILS').replace(/\bCONDUCTOR\b/gi,'DETAIL').replace(/\bDEPOTS\b/gi,'BASES').replace(/\bDEPOT\b/gi,'BASE');
  return out.toUpperCase();
}

function assetEditorEnsurePage(){
  let page=document.getElementById('assetEditorPage');
  if(page) return page;
  page=document.createElement('div');
  page.id='assetEditorPage';
  page.className='full-page asset-editor-page';
  page.innerHTML=`
    <div class="full-head asset-editor-head">
      <button class="asset-editor-back" onclick="closeAssetEditor()">←</button>
      <div><b id="assetEditorTitle">Edit Asset</b><span id="assetEditorSub">All visible fields</span></div>
    </div>
    <div class="full-body asset-editor-body has-scroll-indicator">
      <div id="assetEditorContent"></div>
    </div>`;
  document.body.appendChild(page);
  return page;
}

function assetEditorUnlock(index){
  index=Number(index);
  if(!Number.isInteger(index)||index<0||index>=allRecords.length){
    showToolStatus('No asset selected to edit.');
    return;
  }
  const now=Date.now();
  if(assetEditorPendingIndex===index && assetEditorUnlockTimer && now-assetEditorUnlockTimer<2200){
    assetEditorPendingIndex=null;
    assetEditorUnlockTimer=null;
    openAssetEditor(index);
    return;
  }
  assetEditorPendingIndex=index;
  assetEditorUnlockTimer=now;
  showToolStatus('Edit locked — press Edit again to unlock.');
  const btn=document.querySelector('[data-asset-edit-btn]');
  if(btn){
    btn.classList.add('asset-edit-armed');
    btn.textContent='Press again to unlock';
    setTimeout(()=>{
      if(assetEditorPendingIndex===index){
        assetEditorPendingIndex=null;
        assetEditorUnlockTimer=null;
        btn.classList.remove('asset-edit-armed');
        btn.textContent='Data Correction Edit';
      }
    },2200);
  }
}

function openAssetEditor(index){
  index=Number(index);
  if(!Number.isInteger(index)||index<0||index>=allRecords.length)return;
  assetEditorIndex=index;
  selected=allRecords[index];
  assetEditorOriginal=JSON.parse(JSON.stringify(selected||{}));
  const page=assetEditorEnsurePage();
  page.classList.add('open');
  renderAssetEditor();
}

function closeAssetEditor(){
  const page=document.getElementById('assetEditorPage');
  if(page)page.classList.remove('open');
  assetEditorIndex=-1;
  assetEditorOriginal=null;
  if(selected)renderAsset(selected);
}

function assetEditorFieldPriority(record){
  const preferred=[
    'LINE_NAME','LINE_NAME_1','LINE_NAME_2','LINE_NAME_3','ABBREVIATION','CIRCUIT','CIRCUIT_NAME','FEEDER','FEEDER_NAME',
    'STRUCTURE_LABEL','EQUIP_NO','PARENT_EQUIP_NO','NAMEPLATE_ID_1','NAMEPLATE_ID_2','NAMEPLATE_ID_3','OBJECTID',
    'LATITUDE','LONGITUDE','GPS','GPS_COORDS','EASTING','NORTHING','EASTING_COORD','NORTHING_COORD','COORD_ZONE',
    'POLE_HEIGHT_M','POLE_LEN_M','STRUC_TYP_DESC','SUB_STRUC_DESC','MATRL_TYP_DESC','CONDUCTOR_ID_DESC','STRUNG_SECTION_TYP_ID_DESC',
    'EQUIP_STATUS','OWNER','AER_NSP','MAINTENANCE_ZONE','FIRE_RISK_ZONE_RATING','NP_DWG_NO','TS_DRWG_NO','FOUNDATION_DWG_NO'
  ];
  const keys=Object.keys(record||{}).filter(k=>!(typeof genericFieldIsHidden==='function'?genericFieldIsHidden(k):String(k).startsWith("__")));
  const used=new Set();
  const ordered=[];
  preferred.forEach(k=>{
    const real=keys.find(x=>String(x).toLowerCase()===String(k).toLowerCase());
    if(real&&!used.has(real)){ordered.push(real);used.add(real);}
  });
  keys.sort((a,b)=>String(a).localeCompare(String(b))).forEach(k=>{if(!used.has(k)){ordered.push(k);used.add(k);}});
  return ordered;
}

function renderAssetEditor(){
  const page=assetEditorEnsurePage();
  const r=allRecords[assetEditorIndex]||{};
  document.getElementById('assetEditorTitle').textContent=getStructure(r)||'Edit Asset';
  document.getElementById('assetEditorSub').textContent=(getLine(r)||'Selected asset')+' • '+assetEditorFieldPriority(r).length+' visible fields';
  const keys=assetEditorFieldPriority(r);
  const content=document.getElementById('assetEditorContent');
  content.innerHTML=`
    <div class="asset-editor-actions-top">
      <button class="green" onclick="saveAssetEditor()">Save Changes</button>
      <button class="secondary" onclick="addAssetEditorField()">Add Field</button>
      <button class="clay" onclick="createNewAssetFromEditor()">Add New Asset</button>
      <button class="redbtn" onclick="deleteAssetEditorAsset()">Delete Asset</button>
    </div>
    <div class="asset-editor-help">Edit imported information here — ID, route, GPS, drawing, material, status, or custom fields. System fields are kept hidden to keep this screen generic.</div>
    <div id="assetEditorRows" class="asset-editor-rows">
      ${keys.map(k=>assetEditorRowHTML(k,r[k])).join('')}
    </div>
    <div class="asset-editor-actions-bottom">
      <button class="green" onclick="saveAssetEditor()">Save Changes</button>
      <button class="secondary" onclick="closeAssetEditor()">Cancel</button>
    </div>`;
}

function assetEditorRowHTML(key,value){
  const existing=!!key;
  const safeLabel=existing?genericFieldLabel(key):'';
  return `<div class="asset-editor-row">
    <input class="asset-editor-key" data-real-key="${esc(existing?key:'')}" value="${esc(safeLabel)}" placeholder="FIELD NAME" autocomplete="off" autocapitalize="characters" spellcheck="false" ${existing?'readonly':''} />
    <textarea class="asset-editor-value" placeholder="Value...">${esc(value==null?'':String(value))}</textarea>
  </div>`;
}

function addAssetEditorField(){
  const rows=document.getElementById('assetEditorRows');
  if(!rows)return;
  rows.insertAdjacentHTML('beforeend',assetEditorRowHTML('',''));
  const last=rows.querySelector('.asset-editor-row:last-child .asset-editor-key');
  if(last)last.focus();
}

function collectAssetEditorRecord(){
  const out=assetEditorOriginal?JSON.parse(JSON.stringify(assetEditorOriginal)):{};
  document.querySelectorAll('#assetEditorRows .asset-editor-row').forEach(row=>{
    const keyEl=row.querySelector('.asset-editor-key');
    const k=(keyEl?.dataset?.realKey||keyEl?.value||'').trim();
    const v=row.querySelector('.asset-editor-value')?.value ?? '';
    if(k) out[k]=v;
  });
  return out;
}

async function persistAssetEditorChanges(message){
  showBusyOverlay('Please wait...',message||'Saving asset changes...');
  await sleepFrame();
  try{
    updateBusy('Rebuilding search index...');
    if(typeof rebuildIndexAsync==='function') await rebuildIndexAsync(); else rebuildIndex();
    updateBusy('Saving locally...');
    if(typeof saveRecordsToIndexedDB==='function'){
      await saveRecordsToIndexedDB(allRecords,(done,total)=>updateBusy(`Saving locally ${done.toLocaleString()} / ${total.toLocaleString()} records...`));
    }else save();
    updateBusy('Writing editor JSON...');
    if(typeof writeAssetEditorPatchFile==='function') await writeAssetEditorPatchFile(message||'Asset editor change');
    updateKPIs();
    if(typeof renderSettingsStats==='function')renderSettingsStats();
    await finishBusyOverlay('Asset changes saved');
  }catch(e){
    console.error(e);
    hideBusyOverlay();
    alert('Save failed: '+(e.message||e));
  }
}

async function saveAssetEditor(){
  if(assetEditorIndex<0||assetEditorIndex>=allRecords.length)return;
  const before=assetEditorOriginal?JSON.parse(JSON.stringify(assetEditorOriginal)):null;
  const edited=collectAssetEditorRecord();
  edited.__editedAt=new Date().toISOString();
  if(!before) edited.__createdAt=edited.__createdAt||new Date().toISOString();
  allRecords[assetEditorIndex]=edited;
  selected=edited;
  if(typeof recordAssetEditorChange==='function') recordAssetEditorChange(before?'update':'create',assetEditorIndex,before,edited);
  await persistAssetEditorChanges(before?'Saving edited asset...':'Saving new asset...');
  if(typeof refreshEditedAssetDot==='function')refreshEditedAssetDot(assetEditorIndex,edited);
  assetEditorOriginal=JSON.parse(JSON.stringify(edited));
  renderAssetEditor();
  showToolStatus('Asset saved.');
}

async function deleteAssetEditorAsset(){
  if(assetEditorIndex<0||assetEditorIndex>=allRecords.length)return;
  const r=allRecords[assetEditorIndex];
  if(!confirm('Delete this asset?\n\n'+(getStructure(r)||'Selected asset')+'\n'+(getLine(r)||'')))return;
  if(typeof recordAssetEditorChange==='function') recordAssetEditorChange('delete',assetEditorIndex,r,null);
  allRecords.splice(assetEditorIndex,1);
  selected=null;
  selectedMarker=null;
  assetEditorIndex=-1;
  await persistAssetEditorChanges('Deleting asset...');
  document.getElementById('assetEditorPage')?.classList.remove('open');
  renderSearch();
  showToolStatus('Asset deleted.');
}

function createNewAssetFromEditor(){
  const base={
    ROUTE_NAME:'',
    POINT_ID:'',
    ASSET_ID:'',
    LATITUDE:'',
    LONGITUDE:'',
    DETAIL_DESC:'',
    TYPE_DETAIL:'',
    MATERIAL:'',
    HEIGHT_M:'',
    EQUIP_STATUS:'',
    NOTES:''
  };
  allRecords.push(base);
  assetEditorIndex=allRecords.length-1;
  assetEditorOriginal=null;
  selected=base;
  renderAssetEditor();
  showToolStatus('New blank asset created — fill details then save.');
}

function assetEditorAddButtonHTML(index){
  return `<button class="sun" data-asset-edit-btn onclick="assetEditorUnlock(${index})">Data Correction Edit</button>`;
}


/* v3.3.5 Data Corrections module
   Opens from Map controls. Add/edit/delete assets using the same editor fields.
   Changes save locally and to the chosen folder JSON patch where supported.
*/
let dataCorrectionTapAddArmed=false;

function ensureDataCorrectionsPage(){
  let page=document.getElementById('dataCorrectionsPage');
  if(page)return page;
  page=document.createElement('div');
  page.id='dataCorrectionsPage';
  page.className='full-page data-corrections-page';
  page.innerHTML=`
    <div class="full-head data-corrections-head">
      <button class="asset-editor-back" onclick="closeDataCorrections()">←</button>
      <div><b>Data Corrections</b><span>Add, edit or delete map assets</span></div>
    </div>
    <div class="full-body data-corrections-body has-scroll-indicator">
      <div id="dataCorrectionsContent"></div>
    </div>`;
  document.body.appendChild(page);
  return page;
}

function openDataCorrections(){
  const page=ensureDataCorrectionsPage();
  page.classList.add('open');
  renderDataCorrections();
}

function closeDataCorrections(){
  dataCorrectionTapAddArmed=false;
  document.getElementById('dataCorrectionsPage')?.classList.remove('open');
}

function dcSelectedIndex(){
  if(!selected)return -1;
  return allRecords.indexOf(selected);
}

function renderDataCorrections(){
  const c=document.getElementById('dataCorrectionsContent');
  if(!c)return;
  const idx=dcSelectedIndex();
  const r=idx>=0?allRecords[idx]:null;
  const sel=r?`${esc(getStructure(r)||'Asset')}<br><small>${esc(getLine(r)||'No route')} ${hasGPS(r)?' • GPS ready':' • no GPS'}</small>`:'No asset selected. Tap an asset on the map first, or add a new one.';
  c.innerHTML=`
    <div class="data-correction-card">
      <h3>Selected Asset</h3>
      <div class="data-correction-selected">${sel}</div>
      <div class="data-correction-grid">
        <button class="green" onclick="dataCorrectionEditSelected()">Edit Selected</button>
        <button class="redbtn" onclick="dataCorrectionDeleteSelected()">Delete Selected</button>
      </div>
    </div>
    <div class="data-correction-card">
      <h3>Add Asset / Dot</h3>
      <p>Create a new asset using the same editable fields. GPS can be from the map centre, your current GPS, or the next tap on the map.</p>
      <div class="data-correction-grid">
        <button class="clay" onclick="dataCorrectionAddAtMapCentre()">Add at Map Centre</button>
        <button class="sky" onclick="dataCorrectionAddAtCurrentGPS()">Add at My GPS</button>
        <button class="secondary" onclick="dataCorrectionArmTapToAdd()">Tap Map to Add</button>
        <button class="green" onclick="dataCorrectionAddBlank()">Add Blank Asset</button>
      </div>
    </div>
    <div class="data-correction-card">
      <h3>Save Behaviour</h3>
      <p>Corrections save inside the app and also write the editor correction JSON to your chosen folder when browser folder access is available.</p>
    </div>`;
}

function dataCorrectionEditSelected(){
  const idx=dcSelectedIndex();
  if(idx<0){showToolStatus('Select an asset first.');return;}
  closeDataCorrections();
  openAssetEditor(idx);
}

async function dataCorrectionDeleteSelected(){
  const idx=dcSelectedIndex();
  if(idx<0){showToolStatus('Select an asset first.');return;}
  const r=allRecords[idx];
  if(!confirm('Delete this asset/dot?\n\n'+(getStructure(r)||'Selected asset')+'\n'+(getLine(r)||'')))return;
  if(typeof recordAssetEditorChange==='function')recordAssetEditorChange('delete',idx,r,null);
  removeAssetDotForIndex(idx);
  allRecords.splice(idx,1);
  selected=null;selectedMarker=null;
  await persistAssetEditorChanges('Deleting asset from Data Corrections...');
  renderDataCorrections();
  showToolStatus('Asset deleted.');
}

function dataCorrectionBaseRecord(lat,lng){
  const now=new Date().toISOString();
  const r={
    ROUTE_NAME:'',
    POINT_ID:'',
    ASSET_ID:'',
    LATITUDE: lat==null?'':String(lat),
    LONGITUDE: lng==null?'':String(lng),
    DETAIL_DESC:'',
    TYPE_DETAIL:'',
    MATERIAL:'',
    HEIGHT_M:'',
    EQUIP_STATUS:'DATA_CORRECTION',
    NOTES:'Added from Data Corrections',
    __createdAt:now,
    __editedAt:now,
    __source:'data-correction'
  };
  return r;
}

function dataCorrectionOpenNew(r){
  allRecords.push(r);
  selected=r;
  const idx=allRecords.length-1;
  if(typeof recordAssetEditorChange==='function')recordAssetEditorChange('create',idx,null,r);
  closeDataCorrections();
  if(hasGPS(r))dataCorrectionAddDot(idx,r);
  openAssetEditor(idx);
}

function dataCorrectionAddBlank(){
  dataCorrectionOpenNew(dataCorrectionBaseRecord(null,null));
}

function dataCorrectionAddAtMapCentre(){
  if(!map||!map.getCenter){dataCorrectionAddBlank();return;}
  const c=map.getCenter();
  dataCorrectionOpenNew(dataCorrectionBaseRecord(Number(c.lat).toFixed(7),Number(c.lng).toFixed(7)));
}

function dataCorrectionAddAtCurrentGPS(){
  if(!navigator.geolocation){showToolStatus('GPS unavailable.');return;}
  showBusyOverlay('Please wait...','Getting GPS location...');
  navigator.geolocation.getCurrentPosition(p=>{
    hideBusyOverlay();
    dataCorrectionOpenNew(dataCorrectionBaseRecord(Number(p.coords.latitude).toFixed(7),Number(p.coords.longitude).toFixed(7)));
  },e=>{
    hideBusyOverlay();
    alert('GPS failed: '+e.message);
  },{enableHighAccuracy:true,timeout:12000,maximumAge:3000});
}

function dataCorrectionArmTapToAdd(){
  closeDataCorrections();
  dataCorrectionTapAddArmed=true;
  showToolStatus('Tap the map where the new asset/dot should go.');
  if(map&&map.once){
    map.once('click',e=>{
      if(!dataCorrectionTapAddArmed)return;
      dataCorrectionTapAddArmed=false;
      dataCorrectionOpenNew(dataCorrectionBaseRecord(Number(e.latlng.lat).toFixed(7),Number(e.latlng.lng).toFixed(7)));
    });
  }
}

function dataCorrectionAddDot(idx,r){
  try{
    if(!hasGPS(r)||!assetLayer)return;
    const m=L.circleMarker([getLat(r),getLng(r)],{radius:7,weight:3,fillOpacity:.95,color:'#d07a2c'}).addTo(assetLayer);
    m.bindTooltip(getStructure(r)||'New asset');
    if(typeof bindAssetMiniPopup==='function')bindAssetMiniPopup(m,idx);
    selectedMarker=m;
    if(map&&map.setView)map.setView([getLat(r),getLng(r)],17);
  }catch(e){console.warn('Data correction dot add failed',e);}
}

function removeAssetDotForIndex(idx){
  try{
    if(selectedMarker&&assetLayer&&assetLayer.hasLayer(selectedMarker))assetLayer.removeLayer(selectedMarker);
    if(assetLayer&&assetLayer.eachLayer){
      const remove=[];
      assetLayer.eachLayer(l=>{if(l&&l._assetRecordIndex===idx)remove.push(l);});
      remove.forEach(l=>assetLayer.removeLayer(l));
    }
  }catch(e){console.warn('Dot removal failed',e);}
}

function refreshEditedAssetDot(idx,r){
  if(!Number.isInteger(idx)||idx<0||idx>=allRecords.length)return;
  removeAssetDotForIndex(idx);
  if(hasGPS(r))dataCorrectionAddDot(idx,r);
}
