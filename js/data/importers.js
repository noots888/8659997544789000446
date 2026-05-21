/* Clean central import/storage layer. No blocking search index. v3.6.55 importer guard. */
function parseCSV(text){text=String(text||"").replace(/^\uFEFF/,"");let rows=[],row=[],field="",quote=false;for(let i=0;i<text.length;i++){let c=text[i],n=text[i+1];if(c==='"'&&quote&&n==='"'){field+='"';i++}else if(c==='"')quote=!quote;else if(c===","&&!quote){row.push(field);field=""}else if((c==="\n"||c==="\r")&&!quote){if(field.length||row.length){row.push(field);rows.push(row);row=[];field=""}if(c==="\r"&&n==="\n")i++}else field+=c}if(field.length||row.length)rows.push([...row,field]);let clean=rows.filter(r=>r.some(x=>String(x).trim()!==""));if(clean.length<2)return[];let h=clean[0].map(x=>String(x||"").trim());return clean.slice(1).map(cols=>{let o={};h.forEach((k,i)=>{if(k)o[k]=cols[i]??""});return o})}
function extractRecordsFromJSON(data){
  /* Deep JSON importer.
     The old importer only read a few top-level arrays, so valid assets buried in
     layers / featureSets / object maps were ignored. This walks the JSON tree,
     extracts real row-like objects, and keeps ArcGIS/GeoJSON geometry attached. */
  const out=[];
  const seenVisit=new WeakSet();
  const seenRows=new WeakSet();
  const rowKeys=/OBJECTID|GLOBALID|FACILITY|STRUCTURE|STRUC|NAMEPLATE|EQUIP|ASSET|POINT_ID|POINTID|POLE|TOWER|LINE_NAME|CIRCUIT|FEEDER|ROUTE|SUBSTATION|TERMINAL|DEPOT|CONDUCTOR|STRUNG|WIRE|CABLE|FIRST_NAME_PLATE|LAST_NAME_PLATE/i;
  // Do not treat raw geometry arrays as asset records. They are route vertices, not assets.
  const childArrayKeys=['features','records','data','results','items','layers','operationalLayers','tables','featureSet','featureCollection'];
  const recordArrayKeys=['features','records','data','results','items'];
  const diag={objects:0,arrays:0,rows:0,features:0,keyedRows:0,containers:0,maxDepth:0,duplicates:0,skippedGeometry:0,skippedNoIdentity:0};
  const geometryChildKeys=new Set(['geometry','coordinates','paths','rings','points','spatialreference','spatial_reference','bbox','extent','center']);
  function scalarCount(o){let n=0;for(const v of Object.values(o||{})){if(v!==null&&v!==undefined&&typeof v!=='object')n++;}return n;}
  function hasRowKey(o){return Object.keys(o||{}).some(k=>rowKeys.test(k));}
  function hasChildArrays(o){return childArrayKeys.some(k=>Array.isArray(o&&o[k]));}
  function isFeature(o){return !!(o&&typeof o==='object'&&!Array.isArray(o)&&(o.attributes||o.properties||o.geometry));}
  function cloneRow(o){
    if(!o||typeof o!=='object'||Array.isArray(o))return null;
    // Ignore ArcGIS/GeoJSON field schema rows. These are definitions, not assets.
    const ks=Object.keys(o||{}).map(k=>String(k).toLowerCase());
    if(ks.includes('name') && ks.includes('type') && (ks.includes('alias')||ks.includes('nullable')||ks.includes('editable')||ks.includes('length')) && !o.geometry && !hasRowKey(o))return null;

    // Raw geometry objects/vertices caused false GPS assets. Keep geometry only when it is attached to attributes/properties.
    if(!o.attributes&&!o.properties&&isGeometryOnlyImportObject(o)){diag.skippedGeometry++;return null;}

    if(o.attributes||o.properties){
      const base={...(o.attributes||{}),...(o.properties||{})};
      for(const k of ['id','ID','objectId','OBJECTID','name','Name','title']){
        if(o[k]!==undefined&&base[k]===undefined&&typeof o[k]!=='object')base[k]=o[k];
      }
      if(o.geometry!==undefined)base.geometry=o.geometry;
      if(isGeometryOnlyImportObject(base)){diag.skippedGeometry++;return null;}
      if(hasImportAssetIdentity(base) || hasUsefulNonGeometryAttrs(base))return stripRouteGeometry(base);
      diag.skippedNoIdentity++;
      return null;
    }

    if(hasImportAssetIdentity(o) || (hasRowKey(o) && hasUsefulNonGeometryAttrs(o)) || (hasUsefulNonGeometryAttrs(o) && !hasChildArrays(o))) return stripRouteGeometry(o);
    if(o.geometry || hasGeometryKeys(o)) diag.skippedGeometry++; else diag.skippedNoIdentity++;
    return null;
  }
  function pushRow(row,source,kind){
    if(!row||typeof row!=='object'||Array.isArray(row))return;
    const marker=source&&typeof source==='object'?source:row;
    if(marker&&typeof marker==='object'){
      if(seenRows.has(marker)){diag.duplicates++;return;}
      seenRows.add(marker);
    }
    out.push(row);
    diag.rows++;
    if(kind==='feature')diag.features++;
    if(kind==='keyed')diag.keyedRows++;
  }
  function tryArray(arr){
    if(!Array.isArray(arr))return 0;
    diag.arrays++;
    let accepted=0;
    for(const item of arr){
      if(!item||typeof item!=='object'||Array.isArray(item))continue;
      // Container/layer objects are not assets. Their child feature arrays are walked separately.
      if(hasChildArrays(item)||item.featureSet||item.featureCollection)continue;
      const row=cloneRow(item);
      if(row){pushRow(row,item,isFeature(item)?'feature':'plain');accepted++;}
    }
    return accepted;
  }
  function visit(node,depth=0){
    if(!node||depth>48)return;
    if(depth>diag.maxDepth)diag.maxDepth=depth;
    if(Array.isArray(node)){
      const accepted=tryArray(node);
      // If this was a flat record/feature array, do not descend into every feature geometry.
      // That was slow and made the audit report fake geometry skips.
      if(accepted>0)return;
      for(const item of node)visit(item,depth+1);
      return;
    }
    if(typeof node!=='object')return;
    if(seenVisit.has(node))return;
    seenVisit.add(node); diag.objects++;

    for(const k of recordArrayKeys){if(Array.isArray(node[k]))tryArray(node[k]);}
    if(node.records&&Array.isArray(node.records.records))tryArray(node.records.records);
    if(node.featureSet&&Array.isArray(node.featureSet.features))tryArray(node.featureSet.features);
    if(node.layerDefinition&&node.featureSet&&Array.isArray(node.featureSet.features))tryArray(node.featureSet.features);
    if(node.featureCollection&&Array.isArray(node.featureCollection.layers))visit(node.featureCollection.layers,depth+1);

    const container=hasChildArrays(node)||node.featureSet||node.featureCollection||node.layerDefinition;
    const row=cloneRow(node);
    if(row && (!container || isFeature(node) || hasRowKey(node))){
      pushRow(row,node,isFeature(node)?'feature':'keyed');
    }else if(container){diag.containers++;}

    for(const [k,v] of Object.entries(node)){
      if(!v||typeof v!=='object')continue;
      const key=String(k||'').toLowerCase();
      if(geometryChildKeys.has(key))continue;
      // Feature attributes/properties were already converted into a single row.
      if(isFeature(node) && (key==='attributes'||key==='properties'))continue;
      if((key==='attributes'||key==='properties') && !Object.values(v).some(x=>x&&typeof x==='object'))continue;
      visit(v,depth+1);
    }
  }
  visit(data,0);
  extractRecordsFromJSON.lastDiagnostics={...diag,extracted:out.length};
  return out;
}
function sleepFrame(){return new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)))}
function showBusyOverlay(title,detail,opts={}){let o=document.getElementById('busyOverlay');if(!o){o=document.createElement('div');o.id='busyOverlay';o.className='busy-overlay';document.body.appendChild(o)}o.innerHTML=`<div class="busy-card"><div class="busy-spinner"></div><div class="busy-title">${esc(title||'Please wait...')}</div><div id="busyDetail" class="busy-detail"></div></div>`;o.classList.add('show');updateBusy(detail||'Loading',opts)}
function updateBusy(detail,opts={}){const e=document.getElementById('busyDetail');if(!e)return;if(opts&&opts.html)e.innerHTML=detail||'';else e.textContent=detail||''}
function updateBusyHTML(html){updateBusy(html,{html:true})}
function hideBusyOverlay(){document.getElementById('busyOverlay')?.classList.remove('show')}
function finishBusyOverlay(detail){updateBusy(detail||'Done');return new Promise(r=>setTimeout(()=>{hideBusyOverlay();r()},650))}
function sourceFileSummary(records,max=12){
  const map=new Map();
  for(const r of (records||[])){
    const raw=(r&&((r.__sourceFile)||(r.original&&r.original.__sourceFile)||(r.SOURCE_FILE)||(r.sourceFile)||(r.fileName)||(r.filename)))||'';
    const name=String(raw||'').trim()||'Unknown source';
    map.set(name,(map.get(name)||0)+1);
  }
  return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,max).map(([name,count])=>({name,count}));
}
function autoIndexBusyHTML(progress,files){
  const list=(files&&files.length?files:sourceFileSummary(allRecords||[]));
  const fileHtml=list.length?list.map(f=>`<li><span>${esc(f.name)}</span>${Number.isFinite(f.count)?`<em>${Number(f.count).toLocaleString()}</em>`:''}</li>`).join(''):'<li><span>No saved source file names found yet</span></li>';
  return `<div class="busy-progress-text">${esc(progress||'Preparing index...')}</div><div class="busy-files"><b>Files being loaded</b><ul>${fileHtml}</ul></div>`;
}
function readFileAsText(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=e=>resolve(String(e.target.result||''));fr.onerror=()=>reject(fr.error||new Error('Could not read file'));fr.readAsText(file)})}
function normalizeSearch(s){return String(s||"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim()}
function normalizeCompact(s){return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function cleanObj(r){if(r&&r.original&&typeof r.original==='object')return {...r.original,...r};return {...r}}

const IMPORT_IDENTITY_KEY_RE=/(FACILITY|ASSET|EQUIP|STRUCTURE|STRUC|NAMEPLATE|POINT_ID|POINTID|POLE|TOWER|LINE_NAME|CIRCUIT|FEEDER|ROUTE|SUBSTATION|TERMINAL|DEPOT|ABBREVIATION|CONDUCTOR|STRUNG|WIRE|CABLE|FIRST_NAME_PLATE|LAST_NAME_PLATE|LABEL|TITLE)/i;
const IMPORT_POINT_IDENTITY_KEY_RE=/(FACILITY|ASSET|EQUIP|STRUCTURE|STRUC|NAMEPLATE|POINT_ID|POINTID|POLE|TOWER|SUBSTATION|TERMINAL|DEPOT|ABBREVIATION)/i;
const IMPORT_WEAK_KEY_RE=/^(OBJECTID|OBJECT_ID|FID|ID|GLOBALID|GLOBAL_ID|SHAPE__AREA|SHAPE__LENGTH)$/i;
const IMPORT_GEOM_KEY_RE=/^(x|y|z|m|xmin|ymin|xmax|ymax|lat|latitude|lng|lon|long|longitude|easting|northing|geometry|coordinates|rings|paths|points|spatialreference|spatial_reference|wkid|latestwkid|hasz|hasm|type|bbox)$/i;
function hasGeometryKeys(o){return Object.keys(o||{}).some(k=>IMPORT_GEOM_KEY_RE.test(String(k).replace(/[^A-Za-z0-9_]/g,'')));}
function nonGeometryScalarKeys(o){
  const out=[];
  for(const [k,v] of Object.entries(o||{})){
    const ck=String(k).replace(/[^A-Za-z0-9_]/g,'');
    if(v===null||v===undefined||typeof v==='object')continue;
    if(IMPORT_GEOM_KEY_RE.test(ck))continue;
    if(String(v).trim()==='')continue;
    out.push(k);
  }
  return out;
}
function isGeometryOnlyImportObject(o){
  if(!o||typeof o!=='object'||Array.isArray(o))return false;
  const keys=Object.keys(o);
  if(!keys.length)return false;
  const hasGeom=keys.some(k=>IMPORT_GEOM_KEY_RE.test(String(k).replace(/[^A-Za-z0-9_]/g,'')));
  if(!hasGeom)return false;
  const useful=nonGeometryScalarKeys(o).filter(k=>!IMPORT_WEAK_KEY_RE.test(k));
  return useful.length===0;
}
function hasImportAssetIdentity(o){
  if(!o||typeof o!=='object')return false;
  for(const [k,v] of Object.entries(o)){
    if(v===null||v===undefined||typeof v==='object')continue;
    const key=String(k);
    const val=String(v).trim();
    if(!val)continue;
    if(IMPORT_IDENTITY_KEY_RE.test(key) && !IMPORT_GEOM_KEY_RE.test(key))return true;
    if(/^(name|title)$/i.test(key) && val && !/^(point|line|string|number|object|geometry|feature)$/i.test(val))return true;
  }
  return false;
}
function hasImportPointIdentity(o){
  if(!o||typeof o!=='object')return false;
  for(const [k,v] of Object.entries(o)){
    if(v===null||v===undefined||typeof v==='object')continue;
    const key=String(k); const val=String(v).trim();
    if(val&&IMPORT_POINT_IDENTITY_KEY_RE.test(key)&&!IMPORT_GEOM_KEY_RE.test(key))return true;
  }
  return false;
}
function geometryValue(o){return o?.geometry||o;}
function arrayDepth(a){return Array.isArray(a)?1+Math.max(0,...a.map(arrayDepth)):0;}
function isNonPointGeometry(o){
  const g=geometryValue(o);
  if(!g||typeof g!=='object')return false;
  const type=String(g.type||o?.type||'').toLowerCase();
  if(/linestring|polygon|polyline|multipoint|multipolygon|multilinestring/.test(type))return true;
  if(g.paths||g.rings)return true;
  const coords=g.coordinates||o?.coordinates;
  if(Array.isArray(coords)&&arrayDepth(coords)>1)return true;
  return false;
}
function stripRouteGeometry(row){
  if(!row||typeof row!=='object')return row;
  if(!isNonPointGeometry(row))return row;
  if(hasImportPointIdentity(row))return row;
  const copy={...row};
  delete copy.geometry; delete copy.coordinates; delete copy.paths; delete copy.rings; delete copy.points;
  return copy;
}
function sanitizeImportedRecord(rec){
  if(!rec||typeof rec!=='object')return rec;
  const raw=rec.original&&typeof rec.original==='object'?rec.original:null;
  const target=raw||rec;
  if(isNonPointGeometry(target)&&!hasImportPointIdentity(target)){
    const cleaned={...rec};
    if(raw) cleaned.original=stripRouteGeometry(raw);
    delete cleaned.geometry; delete cleaned.coordinates; delete cleaned.paths; delete cleaned.rings; delete cleaned.points;
    cleaned.__lat=null; cleaned.__lng=null; cleaned.__hasGPS=false;
    return cleaned;
  }
  return rec;
}
function hasUsefulNonGeometryAttrs(o){
  const useful=nonGeometryScalarKeys(o).filter(k=>!IMPORT_WEAK_KEY_RE.test(k));
  if(useful.length>=2)return true;
  return useful.some(k=>IMPORT_IDENTITY_KEY_RE.test(k));
}
function importedRecordQuality(rec){
  const raw=rec?.original&&typeof rec.original==='object'?rec.original:rec;
  if(isGeometryOnlyImportObject(raw))return {ok:false,reason:'geometry-only'};
  if(hasImportAssetIdentity(raw))return {ok:true,reason:'identity'};
  if(String(rec?.__kind||'').toLowerCase()==='conductor' && hasUsefulNonGeometryAttrs(raw))return {ok:true,reason:'detail'};
  if(hasUsefulNonGeometryAttrs(raw))return {ok:true,reason:'attributes'};
  return {ok:false,reason:'no asset identity'};
}
function roundedCoord(v,dp=6){const n=Number(v);return Number.isFinite(n)?n.toFixed(dp):'';}
function importDedupeKey(rec){
  if(!rec||typeof rec!=='object')return'';
  const kind=normalizeCompact(rec.__kind||'asset');
  const line=normalizeCompact(rec.__line||rec.LINE_NAME||rec.line_name||rec.LINE||rec.CIRCUIT||rec.FEEDER||'');
  const structure=normalizeCompact(rec.__pole||rec.__title||rec.STRUCTURE_LABEL||rec.EQUIP_NO||rec.NAMEPLATE_ID||rec.NAMEPLATE_ID_1||rec.ASSET_ID||rec.FACILITYID||rec.POINT_ID||rec.LABEL||rec.NAME||'');
  const source=normalizeCompact(rec.__sourceFile||'');
  const objectId=normalizeCompact(rec.OBJECTID||rec.OBJECT_ID||rec.FID||rec.GLOBALID||rec.GLOBAL_ID||'');
  const titleIsWeak=!structure || /^(ASSET|UNKNOWNASSET|POINT|STRUCTURE|FEATURE)$/.test(structure);
  const lat=roundedCoord(rec.__lat), lng=roundedCoord(rec.__lng);
  if(kind==='CONDUCTOR'){
    const desc=normalizeCompact(rec.__conductor||rec.CONDUCTOR_ID_DESC||rec.STRUNG_SECTION_TYP_ID_DESC||rec.CONDUCTOR||'');
    const first=normalizeCompact(rec.FIRST_NAME_PLATE_ID||rec.FIRST_POLE||'');
    const last=normalizeCompact(rec.LAST_NAME_PLATE_ID||rec.LAST_POLE||'');
    if(source&&objectId)return `conductor|${source}|${objectId}`;
    if(line||desc||first||last)return `conductor|${source}|${line}|${desc}|${first}|${last}`;
  }
  // Safe dedupe only: include coordinates or a source/object id.
  // Do NOT remove records just because route + point label looks similar; that hid real assets on branches/re-used labels.
  if(source&&objectId)return `${kind}|${source}|${objectId}`;
  if(line && !titleIsWeak && lat && lng)return `${kind}|${line}|${structure}|${lat}|${lng}`;
  if(!titleIsWeak && lat && lng)return `${kind}|${structure}|${lat}|${lng}`;
  if(line && lat && lng)return `${kind}|${line}|${lat}|${lng}`;
  if(source && line && !titleIsWeak)return `${kind}|${source}|${line}|${structure}`;
  return'';
}
function cleanupImportedRecords(records,opts={}){
  const out=[];
  const seen=new Set();
  let removedGeometry=0, removedDuplicates=0;
  for(const rec0 of records||[]){
    const rec=sanitizeImportedRecord(rec0);
    const raw=rec?.original&&typeof rec.original==='object'?rec.original:rec;
    if(isGeometryOnlyImportObject(raw) || isGeometryOnlyImportObject(rec)){removedGeometry++;continue;}
    const key=importDedupeKey(rec);
    const allowDuplicateCleanup = opts && opts.mode === 'import';
    if(allowDuplicateCleanup && key && seen.has(key)){removedDuplicates++;continue;}
    if(key)seen.add(key);
    out.push(rec);
  }
  return {records:out,removedGeometry,removedDuplicates};
}
function detectKind(r,file){
  const f=normalizeSearch(file||'');
  const s=normalizeSearch([
    file,
    val(r,["asset_type","EQUIP_GRP_ID_DESC","EQUIP_GRP_ID","STRUC_TYP_DESC","SUB_STRUC_DESC","STRUC_CAT_DESC","MATRL_TYP_DESC","DEPOT","DEPOT_NAME","SUBSTATION","CONDUCTOR_ID_DESC","LINE_NAME","LINE_NAME_1","STRUCTURE_LABEL"]),
    JSON.stringify(r).slice(0,900)
  ].join(' '));
  if(/DEPOT_NAME|\bDEPOT\b|DEPOTS/.test(s))return'depot';
  if(/SUBSTATION|SUBSTATIONS|TERMINAL|ZONE SUB/.test(s))return'substation';
  if(/CONDUCTOR|COND_|EARTH_WIRE|FIRST_NAME_PLATE|LAST_NAME_PLATE|STRUNG/.test(s))return'conductor';
  // Structure records can use several different source descriptions.
  if(/TOWER|TOWERS|LATTICE|TRANS STRUCT|TRANSMISSION STRUCTURE|STEEL ANGLE|TUBULAR STEEL|\bD C\b|\bS C\b|LIGHT SUSPENSION|SUSPENSION STRUCTURE/.test(s) || /TOWER/.test(f))return'tower';
  if(/POLE|WOOD|KARRI|CONCRETE|STRUCTURE_LABEL|NAMEPLATE/.test(s))return'pole';
  return'asset'
}
function normaliseRecord(input,file){
  const r=cleanObj(input); const original={...r}; const kind=detectKind(r,file);
  const line1=val(r,["LINE_NAME_1"]), line2=val(r,["LINE_NAME_2"]), line3=val(r,["LINE_NAME_3"]), line0=val(r,["ROUTE_NAME","ROUTE","ROUTE_ID","LINE_NAME","LINE_ID","LINEID","LINE_NO","line_name","LINE","CIRCUIT","CIRCUIT_ID","CIRCUIT_NAME","FEEDER","FEEDER_NAME","NETWORK_ROUTE"]);
  const plate1=val(r,["NAMEPLATE_ID_1"]), plate2=val(r,["NAMEPLATE_ID_2"]), plate3=val(r,["NAMEPLATE_ID_3"]);
  const linePlateCombos=unique([
    line1&&plate1?`${line1}-${plate1}`:'', line1&&plate1?`${line1} ${plate1}`:'',
    line2&&plate2?`${line2}-${plate2}`:'', line2&&plate2?`${line2} ${plate2}`:'',
    line3&&plate3?`${line3}-${plate3}`:'', line3&&plate3?`${line3} ${plate3}`:''
  ]);
  const lines=unique([line0,line1,line2,line3,val(r,["ABBREVIATION","LINE_ABBREVIATION","ROUTE_ABBREVIATION","FROM_TO"]),...linePlateCombos]).filter(Boolean);
  const line=line0||line1||line2||line3||'';
  const pole=val(r,["POINT_ID","POINTID","ASSET_ID","ASSETID","asset_id","FACILITYID","FACILITY_ID","EQUIPMENT_ID","EQUIP_ID","EQUIP_NO","EQUIPMENT_NO","STRUCTURE_ID","STRUCTUREID","STRUCTURE_LABEL","STRUCTURE_NO","STRUCTURE_NUMBER","NAMEPLATE_ID","NAMEPLATE_ID_1","NAMEPLATE_ID_2","NAMEPLATE_ID_3","LABEL","NAME","TITLE","OBJECTID","FID","ID"]);
  const depot=val(r,["DEPOT_NAME","DEPOT","MAINTENANCE_ZONE"]); const sub=val(r,["SUBSTATION","SUBSTATION_NAME","ABBREVIATION","TERMINAL"]);
  const title=kind==='depot'?(depot||pole):kind==='substation'?(sub||pole):(pole||linePlateCombos[0]||line||val(r,["OBJECTID"])||kind);
  const c=getCoordPair({...r,original});
  const e=val(r,["EASTING","EASTING_COORD","easting","MGA_EASTING","MGA_E","X_COORD","XCOORD","POINT_X"]), n=val(r,["NORTHING","NORTHING_COORD","northing","MGA_NORTHING","MGA_N","Y_COORD","YCOORD","POINT_Y"]), z=val(r,["ZONE_","ZONE","COORD_ZONE","MGA_ZONE","zone"])||"50";
  const out={...r,original,__sourceFile:file,__kind:kind,__title:title,__line:line,__lines:lines,__pole:pole,__depot:depot,__substation:sub,__lat:c?c.lat:null,__lng:c?c.lng:null,__hasGPS:!!c,__easting:e,__northing:n,__zone:z,__conductor:val(r,["CONDUCTOR_ID_DESC","conductor","CONDUCTOR","STRUNG_SECTION_TYP_ID_DESC"])};
  out.__search=normalizeSearch([
    title,line,lines.join(' '),linePlateCombos.join(' '),pole,plate1,plate2,plate3,depot,sub,kind,out.__conductor,
    val(r,["SEARCH_FIELD","OBJECTID","OWNER","AER_NSP","MATRL_TYP_DESC","STRUC_TYP_DESC","SUB_STRUC_DESC","STRUC_CAT_DESC","FIRST_NAME_PLATE_ID","LAST_NAME_PLATE_ID"]),file
  ].join(' '));
  out.__compact=normalizeCompact(out.__search);
  return out;
}
function plateNumber(s){
  const m=String(s||'').match(/(\d{1,5})(?!.*\d)/);
  return m?parseInt(m[1],10):null
}
function plateTokens(s){
  return [...String(s||'').matchAll(/\d{1,5}/g)].map(m=>parseInt(m[0],10)).filter(Number.isFinite);
}
function compactLineVariants(line){
  line=String(line||'').trim();
  const out=[line];
  // Handles LINE_NAME values like KW-KEM/OLY 91 by adding KW-KEM 91 and KW-OLY 91 variants.
  const m=line.toUpperCase().match(/^([A-Z]{2,6})-([A-Z]{1,6})\/([A-Z]{1,6})\s+(\d{1,4})$/);
  if(m){out.push(`${m[1]}-${m[2]} ${m[4]}`);out.push(`${m[1]}-${m[3]} ${m[4]}`);}
  return unique(out);
}
function structureLinePlatePairs(r){
  const pairs=[];
  const l0=val(r,["__line","line_name","LINE_NAME","LINE","CIRCUIT","CIRCUIT_NAME"]);
  const struct=val(r,["STRUCTURE_LABEL","EQUIP_NO","__pole","asset_id"]);
  const fallbackPlate=plateNumber(struct)||plateNumber(val(r,["NAMEPLATE_ID_1"]));
  const p0=val(r,["NAMEPLATE_ID","NAMEPLATE_ID_1"]);
  const raw=[
    [val(r,["LINE_NAME_1"]),val(r,["NAMEPLATE_ID_1"])],
    [val(r,["LINE_NAME_2"]),val(r,["NAMEPLATE_ID_2"])],
    [val(r,["LINE_NAME_3"]),val(r,["NAMEPLATE_ID_3"])],
    [l0,p0||fallbackPlate]
  ];
  raw.forEach(([line,plate])=>{
    compactLineVariants(line).forEach(l=>{
      const p=plateNumber(plate);
      if(l)pairs.push({line:l,plate:p});
    });
  });
  // If STRUCTURE_LABEL has multiple line/plate pieces, add each piece too.
  const re=/([A-Z]{2,6}-[A-Z]{1,8}(?:\/[A-Z]{1,8})?\s+\d{1,4})[-\s]+(\d{1,5})/gi;
  let m;
  while((m=re.exec(struct))){compactLineVariants(m[1]).forEach(l=>pairs.push({line:l,plate:plateNumber(m[2])}));}
  return unique(pairs.map(x=>`${normalizeCompact(x.line)}|${x.plate||''}`)).map(k=>{const [lineKey,plate]=k.split('|'); const found=pairs.find(x=>normalizeCompact(x.line)===lineKey&&String(x.plate||'')===plate); return found;}).filter(Boolean);
}
function conductorLineVariants(c){
  return unique(lineCandidates(c).flatMap(compactLineVariants));
}
function conductorDescription(c){
  return directConductor(c)||val(c,["CONDUCTOR_ID_DESC","STRUNG_SECTION_TYP_ID_DESC","EARTH_WIRE_1_ID_DESC","EARTH_WIRE_2_ID_DESC","CONDUCTOR","CONDUCTOR_TYPE","CABLE_ID"]);
}
function conductorRange(c){
  const first=plateNumber(val(c,["FIRST_NAME_PLATE_ID","FIRST_POLE","FROM_STRUCTURE","FROM_NAMEPLATE_ID","START_NAME_PLATE_ID"]));
  const last=plateNumber(val(c,["LAST_NAME_PLATE_ID","LAST_POLE","TO_STRUCTURE","TO_NAMEPLATE_ID","END_NAME_PLATE_ID"]));
  if(first&&last)return {min:Math.min(first,last),max:Math.max(first,last),first,last};
  return null;
}
function cleanConductorDesc(desc){
  return String(desc||'').replace(/\s*\|\s*/g,' | ').replace(/\s+/g,' ').trim();
}
function addUniqueConductor(list,line,desc){
  desc=cleanConductorDesc(desc);
  if(!desc)return;
  const key=normalizeCompact(desc);
  if(!list.some(x=>normalizeCompact(x.desc)===key)) list.push({line,desc});
}
function linkConductors(){
  const conds=allRecords.filter(r=>r.__kind==='conductor');
  if(!conds.length)return;
  allRecords.forEach(r=>{ if(r.__kind!=='conductor' && !directConductor(r)) r.__conductor=''; });

  const byLine={};
  const ranged=[];
  const unranged=[];
  conds.forEach(c=>{
    const range=conductorRange(c);
    const item={c,range,desc:conductorDescription(c),lines:conductorLineVariants(c).map(normalizeCompact).filter(Boolean)};
    if(!item.desc||!item.lines.length)return;
    if(range)ranged.push(item); else unranged.push(item);
    item.lines.forEach(k=>{(byLine[k]??=[]).push(item);});
  });

  allRecords.forEach(r=>{
    if(r.__kind==='conductor')return;
    if(directConductor(r))return;
    const found=[];
    const pairs=structureLinePlatePairs(r).filter(p=>p&&p.line&&p.plate);

    // Strict span match using route and range fields.
    for(const pair of pairs){
      const arr=byLine[normalizeCompact(pair.line)]||[];
      for(const item of arr){
        if(!item.range)continue;
        if(pair.plate>=item.range.min && pair.plate<=item.range.max){
          addUniqueConductor(found,pair.line,item.desc);
        }
      }
    }

    // Only use fallback if there were no ranged detail records for that route at all.
    // This prevents every section being dumped onto one structure.
    if(!found.length){
      for(const pair of pairs){
        const arr=byLine[normalizeCompact(pair.line)]||[];
        const hasRanged=arr.some(x=>x.range);
        if(hasRanged)continue;
        for(const item of arr.slice(0,3)) addUniqueConductor(found,pair.line,item.desc);
      }
    }

    if(found.length){
      const grouped=found.slice(0,8).map(x=>`${x.line}: ${x.desc}`);
      r.__conductor=grouped.join(' | ');
      r.__search=normalizeSearch([r.__search,r.__conductor].join(' '));
      r.__compact=normalizeCompact(r.__search);
    }
  });
}


let importFileQueue=[];
let lastImportAudit=[];
const IMPORT_MODE_SETTING_KEY='asset_tracker_v35_import_mode_v1';
function getImportMode(){try{return localStorage.getItem(IMPORT_MODE_SETTING_KEY)||'replace';}catch(e){return 'replace';}}
function setImportMode(mode){
  mode=(mode==='append')?'append':'replace';
  try{localStorage.setItem(IMPORT_MODE_SETTING_KEY,mode);}catch(e){}
  renderImportMode();
}
function renderImportMode(){
  const mode=getImportMode();
  const rep=document.getElementById('importModeReplace');
  const app=document.getElementById('importModeAppend');
  if(rep)rep.classList.toggle('active',mode==='replace');
  if(app)app.classList.toggle('active',mode==='append');
}
function importFileKey(f){return [f.name,f.size,f.lastModified||0].join('|')}
function queueImportFilesFrom(id){
  const input=document.getElementById(id);
  const picked=[...(input?.files||[])];
  if(!picked.length){renderImportQueue();return importFileQueue;}
  const existing=new Set(importFileQueue.map(importFileKey));
  for(const f of picked){
    const key=importFileKey(f);
    if(!existing.has(key)){importFileQueue.push(f);existing.add(key);}
  }
  if(input)input.value='';
  renderImportQueue();
  return importFileQueue;
}
function clearImportQueue(){importFileQueue=[];renderImportQueue();}
function removeImportQueuedFileAt(idx){importFileQueue.splice(idx,1);renderImportQueue();}
function renderImportQueue(){
  const e=document.getElementById('importQueueList');
  if(e){
    if(!importFileQueue.length){
      e.innerHTML='<div class="import-queue-empty">No files queued. Select one or more files, or select more files again to add them.</div>';
    }else{
      e.innerHTML='<div class="import-queue-title">Queued files: '+importFileQueue.length+'</div>'+importFileQueue.map((f,idx)=>`<div class="import-queue-row"><span>${esc(f.name)}<small>${(f.size/1024/1024).toFixed(2)} MB</small></span><button type="button" onclick="removeImportQueuedFileAt(${idx})">Remove</button></div>`).join('');
    }
  }
  renderImportMode();
  renderImportAudit();
}
function renderImportAudit(){
  const e=document.getElementById('importAudit');
  if(!e)return;
  if(!lastImportAudit.length){e.innerHTML='';return;}
  e.innerHTML='<div class="import-audit-title">Last import audit</div>'+lastImportAudit.map(a=>`<div class="import-audit-row"><b>${esc(a.file)}</b><span>extracted ${Number(a.extracted||0).toLocaleString()} · accepted ${Number(a.imported||0).toLocaleString()} · GPS ${Number(a.gps||0).toLocaleString()}</span><small>ignored geometry-only ${Number(a.skippedGeometry||0).toLocaleString()} · ignored no-ID ${Number(a.skippedNoId||0).toLocaleString()} · duplicates skipped ${Number(a.duplicates||0).toLocaleString()}</small>${a.diag?`<small>scan depth ${a.diag.maxDepth||0} · arrays ${a.diag.arrays||0} · objects checked ${a.diag.objects||0}</small>`:''}</div>`).join('');
}

function importAuditSample(rec,reason,file){
  const raw=(rec&&rec.original&&typeof rec.original==='object')?rec.original:(rec||{});
  const fields={};
  try{
    const wanted=['LINE_NAME','LINE_NAME_1','LINE_NAME_2','LINE_NAME_3','ROUTE','CIRCUIT','FEEDER','STRUCTURE_LABEL','NAMEPLATE_ID','NAMEPLATE_ID_1','POINT_ID','ASSET_ID','FACILITYID','EQUIP_NO','OBJECTID','SUBSTATION','TERMINAL','DEPOT_NAME','LAT','LON','LONGITUDE','EASTING','NORTHING'];
    for(const k of wanted){if(raw[k]!==undefined&&raw[k]!==null&&String(raw[k]).trim()!==''&&typeof raw[k]!=='object')fields[k]=raw[k];}
    for(const [k,v] of Object.entries(raw).slice(0,28)){
      if(fields[k]===undefined && v!==undefined && v!==null && typeof v!=='object' && String(v).trim()!=='')fields[k]=String(v).slice(0,160);
    }
  }catch(e){}
  return {reason,file,kind:rec&&rec.__kind,title:rec&&rec.__title,line:rec&&rec.__line,gps:!!(rec&&rec.__hasGPS),fields};
}
function pushImportAuditSample(list,rec,reason,file,max=8){
  if(!list||list.length>=max)return;
  list.push(importAuditSample(rec,reason,file));
}

async function loadFilesFrom(id,opts={}){
  queueImportFilesFrom(id);
  const files=[...importFileQueue];
  if(!files.length){alert('Choose files first.');return}
  const samplePercent=Number(opts.samplePercent||0);
  const fresh=[];
  const audit=[];
  const importMode=getImportMode();
  const replaceAll=(importMode==='replace' && !(samplePercent>0));
  showBusyOverlay('Importing','Reading queued files...');
  try{
    if(replaceAll){
      updateBusy('Replace all mode: clearing current imported records...');
      await sleepFrame();
      allRecords=[]; visibleRecords=[]; circuitGroups=[]; searchIndex=[]; lineSearchCache=[]; searchIndexReady=false;
      if(typeof clearMapToolLayers==='function')clearMapToolLayers();
      try{localStorage.removeItem(KEY);}catch(e){}
      if(typeof clearRecordsDB==='function')await clearRecordsDB();
    }
    const existingKeys=new Set((allRecords||[]).map(importDedupeKey).filter(Boolean));
    for(let fi=0;fi<files.length;fi++){
      const f=files[fi];
      updateBusy(`Reading ${f.name} (${fi+1}/${files.length})`);
      await sleepFrame();
      const text=await readFileAsText(f);
      let arr;
      const trimmed=text.trim();
      try{
        arr=f.name.toLowerCase().endsWith('.json')||trimmed.startsWith('{')||trimmed.startsWith('[')
          ? extractRecordsFromJSON(JSON.parse(text))
          : parseCSV(text);
      }catch(parseErr){
        throw new Error(`${f.name}: ${parseErr.message||parseErr}`);
      }
      const extractedCount=arr.length;
      if(samplePercent>0&&samplePercent<100)arr=arr.slice(0,Math.max(1,Math.ceil(arr.length*samplePercent/100)));
      updateBusy(`Normalising ${arr.length.toLocaleString()} records from ${f.name}`);
      let importedForFile=0, gpsForFile=0, skippedGeometryForFile=0, skippedNoIdForFile=0, duplicatesForFile=0;
      const skippedSamples=[];
      for(let i=0;i<arr.length;i++){
        const rec=sanitizeImportedRecord(normaliseRecord(arr[i],f.name));
        const quality=importedRecordQuality(rec);
        if(!quality.ok){
          if(quality.reason==='geometry-only')skippedGeometryForFile++; else skippedNoIdForFile++;
          pushImportAuditSample(skippedSamples,rec,quality.reason||'no asset identity',f.name);
          if(i%250===0){updateBusy(`Normalising ${i.toLocaleString()} / ${arr.length.toLocaleString()} from ${f.name}`); await sleepFrame();}
          continue;
        }
        const key=importDedupeKey(rec);
        if(key&&existingKeys.has(key)){duplicatesForFile++;pushImportAuditSample(skippedSamples,rec,'duplicate identity',f.name);continue;}
        if(key)existingKeys.add(key);
        fresh.push(rec); importedForFile++; if(hasGPS(rec))gpsForFile++;
        if(i%250===0){updateBusy(`Normalising ${i.toLocaleString()} / ${arr.length.toLocaleString()} from ${f.name}`); await sleepFrame();}
      }
      const diag=f.name.toLowerCase().endsWith('.json')?extractRecordsFromJSON.lastDiagnostics:null;
      audit.push({file:f.name,extracted:extractedCount,imported:importedForFile,gps:gpsForFile,skippedGeometry:skippedGeometryForFile,skippedNoId:skippedNoIdForFile,duplicates:duplicatesForFile,diag,skippedSamples});
    }

    allRecords.push(...fresh);
    const cleaned=cleanupImportedRecords(allRecords,{mode:'import'});
    if(cleaned.removedGeometry||cleaned.removedDuplicates){
      allRecords=cleaned.records;
      showToolStatus?.(`Import cleanup: removed ${cleaned.removedGeometry} geometry-only and ${cleaned.removedDuplicates} duplicate records`);
    }
    if(typeof assignRecordIndexes==='function')assignRecordIndexes();
    if(typeof invalidateFastCounts==='function')invalidateFastCounts();
    if(typeof invalidatePatrolRouteCache==='function')invalidatePatrolRouteCache();
    if(typeof clearRouteSegmentCache==='function')clearRouteSegmentCache();
    searchIndex=[]; lineSearchCache=[]; searchIndexReady=false;
    updateBusy('Linking details...');
    await sleepFrame();
    try{ linkConductors(); }catch(linkErr){ console.warn('Detail linking skipped',linkErr); }

    // Keep the active app usable. For speed, no startup/import indexing unless the user manually enables it.
    circuitGroups=[]; visibleRecords=[];
    if(importAutoIndex && allRecords.length<25000){
      const filesBeingIndexed=sourceFileSummary(allRecords,14);
      updateBusyHTML(autoIndexBusyHTML('Auto-indexing. Please wait...',filesBeingIndexed));
      await sleepFrame();
      try{
        await rebuildIndexAsync((done,total)=>updateBusyHTML(autoIndexBusyHTML(`Auto-indexing. Please wait... ${Number(done||0).toLocaleString()} / ${Number(total||0).toLocaleString()} records`,filesBeingIndexed)));
      }catch(idxErr){
        console.warn('Index rebuild skipped',idxErr);
        searchIndex=[]; lineSearchCache=[]; searchIndexReady=false;
      }
    }else{
      searchIndex=[]; lineSearchCache=[]; searchIndexReady=false;
      updateBusy('Imported. Search index will build only when you search.');
    }
    updateKPIs(); renderSettingsStats?.();

    lastImportAudit=audit;
    clearImportQueue();
    renderImportAudit();
    await finishBusyOverlay(`Imported ${fresh.length.toLocaleString()} records`);

    // Save in the background. This prevents Android/Spck/Edge from looking frozen during big IndexedDB writes.
    setTimeout(async()=>{
      try{
        if(allRecords.length<1500){
          try{localStorage.setItem(KEY,JSON.stringify(allRecords));}catch(e){}
        }
        await saveRecordsToIndexedDB(allRecords);
        showToolStatus?.(`Saved ${allRecords.length.toLocaleString()} records locally`);
      }catch(saveErr){
        console.warn('Background save failed',saveErr);
        showToolStatus?.('Imported, but local save failed. Export backup before closing.');
      }
    },80);
  }catch(e){
    hideBusyOverlay();
    console.error(e);
    alert('Import failed: '+(e.message||e));
  }
}

function indexNoZeroCompact(s){
  return (String(s||'').toUpperCase().match(/[A-Z]+|\d+/g)||[])
    .map(x=>/^\d+$/.test(x)?String(parseInt(x,10)||0):x)
    .join('');
}
function indexCodeParts(s){
  const parts=String(s||'').toUpperCase().match(/[A-Z]+|\d+/g)||[];
  const nums=parts.filter(x=>/^\d+$/.test(x)).map(x=>parseInt(x,10)).filter(Number.isFinite);
  return {letters:parts.filter(x=>/[A-Z]/.test(x)).join(''),nums,lastNum:nums.length?nums[nums.length-1]:null,noZero:parts.map(x=>/^\d+$/.test(x)?String(parseInt(x,10)||0):x).join(''),compact:normalizeCompact(s)};
}
function buildCodePartsForRecord(r,line,structure){
  // Lightweight code variants only. The old builder called expensive full-record helpers per record.
  const texts=[];
  const add=t=>{if(t!==undefined&&t!==null&&String(t).trim())texts.push(String(t).trim());};
  add(structure); add(line);
  try{ (r.__lines||[]).slice(0,5).forEach(l=>{add(l); if(structure){add(l+' '+structure);add(l+'-'+structure);}}); }catch(e){}
  const p1=val(r,['NAMEPLATE_ID_1','NAMEPLATE_ID','POINT_ID','ASSET_ID','STRUCTURE_LABEL','EQUIP_NO']);
  if(line&&p1){add(line+' '+p1);add(line+'-'+p1);}
  const seen=new Set(), out=[];
  for(const t of texts){
    const p=indexCodeParts(t);
    if(!p.compact || seen.has(p.compact))continue;
    seen.add(p.compact);
    if((p.letters&&p.letters.length>=2) || p.nums.length) out.push(p);
    if(out.length>=8)break;
  }
  return out;
}
function buildSearchIndexEntry(r,i,groups){
  try{r.__idx=i;}catch(e){}
  const line=getLine(r)||'';
  const structure=getStructure(r)||'';
  const sub=getSubstationName(r)||'';
  const dep=getDepotName(r)||'';
  const kind=r.__kind||getType(r)||'asset';
  const search=r.__search||normalizeSearch(makeSearchText(r));
  const compact=r.__compact||normalizeCompact(search);
  const entry={
    i,record:r,line,structure,sub,dep,kind,gps:!!(r.__hasGPS||(r.__lat!==null&&r.__lat!==undefined&&r.__lng!==null&&r.__lng!==undefined)),search,compact,
    noZeroCompact:indexNoZeroCompact(search),
    lineCompact:normalizeCompact(line),structureCompact:normalizeCompact(structure),subCompact:normalizeCompact(sub),depCompact:normalizeCompact(dep),
    lineNoZero:indexNoZeroCompact(line),structureNoZero:indexNoZeroCompact(structure),subNoZero:indexNoZeroCompact(sub),depNoZero:indexNoZeroCompact(dep),
    codeParts:buildCodePartsForRecord(r,line,structure)
  };
  if(groups && (typeof routeRecordIsLineAsset==='function'?routeRecordIsLineAsset(r):kind!=='conductor')){
    for(const l of ((typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):(typeof lineCandidates==='function'?lineCandidates(r):[])))){
      if(typeof routeNameLooksLikeRealRoute==='function' && !routeNameLooksLikeRealRoute(l))continue;
      const key=normalizeCompact(l);
      if(!key)continue;
      let g=groups.get(key);
      if(!g){
        g={line:l,key,records:[],gps:0,search:normalizeSearch(l),compact:key,noZero:indexNoZeroCompact(l)};
        groups.set(key,g);
      }
      g.records.push(r);
      if(entry.gps)g.gps++;
    }
  }
  return entry;
}
function collapseLineSearchCache(){
  const input=lineSearchCache||[];
  const merged=new Map();
  for(const g of input){
    const line=(typeof canonicalRouteName==='function'?canonicalRouteName(g.line):g.line)||g.line;
    const key=normalizeCompact(line);
    if(!key)continue;
    let row=merged.get(key);
    if(!row){row={line,key,records:[],gps:0,search:normalizeSearch(line),compact:key,noZero:indexNoZeroCompact(line)};merged.set(key,row);}
    const seen=new Set(row.records.map(r=>Number.isInteger(r?.__idx)?r.__idx:recordIndexOf?.(r)));
    for(const r of (g.records||[])){
      if(typeof routeRecordIsLineAsset==='function' && !routeRecordIsLineAsset(r))continue;
      const id=Number.isInteger(r?.__idx)?r.__idx:(typeof recordIndexOf==='function'?recordIndexOf(r):(allRecords||[]).indexOf(r));
      if(seen.has(id))continue;
      seen.add(id);row.records.push(r);if(typeof hasGPS==='function'?hasGPS(r):r?.__hasGPS)row.gps++;
    }
  }
  lineSearchCache=Array.from(merged.values()).sort((a,b)=>a.line.localeCompare(b.line));
  return lineSearchCache;
}

function rebuildIndex(){
  const groups=new Map();
  searchIndex=(allRecords||[]).map((r,i)=>buildSearchIndexEntry(r,i,groups));
  lineSearchCache=Array.from(groups.values());
  collapseLineSearchCache();
  searchIndexReady=true;
  searchIndexBuilding=false;
  updateKPIs();
}
async function rebuildIndexAsync(onProgress){
  if(searchIndexBuilding) return window.__rebuildIndexPromise || Promise.resolve();
  searchIndexBuilding=true;
  searchIndexReady=false;
  const groups=new Map();
  const idx=[];
  const total=(allRecords||[]).length;
  window.__rebuildIndexPromise=(async()=>{
    try{
      for(let i=0;i<total;i++){
        idx.push(buildSearchIndexEntry(allRecords[i],i,groups));
        if(i%450===0){
          if(onProgress)onProgress(i,total);
          await sleepFrame();
        }
      }
      if(onProgress)onProgress(total,total);
      searchIndex=idx;
      lineSearchCache=Array.from(groups.values());
      collapseLineSearchCache();
      searchIndexReady=true;
      updateKPIs();
    }finally{
      searchIndexBuilding=false;
      window.__rebuildIndexPromise=null;
    }
  })();
  return window.__rebuildIndexPromise;
}
function buildCircuitGroupsFromIndex(){return[]}
function rebuildCircuitGroups(){circuitGroups=[]}
