/* Export Folder module
   Saves editor changes as a lightweight JSON patch file in the folder chosen in Settings.
   Uses the File System Access API where supported. Falls back to device/local storage when not supported.
*/
const EXPORT_HANDLE_DB='asset_tracker_v35_export_folder_db';
const EXPORT_HANDLE_STORE='handles';
const EXPORT_HANDLE_KEY='assetTrackerFolder';
const EDIT_LOG_KEY='asset_tracker_v35_editor_change_log_v1';
let exportDirectoryHandle=null;
let exportFolderReady=false;

function exportDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(EXPORT_HANDLE_DB,1);
    req.onupgradeneeded=()=>{req.result.createObjectStore(EXPORT_HANDLE_STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function saveExportHandle(handle){
  const db=await exportDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(EXPORT_HANDLE_STORE,'readwrite');
    tx.objectStore(EXPORT_HANDLE_STORE).put(handle,EXPORT_HANDLE_KEY);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
async function loadExportHandle(){
  try{
    const db=await exportDB();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(EXPORT_HANDLE_STORE,'readonly');
      const req=tx.objectStore(EXPORT_HANDLE_STORE).get(EXPORT_HANDLE_KEY);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
  }catch(e){return null;}
}
async function verifyExportPermission(handle,write=false){
  if(!handle)return false;
  const opts={mode:write?'readwrite':'read'};
  if((await handle.queryPermission(opts))==='granted')return true;
  if((await handle.requestPermission(opts))==='granted')return true;
  return false;
}
async function getAssetTrackerSubfolder(rootHandle){
  if(!rootHandle)return null;
  try{
    return await rootHandle.getDirectoryHandle('Field MAP',{create:true});
  }catch(e){
    console.warn('Could not create Asset Tracker subfolder, using chosen folder.',e);
    return rootHandle;
  }
}
async function chooseSaveFolder(){
  if(!window.showDirectoryPicker){
    alert('Folder saving is not supported in this browser/WebView. Use Chrome/Edge over HTTPS or installed PWA mode. Edits will still save inside the app locally.');
    return;
  }
  try{
    const root=await window.showDirectoryPicker({id:'field-map-save-folder',mode:'readwrite'});
    if(!(await verifyExportPermission(root,true))){alert('Folder permission was not granted.');return;}
    const folder=await getAssetTrackerSubfolder(root);
    await saveExportHandle(folder);
    exportDirectoryHandle=folder;
    exportFolderReady=true;
    showToolStatus('Save folder set: Field MAP');
    await writeAssetEditorPatchFile('Folder selected');
    if(typeof renderSettingsStats==='function')renderSettingsStats();
  }catch(e){
    if(e && e.name==='AbortError')return;
    console.error(e);
    alert('Could not choose folder: '+(e.message||e));
  }
}
async function ensureExportFolder(write=false){
  if(!window.showDirectoryPicker)return null;
  if(!exportDirectoryHandle)exportDirectoryHandle=await loadExportHandle();
  if(!exportDirectoryHandle)return null;
  const ok=await verifyExportPermission(exportDirectoryHandle,write);
  exportFolderReady=!!ok;
  return ok?exportDirectoryHandle:null;
}
async function testSaveFile(){
  try{
    const folder=await ensureExportFolder(true);
    if(!folder){alert('Choose a save folder first.');return;}
    const file=await folder.getFileHandle('field-map-test-save.txt',{create:true});
    const writable=await file.createWritable();
    await writable.write('Field MAP test save OK\n'+new Date().toISOString());
    await writable.close();
    showToolStatus('Test file saved.');
  }catch(e){console.error(e);alert('Test save failed: '+(e.message||e));}
}
function getEditorLog(){
  try{return JSON.parse(localStorage.getItem(EDIT_LOG_KEY)||'[]')||[];}catch(e){return [];}
}
function setEditorLog(log){
  try{localStorage.setItem(EDIT_LOG_KEY,JSON.stringify(log.slice(-1000)));}catch(e){console.warn('Editor log local save failed',e);}
}
function compactRecordForPatch(r){
  if(!r)return null;
  const out={};
  Object.keys(r).forEach(k=>{ if(r[k]!==undefined) out[k]=r[k]; });
  return out;
}
function assetStableId(record,index){
  if(!record) return 'asset-'+index;
  return String(record.OBJECTID||record.EQUIP_NO||record.STRUCTURE_LABEL||record.NAMEPLATE_ID_1||record.NAMEPLATE_ID_2||record.NAMEPLATE_ID_3||((record.LINE_NAME||record.LINE_NAME_1||'LINE')+'|'+(record.LATITUDE||'')+'|'+(record.LONGITUDE||'')+'|'+index));
}
function recordAssetEditorChange(action,index,before,after){
  const log=getEditorLog();
  log.push({
    id:assetStableId(after||before,index),
    action,
    index,
    changedAt:new Date().toISOString(),
    before:compactRecordForPatch(before),
    after:compactRecordForPatch(after)
  });
  setEditorLog(log);
}
function buildAssetEditorPatchPayload(reason){
  const log=getEditorLog();
  const latestById={};
  log.forEach(entry=>{ latestById[entry.id]=entry; });
  return {
    fileType:'Asset Tracker Editor Patch',
    version:'1.0',
    exportedAt:new Date().toISOString(),
    reason:reason||'Asset editor change',
    recordCount:Array.isArray(allRecords)?allRecords.length:0,
    changeCount:log.length,
    latestChangeCount:Object.keys(latestById).length,
    changes:log,
    latestByAsset:Object.values(latestById)
  };
}
async function writeAssetEditorPatchFile(reason){
  const payload=buildAssetEditorPatchPayload(reason);
  const json=JSON.stringify(payload,null,2);
  try{
    const folder=await ensureExportFolder(true);
    if(!folder)return false;
    const file=await folder.getFileHandle('field-map-edits.json',{create:true});
    const writable=await file.createWritable();
    await writable.write(json);
    await writable.close();
    return true;
  }catch(e){
    console.warn('Could not write editor patch file',e);
    return false;
  }
}
async function initExportFolderModule(){
  exportDirectoryHandle=await loadExportHandle();
  if(exportDirectoryHandle){
    try{exportFolderReady=await verifyExportPermission(exportDirectoryHandle,false);}catch(e){exportFolderReady=false;}
  }
}
function exportFolderStatusText(){
  if(!window.showDirectoryPicker)return 'Folder save not supported';
  return exportDirectoryHandle?(exportFolderReady?'Folder ready':'Folder permission needed'):'No folder chosen';
}
