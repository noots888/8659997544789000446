/* Clean asset field helpers, GPS parsing, detail linking, KPI counters. */
function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function unique(a){return [...new Set((a||[]).filter(v=>v!==undefined&&v!==null&&String(v).trim()!==""))]}
function title(s){return String(s||"").charAt(0).toUpperCase()+String(s||"").slice(1)}
function cleanKey(k){return String(k||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function val(r,keys){
  if(!r)return"";
  const objs=[];
  if(r)objs.push(r);
  if(r.original)objs.push(r.original);
  if(r.attributes)objs.push(r.attributes);
  if(r.original&&r.original.attributes)objs.push(r.original.attributes);
  for(const obj of objs){
    for(const k of keys){
      if(obj[k]!==undefined&&obj[k]!==null&&String(obj[k]).trim()!=="")return String(obj[k]).trim();
    }
  }
  const wanted=keys.map(cleanKey);
  for(const obj of objs){
    const map={}; Object.keys(obj||{}).forEach(k=>map[cleanKey(k)]=k);
    for(const w of wanted){const real=map[w]; if(real!==undefined&&obj[real]!==undefined&&obj[real]!==null&&String(obj[real]).trim()!=="")return String(obj[real]).trim();}
  }
  return"";
}
function num(v){if(v===undefined||v===null||v==="")return NaN; const n=Number(String(v).replace(/[^0-9.\-]/g,"")); return Number.isFinite(n)?n:NaN;}
function isWA(lat,lng){lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&lat<=-10&&lat>=-36.8&&lng>=112&&lng<=130;}
function validLatLng(lat,lng){lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;}
function utmToLatLng(easting,northing,zone){
  easting=Number(easting); northing=Number(northing); zone=parseInt(String(zone||"50").match(/49|50|51/)?.[0]||"50",10);
  const a=6378137, f=1/298.257223563, k0=0.9996;
  const e=Math.sqrt(f*(2-f)); const e1=(1-Math.sqrt(1-e*e))/(1+Math.sqrt(1-e*e));
  let x=easting-500000, y=northing-10000000; const lon0=(zone-1)*6-180+3;
  const M=y/k0; const mu=M/(a*(1-e*e/4-3*Math.pow(e,4)/64-5*Math.pow(e,6)/256));
  const J1=3*e1/2-27*Math.pow(e1,3)/32, J2=21*Math.pow(e1,2)/16-55*Math.pow(e1,4)/32, J3=151*Math.pow(e1,3)/96, J4=1097*Math.pow(e1,4)/512;
  const fp=mu+J1*Math.sin(2*mu)+J2*Math.sin(4*mu)+J3*Math.sin(6*mu)+J4*Math.sin(8*mu);
  const ep2=e*e/(1-e*e), C1=ep2*Math.pow(Math.cos(fp),2), T1=Math.pow(Math.tan(fp),2);
  const R1=a*(1-e*e)/Math.pow(1-e*e*Math.pow(Math.sin(fp),2),1.5), N1=a/Math.sqrt(1-e*e*Math.pow(Math.sin(fp),2));
  const D=x/(N1*k0);
  let lat=fp-(N1*Math.tan(fp)/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*ep2)*Math.pow(D,4)/24+(61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*Math.pow(D,6)/720);
  let lng=(D-(1+2*T1+C1)*Math.pow(D,3)/6+(5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*Math.pow(D,5)/120)/Math.cos(fp);
  return {lat:lat*180/Math.PI,lng:lon0+lng*180/Math.PI};
}
function webMercToLatLng(x,y){const R=6378137;return{lng:(x/R)*180/Math.PI,lat:(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI};}
function getGeometry(r){return r?.geometry||r?.original?.geometry||r?.attributes?.geometry||r?.original?.attributes?.geometry||{};}
function getCoordPair(r){
  if(!r)return null;
  // Fast path for normalised imported records. Avoid re-parsing field maps thousands of times.
  const flat=Number(r.__lat), flng=Number(r.__lng);
  if(isWA(flat,flng))return {lat:flat,lng:flng};
  let lat=num(val(r,["__lat","lat","LAT","LATITUDE","Latitude","latitude","GPS_LAT","GPS_LATITUDE"]));
  let lng=num(val(r,["__lng","lng","lon","LON","LONG","LONGITUDE","Longitude","longitude","GPS_LON","GPS_LONGITUDE"]));
  if(isWA(lat,lng))return{lat,lng}; if(isWA(lng,lat))return{lat:lng,lng:lat};
  const g=getGeometry(r); const gx=num(g.x??g.X??g.lon??g.longitude??g.LONGITUDE), gy=num(g.y??g.Y??g.lat??g.latitude??g.LATITUDE);
  if(isWA(gy,gx))return{lat:gy,lng:gx};
  if(isWA(gx,gy))return{lat:gx,lng:gy};
  if(Array.isArray(g.coordinates)){
    const flat=g.coordinates.flat ? g.coordinates.flat(8) : g.coordinates;
    for(let i=0;i<flat.length-1;i++){
      const a=num(flat[i]), b=num(flat[i+1]);
      if(isWA(b,a))return{lat:b,lng:a};
      if(isWA(a,b))return{lat:a,lng:b};
    }
  }
  if(Math.abs(gx)>1000000&&Math.abs(gy)>1000000&&Math.abs(gx)<20037509&&Math.abs(gy)<20037509){const wm=webMercToLatLng(gx,gy); if(isWA(wm.lat,wm.lng))return wm;}
  let e=num(val(r,["__easting","EASTING","EASTING_COORD","Easting","easting","MGA_EASTING","X_COORD"]));
  let n=num(val(r,["__northing","NORTHING","NORTHING_COORD","Northing","northing","MGA_NORTHING","Y_COORD"]));
  if(!(e>100000&&e<1000000&&n>5000000&&n<9000000) && gx>100000&&gx<1000000&&gy>5000000&&gy<9000000){e=gx;n=gy;}
  const z=val(r,["__zone","ZONE_","ZONE","COORD_ZONE","MGA_ZONE","zone"])||"50";
  if(e>100000&&e<1000000&&n>5000000&&n<9000000){
    for(const zone of unique([z,"50","49","51"])) {try{const ll=utmToLatLng(e,n,zone); if(isWA(ll.lat,ll.lng))return ll;}catch(err){}}
  }
  return null;
}
function getLat(r){const c=getCoordPair(r);return c?c.lat:null}
function getLng(r){const c=getCoordPair(r);return c?c.lng:null}
function hasGPS(r){return !!getCoordPair(r)}
function canonicalRouteName(raw){
  let s=String(raw||'').toUpperCase().replace(/_/g,' ').replace(/\s+/g,' ').trim();
  if(!s)return'';
  // Prevent individual point IDs from becoming fake "routes" in route-only search.
  // Examples handled generically: ABC-DEF 81-0007 -> ABC-DEF 81, ABCDEF81 0007 -> ABCDEF81.
  const numericParts=[...s.matchAll(/\d+/g)].map(m=>m[0]);
  if(numericParts.length>=2){
    s=s.replace(/([A-Z]{1,8}(?:[-\/][A-Z0-9]{1,8})*\s*\d{1,4})\s*[- ]\s*\d{1,6}[A-Z]?\s*$/i,'$1');
    s=s.replace(/([A-Z]{2,12}\d{1,4})\s+\d{1,6}[A-Z]?\s*$/i,'$1');
  }
  return s.replace(/\s+/g,' ').trim();
}
function routeOnlyCandidates(r){
  const l0=val(r,["__line","line_name","LINE_NAME","LINE","CIRCUIT","CIRCUIT_NAME","FEEDER","FEEDER_NAME"]);
  const l1=val(r,["LINE_NAME_1"]), l2=val(r,["LINE_NAME_2"]), l3=val(r,["LINE_NAME_3"]);
  return unique([l0,l1,l2,l3,val(r,["ABBREVIATION","LINE_ABBREVIATION"]),...(r.__lines||[]),deriveCircuitFromRecordRaw(r)]
    .map(canonicalRouteName)
    .filter(Boolean));
}
function lineCandidates(r){
  return routeOnlyCandidates(r);
}
function deriveCircuitFromText(txt){txt=String(txt||"").toUpperCase().replace(/_/g," ").replace(/\s+/g," ").trim();let m=txt.match(/\b([A-Z]{2,6})\s*[- ]\s*([A-Z]{1,6})(?:[\/\-][A-Z]{1,6})?\s*[- ]?\s*(\d{1,4})\b/);if(m)return`${m[1]}-${m[2]} ${m[3]}`;m=txt.match(/\b([A-Z]{2,6})\s*[- ]\s*(\d{1,4})\b/);if(m)return`${m[1]} ${m[2]}`;return"";}
function deriveCircuitFromRecordRaw(r){for(const v of [val(r,["STRUCTURE_LABEL","EQUIP_NO"]),...Object.values(r?.original||{})]){const d=deriveCircuitFromText(v);if(d)return d;}return"";}
function deriveCircuitFromRecord(r){for(const v of [val(r,["STRUCTURE_LABEL","EQUIP_NO"]),...routeOnlyCandidates(r),...Object.values(r?.original||{})]){const d=deriveCircuitFromText(v);if(d)return canonicalRouteName(d);}return"";}
function getLine(r){const raw=val(r,["__line","ROUTE_NAME","ROUTE","ROUTE_ID","route_name","line_name","LINE_NAME","LINE_ID","LINEID","LINE_NO","LINE_NAME_1","LINE","CIRCUIT","CIRCUIT_ID","CIRCUIT_NAME","FEEDER","FEEDER_NAME","NETWORK_ROUTE","ABBREVIATION"])||deriveCircuitFromRecord(r);return canonicalRouteName(raw)||raw}
function getStructure(r){return val(r,["__pole","POINT_ID","POINTID","ASSET_ID","ASSETID","point_id","asset_id","FACILITYID","FACILITY_ID","EQUIPMENT_ID","EQUIP_ID","EQUIP_NO","EQUIPMENT_NO","STRUCTURE_ID","STRUCTUREID","STRUCTURE_LABEL","STRUCTURE_NO","STRUCTURE_NUMBER","NAMEPLATE_ID","NAMEPLATE_ID_1","NAMEPLATE_ID_2","NAMEPLATE_ID_3","LABEL","NAME","TITLE","OBJECTID","FID","ID","DEPOT_NAME","SUBSTATION","ABBREVIATION","__title"])||"Unknown asset"}
function getType(r){return val(r,["__kind","asset_type","EQUIP_GRP_ID_DESC","EQUIP_GRP_ID","STRUC_TYP_DESC","SUB_STRUC_DESC","STRUC_CAT_DESC","SUBSTATION_TYPE","DEPOT","MATRL_TYP_DESC"])||"asset"}
function getMaterial(r){return val(r,["MATRL_TYP_DESC","material"])}
function getDrawing(r){return val(r,["NP_DWG_NO","TS_DRWG_NO","FOUNDATION_DWG_NO"])}
function getDepotName(r){return val(r,["DEPOT_NAME","DEPOT","__depot","MAINTENANCE_ZONE"])}
function getSubstationName(r){return val(r,["SUBSTATION","SUBSTATION_NAME","ABBREVIATION","__substation","TERMINAL","TERMINAL_NAME"])}
function isConductorKey(k){k=cleanKey(k);return k.includes("conductor")||k.includes("cond")||k.includes("strung")||k.includes("wire")||k.includes("cable")||k.includes("phase")||k.includes("earthwire")}
function directConductor(r){let f=[];(CONDUCTOR_FIELDS||[]).forEach(k=>{const v=val(r,[k]);if(v)f.push(v)});Object.keys(r?.original||r||{}).forEach(k=>{const v=(r.original||r)[k]; if(isConductorKey(k)&&v!==null&&v!==undefined&&String(v).trim())f.push(String(v).trim())});return unique(f).join(" | ")}
function resolveConductor(r){return val(r,["__conductor","DETAIL_DESC","detail_desc","conductor","CONDUCTOR_ID_DESC"])||directConductor(r)||""}
function genericDisplayText(v){
  let s=String(v??'');
  s=s.replace(/\bSUBSTATIONS?\b/gi,'Sites')
     .replace(/\bTERMINALS?\b/gi,'Sites')
     .replace(/\bPOLES?\b/gi,'Points')
     .replace(/\bTOWERS?\b/gi,'Structures')
     .replace(/\bLINES?\b/gi,'Routes')
     .replace(/\bCIRCUITS?\b/gi,'Routes')
     .replace(/\bFEEDERS?\b/gi,'Groups')
     .replace(/\bCONDUCTORS?\b/gi,'Details')
     .replace(/\bCOMPANY\b/gi,'Source')
     .replace(/\bNETWORK OPERATOR\b/gi,'Source')
     .replace(/\bOWNER\b/gi,'Source')
     .replace(/\b\d{2,3}\s*kV\b/gi,'Voltage class');
  return s;
}
function field(k,v){return `<div class="field"><b>${esc(genericDisplayText(k))}</b><span>${esc(genericDisplayText(v||"-"))}</span></div>`}
function copyAsset(){if(selected)navigator.clipboard?.writeText(`${getStructure(selected)} | ${getLine(selected)} | ${resolveConductor(selected)}`)}
function makeSearchText(r){return [r.__search,getLine(r),getStructure(r),getType(r),getDepotName(r),getSubstationName(r),resolveConductor(r),val(r,["SEARCH_FIELD","OBJECTID","EQUIP_NO"] )].join(" ").toLowerCase()}
function countConductors(){
  const n=(allRecords||[]).length;
  if(window.__conductorCountCacheN===n && window.__conductorCountCache!==undefined)return window.__conductorCountCache;
  const set=new Set();
  for(const rec of (allRecords||[])){
    const raw=rec.__conductor||rec.CONDUCTOR_ID_DESC||rec.STRUNG_SECTION_TYP_ID_DESC||rec.CONDUCTOR||'';
    String(raw||'').split('|').forEach(s=>{s=s.trim();if(s)set.add(s)});
  }
  window.__conductorCountCacheN=n;
  window.__conductorCountCache=set.size;
  return set.size;
}
function fastGPSCount(){
  const n=(allRecords||[]).length;
  if(window.__gpsCountCacheN===n && window.__gpsCountCache!==undefined)return window.__gpsCountCache;
  let c=0;
  for(const rec of (allRecords||[])){
    if(rec&&rec.__lat!==null&&rec.__lat!==undefined&&rec.__lng!==null&&rec.__lng!==undefined)c++;
    else if(rec&&rec.__hasGPS)c++;
  }
  window.__gpsCountCacheN=n; window.__gpsCountCache=c; return c;
}
function invalidateFastCounts(){window.__conductorCountCacheN=-1;window.__gpsCountCacheN=-1;}

function assignRecordIndexes(){
  try{
    (allRecords||[]).forEach((r,i)=>{ if(r&&typeof r==='object') r.__idx=i; });
  }catch(e){}
}
function recordIndexOf(r){
  if(!r)return -1;
  const i=Number(r.__idx);
  if(Number.isInteger(i) && allRecords && allRecords[i]===r) return i;
  return (allRecords||[]).indexOf(r);
}
function updateKPIs(){
  const a=document.getElementById("kAssets"),i=document.getElementById("kIndexed"),c=document.getElementById("kCond"),r=document.getElementById("kResults");
  if(a)a.innerText=Number(allRecords.length||0).toLocaleString();
  if(i)i.innerText=Number(searchIndex.length||0).toLocaleString();
  if(c)c.innerText=Number(countConductors()||0).toLocaleString();
  if(r)r.innerText=Number(visibleRecords.length||0).toLocaleString();
}
