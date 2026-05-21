/* Rebuilt movable Helicopter Patrol overlay. */
let heliWatchId=null, heliLastFix=null, heliBestFix=null, heliOverlayReady=false;
let heliEstimateLayer=null, heliCrossingWarnLayer=null, heliActiveLineRecords=[], heliActiveRouteGroups=[], heliLineWatchTimer=null, heliNextTargetRecord=null;
let patrolDrawToken=0, patrolCrossingToken=0;
let heliLineLoadToken=0, groundLineLoadToken=0;
let patrolLineCache=null, patrolLineCacheStamp=-1, patrolLineCacheBuilding=null;
function invalidatePatrolRouteCache(){
  patrolLineCache=null;
  patrolLineCacheStamp=-1;
  patrolLineCacheBuilding=null;
}
function patrolCacheAdd(cache,key,rec){
  key=cleanLineText(key);
  if(!key)return;
  let arr=cache.get(key);
  if(!arr){arr=[];cache.set(key,arr);}
  arr.push(rec);
}
async function ensurePatrolRouteCache(mode,onProgress){
  const total=(allRecords||[]).length;
  if(patrolLineCache && patrolLineCacheStamp===total)return patrolLineCache;
  if(patrolLineCacheBuilding)return patrolLineCacheBuilding;
  patrolLineCacheBuilding=(async()=>{
    const cache=new Map();
    try{
      if(typeof assignRecordIndexes==='function')assignRecordIndexes();
      for(let i=0;i<total;i++){
        const r=allRecords[i];
        if(r&&hasGPS(r)){
          const lines=unique([getLine(r),...((typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):lineCandidates(r))||[]),deriveCircuitFromRecord(r)]).filter(Boolean);
          lines.forEach(l=>patrolCacheAdd(cache,l,r));
          // Also index individual point/search codes so route inputs still find assets when the route field was missing or over-cleaned.
          try{
            const loose=[getStructure(r),r.__search,r.__compact,makeSearchText?.(r)].filter(Boolean);
            loose.forEach(v=>{const ck=cleanLineText(v); if(ck.length>=4) patrolCacheAdd(cache,ck,r);});
          }catch(e){}
        }
        if(i%700===0){
          if(onProgress)onProgress(`Building route lookup... ${Number(i).toLocaleString()} / ${Number(total).toLocaleString()}`);
          await sleepFrame?.();
        }
      }
      patrolLineCache=cache;
      patrolLineCacheStamp=total;
      return cache;
    }finally{
      patrolLineCacheBuilding=null;
    }
  })();
  return patrolLineCacheBuilding;
}
function patrolDedupeSortRecords(hits){
  const seen=new Set(), out=[];
  for(const r of hits||[]){
    if(!r||!hasGPS(r))continue;
    const ident=cleanLineText(getLine(r)||'')+'|'+cleanLineText(getStructure(r)||'')+'|'+Number(getLat(r)).toFixed(6)+'|'+Number(getLng(r)).toFixed(6);
    if(seen.has(ident))continue;
    seen.add(ident);
    out.push(r);
  }
  out.sort((a,b)=>{
    const na=poleNumber(a), nb=poleNumber(b);
    if(Number.isFinite(na)&&Number.isFinite(nb))return na-nb;
    return String(getStructure(a)).localeCompare(String(getStructure(b)));
  });
  return out;
}
async function patrolRouteRecordsAsync(line,mode,onProgress){
  if(!line)return [];
  const key=cleanLineText(line);
  const cache=await ensurePatrolRouteCache(mode,onProgress);
  let hits=cache.get(key)||[];
  if(!hits.length && key.length>=3){
    const merged=[];
    for(const [k,arr] of cache){
      if(k===key || k.includes(key) || key.includes(k)) merged.push(...arr);
    }
    hits=merged;
  }
  return patrolDedupeSortRecords(hits.filter(r=>matchesHeliLine(r,line)));
}

function toggleHeliPatrolFromMenu(ev){
  ev?.stopPropagation?.();
  const p=document.getElementById('heliPage');
  if(p&&p.classList.contains('open')){
    closeHeliPatrol();
    closePlus?.();
    showToolStatus('Helicopter Patrol overlay off.');
    return;
  }
  openHeliPatrol();
}

function openHeliPatrol(){
  if(typeof closeGroundPatrol==='function')closeGroundPatrol();
  closePlus(); closeSettings(); closePOI(); closeDrawer();
  const p=document.getElementById('heliPage');
  if(p)p.classList.add('open');
  document.body.classList.add('heli-open');
  document.querySelector('.fab')?.classList.add('heli-active');
  if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();
  if(!heliOverlayReady){initHeliOverlayDrag(); restoreHeliCompact(); heliOverlayReady=true;}
  ensureHeliLayers();
  startHeliGPS();
  const count=document.getElementById('heliLineCount');
  if(count && !heliActiveLineRecords.length)count.textContent='Type route(s), then press Enter or Load';
  showToolStatus('Helicopter Patrol overlay on.');
}

function closeHeliPatrol(){
  const p=document.getElementById('heliPage');
  if(p)p.classList.remove('open');
  document.body.classList.remove('heli-open');
  document.querySelector('.fab')?.classList.remove('heli-active');
  stopHeliGPS();
  if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();
}

function ensureHeliLayers(){
  if(!heliEstimateLayer)heliEstimateLayer=L.layerGroup().addTo(map);
  if(!heliCrossingWarnLayer)heliCrossingWarnLayer=L.layerGroup().addTo(map);
}

function startHeliGPS(){
  if(!navigator.geolocation){setHeliGPSStatus('GPS unavailable',false);return;}
  if(heliWatchId!==null)return;
  setHeliGPSStatus('Acquiring high accuracy GPS...',false);
  heliWatchId=navigator.geolocation.watchPosition(heliOnGPS, e=>{
    setHeliGPSStatus('GPS failed: '+e.message,false);
  },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
}

function stopHeliGPS(){
  if(heliWatchId!==null){navigator.geolocation.clearWatch(heliWatchId);heliWatchId=null;}
}

function patrolShouldUpdateNearest(mode,fix){
  const key=mode==='ground'?'__groundNearestTick':'__heliNearestTick';
  const last=window[key]||0;
  const now=Date.now();
  if(now-last<900)return false;
  window[key]=now;
  return true;
}
function heliOnGPS(p){
  const c=p.coords||{};
  const fix={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy||9999,altitude:c.altitude,heading:c.heading,speed:c.speed,time:Date.now()};
  heliLastFix=fix;
  if(!heliBestFix || fix.accuracy<heliBestFix.accuracy)heliBestFix=fix;
  const ll=[fix.lat,fix.lng];
  if(locMarker)locMarker.setLatLng(ll);
  else locMarker=L.marker(ll,{icon:L.divIcon({className:'loc-marker'})}).addTo(map);
  locMarker._gps=ll;
  patrolFollowGPS(fix,'heli');
  updateHeliTelemetry();
  if(patrolShouldUpdateNearest('heli',fix))updateHeliNearestPoles();
}

function updateHeliTelemetry(){
  const f=heliLastFix;
  const set=(id,v)=>{const e=document.getElementById(id); if(e)e.textContent=v;};
  if(!f){set('heliKmh','--');set('heliKnots','--');set('heliAlt','--');set('heliHead','--');return;}
  const mps=Number.isFinite(f.speed)?Math.max(0,f.speed):0;
  set('heliKmh',(mps*3.6).toFixed(0));
  set('heliKnots',(mps*1.94384).toFixed(0));
  set('heliAlt',Number.isFinite(f.altitude)?Math.round(f.altitude)+' m':'--');
  set('heliHead',Number.isFinite(f.heading)?Math.round(f.heading)+'°':'--');
  const good=f.accuracy<=15, ok=f.accuracy<=35;
  setHeliGPSStatus('GPS ±'+Math.round(f.accuracy)+' m'+(heliBestFix?' | best ±'+Math.round(heliBestFix.accuracy)+' m':''),good||ok,good);
}

function setHeliGPSStatus(text,ok,good){
  const e=document.getElementById('heliGpsStatus'); if(!e)return;
  e.textContent=text;
  e.classList.toggle('good',!!good);
  e.classList.toggle('ok',!!ok&&!good);
  e.classList.toggle('bad',!ok);
}

function heliBestGPS(){
  if(!navigator.geolocation)return alert('GPS unavailable.');
  setHeliGPSStatus('Forcing fresh high accuracy fix...',false);
  navigator.geolocation.getCurrentPosition(p=>{heliOnGPS(p); if(heliLastFix)map.setView([heliLastFix.lat,heliLastFix.lng],18); showToolStatus('Best GPS refreshed.');},
    e=>alert('GPS failed: '+e.message),{enableHighAccuracy:true,timeout:25000,maximumAge:0});
}

function getHeliLineText(){return (document.getElementById('heliLine')?.value||'').trim();}
function cleanLineText(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function parsePatrolRouteInput(text){
  const raw=String(text||'')
    .split(/[\n,;|]+|\s+\+\s+/)
    .map(x=>x.trim())
    .filter(Boolean);
  const seen=new Set(), out=[];
  for(const item of raw){
    const key=cleanLineText(item);
    if(!key||seen.has(key))continue;
    seen.add(key); out.push(item);
    if(out.length>=12)break;
  }
  return out;
}
function patrolRouteLabel(text){
  const routes=parsePatrolRouteInput(text);
  if(!routes.length)return '';
  return routes.length===1?routes[0]:routes.join(' + ');
}
function patrolRouteKeysFromInput(text){
  return new Set(parsePatrolRouteInput(text).map(cleanLineText).filter(Boolean));
}
function recordMatchesAnyPatrolRoute(r,routesOrText){
  const routes=Array.isArray(routesOrText)?routesOrText:parsePatrolRouteInput(routesOrText);
  return routes.some(route=>matchesHeliLine(r,route));
}
function patrolMergeRouteGroups(groups){
  const seen=new Set(), out=[];
  for(const g of groups||[]){
    for(const r of g.records||[]){
      if(!r||!hasGPS(r))continue;
      const id=(r.__idx!==undefined?r.__idx:'')+'|'+cleanLineText(getStructure(r)||'')+'|'+Number(getLat(r)).toFixed(6)+'|'+Number(getLng(r)).toFixed(6);
      if(seen.has(id))continue;
      seen.add(id); out.push(r);
    }
  }
  return patrolDedupeSortRecords(out);
}
async function patrolRouteGroupsAsync(text,mode,onProgress){
  const routes=parsePatrolRouteInput(text);
  const groups=[];
  for(let i=0;i<routes.length;i++){
    const label=routes[i];
    const recs=await patrolRouteRecordsAsync(label,mode,msg=>{
      if(onProgress)onProgress(routes.length>1?`Route ${i+1}/${routes.length}: ${msg}`:msg);
    });
    groups.push({label,records:recs});
    if(i%2===1)await sleepFrame?.();
  }
  return groups.filter(g=>g.records&&g.records.length);
}
function patrolNearestInfo(groups,fallbackRecords,fix){
  const useGroups=(groups&&groups.length)?groups:[{label:'',records:fallbackRecords||[]}];
  let best={group:null,records:[],record:null,index:-1,dist:Infinity};
  for(const group of useGroups){
    const records=(group.records||[]).filter(hasGPS);
    for(let i=0;i<records.length;i++){
      const r=records[i];
      const d=distanceMeters(fix.lat,fix.lng,getLat(r),getLng(r));
      if(d<best.dist)best={group,records,record:r,index:i,dist:d};
    }
  }
  return best.record?best:null;
}
function poleNumber(r){
  const s=String(getStructure(r)||'');
  const n=val(r,['NAMEPLATE_ID_1','NAMEPLATE_ID_2','NAMEPLATE_ID_3','POLE_NUMBER','STRUCTURE_NUMBER','OBJECTID']);
  const m=String(n||s).match(/(\d{1,5})(?!.*\d)/);
  return m?parseInt(m[1],10):NaN;
}
function matchesHeliLine(r,line){
  if(!line)return false;
  const a=cleanLineText(line);
  const vals=[getLine(r),...((typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):lineCandidates(r))||[]),deriveCircuitFromRecord(r)].map(cleanLineText).filter(Boolean);
  return vals.some(v=>v===a||v.includes(a)||a.includes(v));
}
function patrolRouteRecords(line){
  if(!line)return [];
  const key=cleanLineText(line);
  let hits=[];
  if(patrolLineCache && patrolLineCacheStamp===(allRecords||[]).length){
    hits=patrolLineCache.get(key)||[];
    if(!hits.length && key.length>=3){
      for(const [k,arr] of patrolLineCache){
        if(k===key || k.includes(key) || key.includes(k))hits.push(...arr);
      }
    }
  }else if(typeof routeHitsFromCache==='function' && lineSearchCache && lineSearchCache.length){
    try{hits=routeHitsFromCache(line)||[];}catch(e){hits=[];}
  }else{
    const out=[];
    for(const r of (allRecords||[])){
      if(!r||!hasGPS(r))continue;
      if(matchesHeliLine(r,line))out.push(r);
    }
    hits=out;
  }
  return patrolDedupeSortRecords(hits.filter(r=>matchesHeliLine(r,line)));
}
function patrolDrawOrderedRoute(records,layer,line,mode){
  if(!layer||!records||!records.length)return;
  const gps=records.filter(hasGPS);
  if(!gps.length)return;
  try{
    if(typeof drawCleanRouteSegments==='function' && gps.length>1 && gps.length<=450){
      drawCleanRouteSegments(gps,layer,{maxSegments:4,weight:mode==='ground'?5:4,opacity:.82,tooltip:`${line} | patrol route`,className:'patrol-route-line'});
    }else if(gps.length>1){
      const pts=gps.map(r=>[getLat(r),getLng(r)]);
      const lineObj=L.polyline(pts,{color:'#2f80ed',weight:mode==='ground'?5:4,opacity:.82,fill:false,lineCap:'round',lineJoin:'round',smoothFactor:.6,className:'patrol-route-line'}).addTo(layer);
      if(typeof registerMapToggleLayer==='function')registerMapToggleLayer(lineObj,null,'line');
      lineObj.bindTooltip(`${line} | patrol route`);
    }
  }catch(e){
    if(gps.length>1){
      L.polyline(gps.map(r=>[getLat(r),getLng(r)]),{color:'#2f80ed',weight:4,opacity:.82,fill:false}).addTo(layer);
    }
  }
}
function patrolAddDotsChunked(gps,mode,token){
  // Patrol route views must not silently cap assets. Show every imported GPS point and use chunking for speed.
  const list=(gps||[]).filter(hasGPS);
  let n=0;
  function addBatch(){
    if(token!==patrolDrawToken || !assetLayer)return;
    const end=Math.min(n+performanceBatch(80),list.length);
    for(;n<end;n++){
      const r=list[n];
      const i=(r&&r.__idx!==undefined)?r.__idx:(typeof recordIndexOf==='function'?recordIndexOf(r):allRecords.indexOf(r));
      const m=L.circleMarker([getLat(r),getLng(r)],{radius:mode==='ground'?6:5,weight:2,fillOpacity:.92,className:'patrol-active-dot'}).addTo(assetLayer);
      if(typeof registerMapToggleLayer==='function')registerMapToggleLayer(m,r,'dot');
      m.bindTooltip(getStructure(r));
      if(typeof bindAssetMiniPopup==='function')bindAssetMiniPopup(m,i);
    }
    applyMapToggleSettings?.();
    if(n<list.length){
      showToolStatus?.(`${mode==='ground'?'Ground':'Heli'} Patrol loading... ${n.toLocaleString()} / ${list.length.toLocaleString()} dots`);
      requestAnimationFrame(addBatch);
    }else{
      showToolStatus?.(`${mode==='ground'?'Ground':'Heli'} Patrol loaded: ${list.length.toLocaleString()} / ${list.length.toLocaleString()} GPS dots shown`);
    }
  }
  requestAnimationFrame(addBatch);
}
function patrolShowOnlyLine(records,line,mode,groups){
  forceMapAssetsVisibleForRoute?.();
  if(!assetLayer||!map)return;
  patrolDrawToken++;
  assetLayer.clearLayers();
  selectedMarker=null;
  selected=null;
  const gps=(records||[]).filter(hasGPS);
  const label=patrolRouteLabel(line)||line;
  if(!label||!gps.length){
    showToolStatus?.(label?`No GPS points found for ${label}.`:'Patrol selection cleared.');
    return;
  }
  const token=patrolDrawToken;
  const drawGroups=(groups&&groups.length)?groups:[{label,records:gps}];
  for(const g of drawGroups){
    const rows=(g.records||[]).filter(hasGPS);
    if(rows.length)patrolDrawOrderedRoute(rows,assetLayer,g.label||label,mode);
  }
  try{
    const bounds=L.latLngBounds(gps.map(r=>[getLat(r),getLng(r)]));
    if(bounds.isValid())map.fitBounds(bounds,{padding:[45,45],maxZoom:16});
  }catch(e){}
  patrolAddDotsChunked(gps,mode,token);
  const routeCount=(groups&&groups.length)||parsePatrolRouteInput(line).length||1;
  showToolStatus?.(`${mode==='ground'?'Ground':'Heli'} Patrol: ${routeCount} route${routeCount===1?'':'s'} | ${gps.length} GPS point${gps.length===1?'':'s'}`);
}
function patrolFollowGPS(fix,mode){
  if(!fix||!map)return;
  const open=(mode==='ground')?document.body.classList.contains('ground-open'):document.body.classList.contains('heli-open');
  if(!open)return;
  const now=Date.now();
  const key=mode==='ground'?'__groundLastFollow':'__heliLastFollow';
  if((window[key]||0) && now-window[key]<2500)return;
  window[key]=now;
  try{
    const z=Math.max(map.getZoom()||16, mode==='ground'?17:16);
    map.setView([fix.lat,fix.lng],z,{animate:false});
  }catch(e){}
}
async function heliRefreshLine(){
  ensureHeliLayers();
  const input=getHeliLineText();
  const routes=parsePatrolRouteInput(input);
  const label=patrolRouteLabel(input);
  const token=++heliLineLoadToken;
  const count=document.getElementById('heliLineCount');
  if(count)count.textContent=routes.length?'Finding route selection...':'Type route(s), comma separated, then press Enter or Load';
  if(!routes.length){
    heliActiveLineRecords=[]; heliActiveRouteGroups=[]; heliNextTargetRecord=null;
    patrolShowOnlyLine([],input,'heli'); updateHeliNearestPoles(); return;
  }
  try{
    const groups=await patrolRouteGroupsAsync(input,'heli',msg=>{if(token===heliLineLoadToken&&count)count.textContent=msg;});
    if(token!==heliLineLoadToken)return;
    heliActiveRouteGroups=groups;
    heliActiveLineRecords=patrolMergeRouteGroups(groups);
    if(count)count.textContent=heliActiveLineRecords.length?`${groups.length} route${groups.length===1?'':'s'} | ${heliActiveLineRecords.length} points loaded on map`:'No matching route loaded';
    if(heliEstimateLayer)heliEstimateLayer.clearLayers();
    patrolShowOnlyLine(heliActiveLineRecords,input,'heli',groups);
    drawHeliLineCrossings();
    updateHeliNearestPoles();
  }catch(e){
    console.warn('Heli route load failed',e);
    if(count)count.textContent='Route load failed';
    showToolStatus?.('Heli Patrol route load failed.');
  }
}


function drawHeliEstimates(){
  // Disabled: patrol mode must only show imported assets, never app-created estimated points.
  if(heliEstimateLayer)heliEstimateLayer.clearLayers();
}

function patrolLineKeyForRecord(r){
  return cleanLineText(getLine(r)||((typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):lineCandidates(r))[0])||deriveCircuitFromRecord(r)||'');
}
function patrolRecordPoint(r,originLat){
  const lat=getLat(r), lng=getLng(r);
  const scale=Math.cos((originLat||lat)*Math.PI/180)||1;
  return {lat,lng,x:lng*111320*scale,y:lat*110540,r};
}
function patrolOrderedPoints(records,originLat){
  return (records||[]).filter(hasGPS).slice().sort((a,b)=>{
    const na=poleNumber(a), nb=poleNumber(b);
    if(Number.isFinite(na)&&Number.isFinite(nb))return na-nb;
    return String(getStructure(a)).localeCompare(String(getStructure(b)));
  }).map(r=>patrolRecordPoint(r,originLat));
}
function patrolSegmentBearing(a,b){
  const deg=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  return (deg+360)%360;
}
function patrolAngleDiff(a,b){
  let d=Math.abs(a-b)%180;
  return d>90?180-d:d;
}
function patrolCross2(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
function patrolSegmentsIntersect(a,b,c,d){
  const eps=0.000001;
  const o1=patrolCross2(a,b,c), o2=patrolCross2(a,b,d), o3=patrolCross2(c,d,a), o4=patrolCross2(c,d,b);
  return (o1*o2<=eps && o3*o4<=eps &&
    Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1 &&
    Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+1);
}
function patrolPointSegDist(p,a,b){
  const vx=b.x-a.x, vy=b.y-a.y, wx=p.x-a.x, wy=p.y-a.y;
  const len=vx*vx+vy*vy;
  const t=len?Math.max(0,Math.min(1,(wx*vx+wy*vy)/len)):0;
  const x=a.x+t*vx, y=a.y+t*vy;
  return Math.hypot(p.x-x,p.y-y);
}
function patrolSegmentDist(a,b,c,d){
  if(patrolSegmentsIntersect(a,b,c,d))return 0;
  return Math.min(patrolPointSegDist(a,c,d),patrolPointSegDist(b,c,d),patrolPointSegDist(c,a,b),patrolPointSegDist(d,a,b));
}
function patrolSegmentIsSane(a,b){
  const d=Math.hypot(a.x-b.x,a.y-b.y);
  return d>8 && d<4500;
}
function patrolMakeSegments(points){
  const segs=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1], b=points[i];
    if(patrolSegmentIsSane(a,b))segs.push({a,b,bearing:patrolSegmentBearing(a,b)});
  }
  return segs;
}
function patrolGridKey(ix,iy){return ix+','+iy}
function patrolBuildSegmentGrid(segs,cell){
  const grid=new Map();
  segs.forEach((s,i)=>{
    const minx=Math.floor((Math.min(s.a.x,s.b.x)-30)/cell), maxx=Math.floor((Math.max(s.a.x,s.b.x)+30)/cell);
    const miny=Math.floor((Math.min(s.a.y,s.b.y)-30)/cell), maxy=Math.floor((Math.max(s.a.y,s.b.y)+30)/cell);
    for(let x=minx;x<=maxx;x++)for(let y=miny;y<=maxy;y++){
      const k=patrolGridKey(x,y);
      let arr=grid.get(k); if(!arr){arr=[];grid.set(k,arr)}
      arr.push(i);
    }
  });
  return grid;
}
function patrolCandidateActiveSegments(seg,grid,activeSegs,cell){
  const ids=new Set();
  const minx=Math.floor((Math.min(seg.a.x,seg.b.x)-30)/cell), maxx=Math.floor((Math.max(seg.a.x,seg.b.x)+30)/cell);
  const miny=Math.floor((Math.min(seg.a.y,seg.b.y)-30)/cell), maxy=Math.floor((Math.max(seg.a.y,seg.b.y)+30)/cell);
  for(let x=minx;x<=maxx;x++)for(let y=miny;y<=maxy;y++){
    const arr=grid.get(patrolGridKey(x,y));
    if(arr)arr.forEach(id=>ids.add(id));
  }
  return [...ids].map(i=>activeSegs[i]);
}
function patrolFindLineCrossings(activeRecords,line){
  const active=(activeRecords||[]).filter(hasGPS);
  if(active.length<2)return [];
  const routes=parsePatrolRouteInput(line);
  const activeKeys=patrolRouteKeysFromInput(line);
  const avgLat=active.reduce((s,r)=>s+getLat(r),0)/active.length;
  const activePts=patrolOrderedPoints(active,avgLat);
  const activeSegs=patrolMakeSegments(activePts);
  if(!activeSegs.length)return [];
  const cell=180;
  const grid=patrolBuildSegmentGrid(activeSegs,cell);
  const groups=new Map();
  const source=patrolLineCache&&patrolLineCacheStamp===(allRecords||[]).length?Array.from(patrolLineCache.entries()):null;
  if(source){
    for(const [key,arr] of source){
      if(activeKeys.has(key))continue;
      const recs=patrolDedupeSortRecords((arr||[]).filter(r=>r&&hasGPS(r)&&!recordMatchesAnyPatrolRoute(r,routes)));
      if(recs.length>=2)groups.set(key,recs);
    }
  }else{
    for(const r of (allRecords||[])){
      if(!r||!hasGPS(r)||recordMatchesAnyPatrolRoute(r,routes))continue;
      const key=patrolLineKeyForRecord(r);
      if(!key||activeKeys.has(key))continue;
      let arr=groups.get(key); if(!arr){arr=[];groups.set(key,arr)}
      arr.push(r);
    }
  }
  const hits=[], seen=new Set();
  for(const [key,recs] of groups){
    const pts=patrolOrderedPoints(recs,avgLat);
    if(pts.length<2)continue;
    const otherSegs=patrolMakeSegments(pts);
    for(const os of otherSegs){
        const candidates=patrolCandidateActiveSegments(os,grid,activeSegs,cell);
      for(const as of candidates){
        const angle=patrolAngleDiff(os.bearing,as.bearing);
        if(angle<22)continue;
        const dist=patrolSegmentDist(as.a,as.b,os.a,os.b);
        if(dist>18)continue;
        const hitKey=key+'|'+cleanLineText(getStructure(os.a.r))+'|'+cleanLineText(getStructure(os.b.r));
        if(seen.has(hitKey))continue;
        seen.add(hitKey);
        hits.push({key,line:getLine(os.a.r)||getLine(os.b.r)||key,a:os.a,b:os.b,dist,angle});
        break;
      }
    }
  }
  return hits;
}
async function patrolFindLineCrossingsAsync(activeRecords,line,token,onProgress){
  const active=(activeRecords||[]).filter(hasGPS);
  if(active.length<2)return [];
  const routes=parsePatrolRouteInput(line);
  const activeKeys=patrolRouteKeysFromInput(line);
  const avgLat=active.reduce((sum,r)=>sum+getLat(r),0)/active.length;
  const activePts=patrolOrderedPoints(active,avgLat);
  const activeSegs=patrolMakeSegments(activePts);
  if(!activeSegs.length)return [];
  const cell=180;
  const grid=patrolBuildSegmentGrid(activeSegs,cell);
  const cache=await ensurePatrolRouteCache('crossing',msg=>{if(token===patrolCrossingToken&&onProgress)onProgress(msg);});
  if(token!==patrolCrossingToken)return null;
  const entries=Array.from(cache.entries());
  const hits=[], seen=new Set();
  for(let gi=0;gi<entries.length;gi++){
    if(token!==patrolCrossingToken)return null;
    const [key,arr]=entries[gi];
    if(activeKeys.has(key))continue;
    const recs=patrolDedupeSortRecords((arr||[]).filter(r=>r&&hasGPS(r)&&!recordMatchesAnyPatrolRoute(r,routes)));
    if(recs.length>=2){
      const pts=patrolOrderedPoints(recs,avgLat);
      const otherSegs=patrolMakeSegments(pts);
      for(const os of otherSegs){
            const candidates=patrolCandidateActiveSegments(os,grid,activeSegs,cell);
        for(const as of candidates){
          const angle=patrolAngleDiff(os.bearing,as.bearing);
          if(angle<22)continue;
          const dist=patrolSegmentDist(as.a,as.b,os.a,os.b);
          if(dist>18)continue;
          const hitKey=key+'|'+cleanLineText(getStructure(os.a.r))+'|'+cleanLineText(getStructure(os.b.r));
          if(seen.has(hitKey))continue;
          seen.add(hitKey);
          hits.push({key,line:getLine(os.a.r)||getLine(os.b.r)||key,a:os.a,b:os.b,dist,angle});
          break;
        }
      }
    }
    if(gi%(performanceModeOn()?8:20)===0){
      if(onProgress)onProgress(`Checking route crossings... ${Number(gi).toLocaleString()} / ${Number(entries.length).toLocaleString()} route groups`);
      await sleepFrame?.();
    }
  }
  return hits;
}


function drawPatrolLineCrossings(activeRecords,line,warnId){
  if(!heliCrossingWarnLayer)return;
  if(performanceSettings && performanceSettings.crossings===false){
    const warn=document.getElementById(warnId);
    if(warn){warn.textContent='Route crossing check off';warn.classList.remove('active');}
    return;
  }
  const token=++patrolCrossingToken;
  heliCrossingWarnLayer.clearLayers();
  const warn=document.getElementById(warnId);
  if(warn){warn.textContent=line?'Checking route crossings...':'No route crossings detected on loaded data';warn.classList.remove('active');}
  if(!line||!(activeRecords||[]).length){return;}
  (async()=>{
    try{
      const hits=await patrolFindLineCrossingsAsync(activeRecords,line,token,msg=>{if(token===patrolCrossingToken&&warn)warn.textContent=msg;});
      if(token!==patrolCrossingToken||!hits)return;
      for(let i=0;i<hits.length;i++){
        const h=hits[i];
        const pts=[[h.a.lat,h.a.lng],[h.b.lat,h.b.lng]];
        const seg=L.polyline(pts,{color:'#d71920',weight:3,opacity:.95,dashArray:'6 6',className:'patrol-cross-line'}).addTo(heliCrossingWarnLayer);
        seg.bindTooltip(`ROUTE CROSSING: ${h.line} | ${getStructure(h.a.r)} → ${getStructure(h.b.r)}`);
        [h.a,h.b].forEach(pt=>{
          const dot=L.circleMarker([pt.lat,pt.lng],{radius:5,color:'#d71920',weight:2,fillColor:'#d71920',fillOpacity:.92,className:'patrol-cross-dot'}).addTo(heliCrossingWarnLayer);
          dot.bindTooltip(`${h.line} | ${getStructure(pt.r)}`);
        });
        if(i%12===0)await sleepFrame?.();
      }
      if(warn){warn.textContent=hits.length?`⚠ ROUTE CROSSING: ${hits.length} actual crossing segment${hits.length===1?'':'s'} found`:'No route crossings detected on loaded data';warn.classList.toggle('active',hits.length>0);}
    }catch(e){
      console.warn('Crossing check failed',e);
      if(warn){warn.textContent='Crossing check failed';warn.classList.remove('active');}
    }
  })();
}
function drawHeliLineCrossings(){
  drawPatrolLineCrossings(heliActiveLineRecords,getHeliLineText(),'heliCrossingWarn');
}
function drawGroundLineCrossings(){
  drawPatrolLineCrossings(groundActiveLineRecords,getGroundLineText(),'groundCrossingWarn');
}

function updateHeliNearestPoles(){
  const prevEl=document.getElementById('heliPrevPole'), nextEl=document.getElementById('heliNextPole'), nearEl=document.getElementById('heliNearestPole');
  heliNextTargetRecord=null;
  if(!heliLastFix||!heliActiveLineRecords.length){if(prevEl)prevEl.textContent='--';if(nextEl)nextEl.textContent='--';if(nearEl)nearEl.textContent='--';return;}
  const info=patrolNearestInfo(heliActiveRouteGroups,heliActiveLineRecords,heliLastFix);
  if(!info){if(prevEl)prevEl.textContent='--';if(nextEl)nextEl.textContent='--';if(nearEl)nearEl.textContent='--';return;}
  const nearest=info.record;
  const prev=info.records[Math.max(0,info.index-1)];
  const next=info.records[Math.min(info.records.length-1,info.index+1)];
  heliNextTargetRecord=next||nearest;
  const fmtPoint=r=>r?`${getStructure(r)} · ${Math.round(distanceMeters(heliLastFix.lat,heliLastFix.lng,getLat(r),getLng(r)))} m`:'--';
  if(nearEl)nearEl.textContent=fmtPoint(nearest);
  if(prevEl)prevEl.textContent=fmtPoint(prev);
  if(nextEl)nextEl.textContent=fmtPoint(next);
}


async function heliNextPole(){
  if(!heliActiveLineRecords.length)await heliRefreshLine();
  const target=heliNextTargetRecord||heliActiveLineRecords[0];
  if(target){selectAsset((typeof recordIndexOf==='function'?recordIndexOf(target):allRecords.indexOf(target))); map.setView([getLat(target),getLng(target)],18); showToolStatus('Next point loaded: '+getStructure(target));}
}

async function heliSaveLocation(){
  const f=heliLastFix||heliBestFix;
  if(!f){alert('No GPS fix yet.');return;}
  const mark={id:Date.now(),type:'location',line:getHeliLineText(),gps:{lat:f.lat,lng:f.lng,accuracy:f.accuracy,altitude:f.altitude,heading:f.heading,speed:f.speed},createdAt:new Date().toISOString(),note:document.getElementById('heliLocationNote')?.value||''};
  heliMarks.push(mark); localStorage.setItem(HELI_KEY,JSON.stringify(heliMarks));
  if(typeof ensureExportFolder==='function'){
    try{
      const folder=await ensureExportFolder(true);
      if(folder){
        const file=await folder.getFileHandle('helicopter-patrol-locations.json',{create:true});
        const writable=await file.createWritable();
        await writable.write(JSON.stringify(heliMarks.filter(x=>x.type==='location'),null,2));
        await writable.close();
      }
    }catch(e){console.warn('Heli location folder save failed',e);}
  }
  showToolStatus('Helicopter location saved.');
}

function toggleHeliCompact(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();}
  const box=document.getElementById('heliPage');
  const btn=document.getElementById('heliCollapseBtn');
  if(!box)return;
  const compact=!box.classList.contains('compact');
  box.classList.toggle('compact',compact);
  if(btn)btn.textContent=compact?'▸':'▾';
  localStorage.setItem('asset_tracker_v35_heli_compact',compact?'1':'0');
}

function restoreHeliCompact(){
  const box=document.getElementById('heliPage');
  const btn=document.getElementById('heliCollapseBtn');
  if(!box)return;
  const compact=localStorage.getItem('asset_tracker_v35_heli_compact')==='1';
  box.classList.toggle('compact',compact);
  if(btn)btn.textContent=compact?'▸':'▾';
}

function initHeliOverlayDrag(){
  const box=document.getElementById('heliPage'), head=document.getElementById('heliDragHandle');
  if(!box||!head)return;
  const setPos=(left,top)=>{
    if(!Number.isFinite(left)||!Number.isFinite(top))return;
    const maxLeft=Math.max(4,window.innerWidth-box.offsetWidth-4);
    const maxTop=Math.max(4,window.innerHeight-box.offsetHeight-4);
    left=Math.max(4,Math.min(maxLeft,left));
    top=Math.max(4,Math.min(maxTop,top));
    box.style.setProperty('left',left+'px','important');
    box.style.setProperty('top',top+'px','important');
    box.style.setProperty('right','auto','important');
    box.style.setProperty('bottom','auto','important');
    box.classList.add('patrol-moved');
  };
  const saved=load('asset_tracker_v35_heli_overlay_pos',null);
  if(saved&&Number.isFinite(parseFloat(saved.left))&&Number.isFinite(parseFloat(saved.top))){
    setPos(parseFloat(saved.left),parseFloat(saved.top));
  }
  let sx=0,sy=0,ox=0,oy=0,drag=false,moved=false;
  const down=e=>{
    if(e.target&&e.target.closest&&e.target.closest('button,input,textarea,select'))return;
    const p=e.touches?e.touches[0]:e;
    drag=true; moved=false; sx=p.clientX; sy=p.clientY;
    const r=box.getBoundingClientRect(); ox=r.left; oy=r.top;
    box.classList.add('patrol-dragging');
    try{head.setPointerCapture?.(e.pointerId);}catch(_){}
    try{e.preventDefault();}catch(_){}
  };
  const move=e=>{
    if(!drag)return;
    const p=e.touches?e.touches[0]:e;
    const dx=p.clientX-sx, dy=p.clientY-sy;
    if(Math.abs(dx)>2||Math.abs(dy)>2)moved=true;
    setPos(ox+dx,oy+dy);
    try{e.preventDefault();}catch(_){}
  };
  const up=()=>{
    if(!drag)return;
    drag=false; box.classList.remove('patrol-dragging');
    const r=box.getBoundingClientRect();
    localStorage.setItem('asset_tracker_v35_heli_overlay_pos',JSON.stringify({left:Math.round(r.left)+'px',top:Math.round(r.top)+'px'}));
  };
  head.addEventListener('pointerdown',down);
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',up);
  window.addEventListener('resize',()=>{const r=box.getBoundingClientRect();setPos(r.left,r.top);},{passive:true});
}

/* Legacy Ground Patrol removed in v3.8.7; unified Patrol uses heliPage. */
function closeGroundPatrol(){document.body.classList.remove("ground-open");}
function stopGroundGPS(){}
function toggleGroundCompact(ev){ev&&ev.stopPropagation&&ev.stopPropagation();}
function restoreGroundCompact(){}
function initGroundOverlayDrag(){}
function groundRefreshLine(){return heliRefreshLine();}
function groundBestGPS(){return heliBestGPS();}
function groundGoNextPole(){return heliNextPole();}
function groundOpenGoogleMaps(){return heliOpenCurrentLocationInGoogleMaps&&heliOpenCurrentLocationInGoogleMaps();}
function groundSaveLocation(){return heliSaveLocation();}
/* v3.7.3 unified Patrol overlay: one button, one GPS watch, GPS + yellow/orange estimates included in nearest asset. */
function patrolIsDisplayPoint(x){return !!(x && typeof x==='object' && ('lat' in x) && ('lng' in x) && ('r' in x || 'estimated' in x || 'gapEstimate' in x));}
function patrolPointHasCoord(x){
  if(patrolIsDisplayPoint(x))return Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng));
  return !!(x&&hasGPS(x));
}
function patrolPointLat(x){return patrolIsDisplayPoint(x)?Number(x.lat):getLat(x)}
function patrolPointLng(x){return patrolIsDisplayPoint(x)?Number(x.lng):getLng(x)}
function patrolPointRecord(x){return patrolIsDisplayPoint(x)?(x.r||{}):(x||{})}
function patrolPointIndex(x){
  if(patrolIsDisplayPoint(x)&&Number.isInteger(x.recIndex))return x.recIndex;
  const r=patrolPointRecord(x);
  return (r&&Number.isInteger(r.__idx))?r.__idx:(typeof recordIndexOf==='function'?recordIndexOf(r):(allRecords||[]).indexOf(r));
}
function patrolPointTitle(x){
  if(patrolIsDisplayPoint(x)&&x.gapEstimate){
    const plate=(x.plate!==undefined&&x.plate!==null)?String(x.plate):'';
    return plate?('Estimated '+plate):'Estimated missing asset';
  }
  return getStructure(patrolPointRecord(x)) || (patrolIsDisplayPoint(x)&&x.estimated?'Estimated asset':'Asset');
}
function patrolPointLine(x){return getLine(patrolPointRecord(x)) || (patrolIsDisplayPoint(x)&&x.r&&x.r.__line) || ''}
function patrolPointIsEstimate(x){return !!(patrolIsDisplayPoint(x)&&x.estimated)}
function patrolPointIsGapEstimate(x){return !!(patrolIsDisplayPoint(x)&&x.gapEstimate)}
function patrolPointDistanceMeters(fix,x){return distanceMeters(fix.lat,fix.lng,patrolPointLat(x),patrolPointLng(x))}
function patrolPointSortValue(x){
  try{if(patrolIsDisplayPoint(x)&&typeof routeDisplayOrderValue==='function')return routeDisplayOrderValue(x);}catch(e){}
  const n=poleNumber(patrolPointRecord(x));
  return Number.isFinite(n)?n:999999;
}
function patrolPointKey(x){
  if(patrolIsDisplayPoint(x)){
    try{if(typeof routeEstimateKey==='function'&&x.estimated)return 'E:'+routeEstimateKey(x);}catch(e){}
    return 'D:'+[patrolPointIndex(x),patrolPointTitle(x),patrolPointLat(x).toFixed(6),patrolPointLng(x).toFixed(6),x.gapEstimate?'gap':''].join('|');
  }
  const r=x||{};
  return 'R:'+[(r.__idx!==undefined?r.__idx:''),cleanLineText(getLine(r)||''),cleanLineText(getStructure(r)||''),Number(getLat(r)).toFixed(6),Number(getLng(r)).toFixed(6)].join('|');
}
function patrolDedupeSortPoints(points){
  const seen=new Set(), out=[];
  for(const p of points||[]){
    if(!p||!patrolPointHasCoord(p))continue;
    const key=patrolPointKey(p);
    if(seen.has(key))continue;
    seen.add(key); out.push(p);
  }
  out.sort((a,b)=>patrolPointSortValue(a)-patrolPointSortValue(b)||String(patrolPointTitle(a)).localeCompare(String(patrolPointTitle(b))));
  return out;
}
function patrolRouteFallbackRecords(line){
  const out=[];
  const key=cleanLineText(line);
  for(const r of (allRecords||[])){
    if(!r)continue;
    try{if(matchesHeliLine(r,key||line))out.push(r);}catch(e){}
  }
  return typeof routeRecordsOnly==='function'?routeRecordsOnly(out):out;
}
async function patrolRouteDisplayPointsAsync(line,mode,onProgress){
  const label=String(line||'').trim();
  if(!label)return [];
  if(onProgress)onProgress('Finding route records...');
  let hits=[];
  try{if(typeof routeHitsFromCache==='function')hits=routeHitsFromCache(label)||[];}catch(e){hits=[];}
  if(!hits.length)hits=patrolRouteFallbackRecords(label);
  try{if(typeof routeRecordsOnly==='function')hits=routeRecordsOnly(hits);}catch(e){}
  if(onProgress)onProgress(`Building GPS + estimate points... ${hits.length.toLocaleString()} source records`);
  let dps=[];
  try{if(typeof routeDisplayPointList==='function')dps=routeDisplayPointList(hits)||[];}catch(e){dps=[];}
  if(!dps.length){
    dps=(hits||[]).filter(hasGPS).map((r,sourceOrder)=>({r,sourceOrder,recIndex:patrolPointIndex(r),plate:poleNumber(r),hasGPS:true,lat:getLat(r),lng:getLng(r),estimated:false}));
  }
  return patrolDedupeSortPoints(dps);
}
async function patrolRouteGroupsAsync(text,mode,onProgress){
  const routes=parsePatrolRouteInput(text);
  const groups=[];
  for(let i=0;i<routes.length;i++){
    const label=routes[i];
    const points=await patrolRouteDisplayPointsAsync(label,mode,msg=>{if(onProgress)onProgress(routes.length>1?`Route ${i+1}/${routes.length}: ${msg}`:msg);});
    groups.push({label,records:points});
    if(i%2===1)await sleepFrame?.();
  }
  return groups.filter(g=>g.records&&g.records.length);
}
function patrolMergeRouteGroups(groups){
  const all=[];
  for(const g of groups||[])all.push(...(g.records||[]));
  return patrolDedupeSortPoints(all);
}
function patrolNearestInfo(groups,fallbackRecords,fix){
  const useGroups=(groups&&groups.length)?groups:[{label:'',records:fallbackRecords||[]}];
  let best={group:null,records:[],record:null,index:-1,dist:Infinity};
  for(const group of useGroups){
    const records=patrolDedupeSortPoints(group.records||[]);
    for(let i=0;i<records.length;i++){
      const p=records[i];
      const d=patrolPointDistanceMeters(fix,p);
      if(d<best.dist)best={group,records,record:p,index:i,dist:d};
    }
  }
  return best.record?best:null;
}
function patrolDrawOrderedRoute(records,layer,line,mode){
  if(!layer||!records||!records.length)return;
  const points=patrolDedupeSortPoints(records);
  try{
    if(typeof routeDrawEstimateAwareLine==='function'){
      routeDrawEstimateAwareLine(points,layer,{tooltip:`${line} | patrol route`,weight:mode==='ground'?5:4,opacity:.82,className:'patrol-route-line'});
      return;
    }
  }catch(e){}
  const gps=points.filter(p=>!patrolPointIsEstimate(p)&&patrolPointHasCoord(p));
  if(gps.length>1){
    const lineObj=L.polyline(gps.map(p=>[patrolPointLat(p),patrolPointLng(p)]),{color:'#2f80ed',weight:mode==='ground'?5:4,opacity:.82,fill:false,lineCap:'round',lineJoin:'round',smoothFactor:.6,className:'patrol-route-line'}).addTo(layer);
    if(typeof registerMapToggleLayer==='function')registerMapToggleLayer(lineObj,null,'line');
    lineObj.bindTooltip(`${line} | patrol route`);
  }
}
function patrolBindPointMarker(marker,p){
  try{
    if(patrolIsDisplayPoint(p)){
      marker._tlEstimateType=p.gapEstimate?'gap':(p.estimated?'estimate':'trueGps');
      marker.bindTooltip(patrolPointTitle(p)+(p.estimated?' | estimate':''));
      if(typeof bindRouteDisplayPopup==='function')bindRouteDisplayPopup(marker,p);
      else marker.on('click',()=>{selected=patrolPointRecord(p);selectedMarker=marker;});
      if(p.estimated&&typeof routeCreateEstimateHitTarget==='function')routeCreateEstimateHitTarget(marker,p);
    }else{
      const i=patrolPointIndex(p);
      marker.bindTooltip(patrolPointTitle(p));
      if(typeof bindAssetMiniPopup==='function')bindAssetMiniPopup(marker,i);
    }
  }catch(e){}
}
function patrolAddDotsChunked(points,mode,token){
  const list=patrolDedupeSortPoints(points||[]);
  let n=0;
  function addBatch(){
    if(token!==patrolDrawToken || !assetLayer)return;
    const end=Math.min(n+performanceBatch(70),list.length);
    for(;n<end;n++){
      const p=list[n];
      let style;
      try{style=(patrolIsDisplayPoint(p)&&typeof routeDisplayMarkerStyle==='function')?routeDisplayMarkerStyle(p):{radius:mode==='ground'?6:5,weight:2,fillOpacity:.92,className:'patrol-active-dot'};}catch(e){style={radius:mode==='ground'?6:5,weight:2,fillOpacity:.92,className:'patrol-active-dot'};}
      const m=L.circleMarker([patrolPointLat(p),patrolPointLng(p)],style).addTo(assetLayer);
      if(typeof registerMapToggleLayer==='function')registerMapToggleLayer(m,patrolPointRecord(p),'dot');
      patrolBindPointMarker(m,p);
    }
    applyMapToggleSettings?.();
    if(n<list.length){
      showToolStatus?.(`Patrol loading... ${n.toLocaleString()} / ${list.length.toLocaleString()} GPS/estimate dots`);
      requestAnimationFrame(addBatch);
    }else{
      const est=list.filter(p=>patrolPointIsEstimate(p)).length;
      showToolStatus?.(`Patrol loaded: ${list.length.toLocaleString()} shown | ${est.toLocaleString()} estimate${est===1?'':'s'} included`);
    }
  }
  requestAnimationFrame(addBatch);
}
function patrolShowOnlyLine(records,line,mode,groups){
  forceMapAssetsVisibleForRoute?.();
  if(!assetLayer||!map)return;
  patrolDrawToken++;
  assetLayer.clearLayers();
  selectedMarker=null;
  selected=null;
  const points=patrolDedupeSortPoints(records||[]);
  const label=patrolRouteLabel(line)||line;
  if(!label||!points.length){
    showToolStatus?.(label?`No GPS/estimate points found for ${label}.`:'Patrol selection cleared.');
    return;
  }
  const token=patrolDrawToken;
  const drawGroups=(groups&&groups.length)?groups:[{label,records:points}];
  for(const g of drawGroups){
    const rows=patrolDedupeSortPoints(g.records||[]);
    if(rows.length)patrolDrawOrderedRoute(rows,assetLayer,g.label||label,mode);
  }
  try{
    const bounds=L.latLngBounds(points.map(p=>[patrolPointLat(p),patrolPointLng(p)]));
    if(bounds.isValid())map.fitBounds(bounds,{padding:[45,45],maxZoom:16});
  }catch(e){}
  patrolAddDotsChunked(points,mode,token);
  const routeCount=(groups&&groups.length)||parsePatrolRouteInput(line).length||1;
  const est=points.filter(p=>patrolPointIsEstimate(p)).length;
  showToolStatus?.(`Patrol: ${routeCount} route${routeCount===1?'':'s'} | ${points.length.toLocaleString()} GPS/estimate point${points.length===1?'':'s'} | ${est.toLocaleString()} estimate${est===1?'':'s'} included`);
}
function patrolFormatPointForNearest(p,fix){
  if(!p||!fix)return '--';
  const d=patrolPointDistanceMeters(fix,p);
  const flags=[];
  if(patrolPointIsGapEstimate(p))flags.push('INFERRED');
  else if(patrolPointIsEstimate(p))flags.push('EST');
  const warn=flags.length?' ['+flags.join('/')+']':'';
  return `${patrolPointTitle(p)}${warn} · ${Math.round(d)} m`;
}
function togglePatrolOverlayFromMenu(ev){
  ev?.stopPropagation?.();
  const p=document.getElementById('heliPage');
  if(p&&p.classList.contains('open')){
    closeHeliPatrol();
    closePlus?.();
    showToolStatus('Patrol overlay off.');
    return;
  }
  openHeliPatrol();
}
function toggleHeliPatrolFromMenu(ev){togglePatrolOverlayFromMenu(ev)}
function toggleGroundPatrolFromMenu(ev){togglePatrolOverlayFromMenu(ev)}
function openHeliPatrol(){
  try{closeGroundPatrol?.();}catch(e){}
  closePlus?.(); closeSettings?.(); closePOI?.(); closeDrawer?.();
  const p=document.getElementById('heliPage');
  if(p)p.classList.add('open');
  const g=document.getElementById('groundPage');
  if(g)g.classList.remove('open');
  document.body.classList.add('heli-open');
  document.body.classList.remove('ground-open');
  document.querySelector('.fab')?.classList.add('heli-active');
  if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();
  if(!heliOverlayReady){initHeliOverlayDrag(); restoreHeliCompact(); heliOverlayReady=true;}
  ensureHeliLayers();
  startHeliGPS();
  const count=document.getElementById('heliLineCount');
  if(count && !heliActiveLineRecords.length)count.textContent='Type route(s), then press Enter or Load';
  showToolStatus('Patrol overlay on. GPS marker tracking; nearest includes yellow/orange estimates.');
}
function closeHeliPatrol(){
  const p=document.getElementById('heliPage');
  if(p)p.classList.remove('open');
  document.body.classList.remove('heli-open');
  document.querySelector('.fab')?.classList.remove('heli-active');
  stopHeliGPS();
  if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();
}
async function heliRefreshLine(){
  ensureHeliLayers();
  const input=getHeliLineText();
  const routes=parsePatrolRouteInput(input);
  const label=patrolRouteLabel(input);
  const token=++heliLineLoadToken;
  const count=document.getElementById('heliLineCount');
  if(count)count.textContent=routes.length?'Finding route selection...':'Type route(s), comma separated, then press Enter or Load';
  if(!routes.length){
    heliActiveLineRecords=[]; heliActiveRouteGroups=[]; heliNextTargetRecord=null;
    patrolShowOnlyLine([],input,'patrol'); updateHeliNearestPoles(); return;
  }
  try{
    const groups=await patrolRouteGroupsAsync(input,'patrol',msg=>{if(token===heliLineLoadToken&&count)count.textContent=msg;});
    if(token!==heliLineLoadToken)return;
    heliActiveRouteGroups=groups;
    heliActiveLineRecords=patrolMergeRouteGroups(groups);
    const est=heliActiveLineRecords.filter(p=>patrolPointIsEstimate(p)).length;
    const gaps=heliActiveLineRecords.filter(p=>patrolPointIsGapEstimate(p)).length;
    if(count)count.textContent=heliActiveLineRecords.length?`${groups.length} route${groups.length===1?'':'s'} | ${heliActiveLineRecords.length.toLocaleString()} GPS/estimate points | ${est.toLocaleString()} estimates | ${gaps.toLocaleString()} inferred`: 'No matching route loaded';
    if(heliEstimateLayer)heliEstimateLayer.clearLayers();
    patrolShowOnlyLine(heliActiveLineRecords,input,'patrol',groups);
    drawHeliLineCrossings();
    updateHeliNearestPoles();
  }catch(e){
    console.warn('Patrol route load failed',e);
    if(count)count.textContent='Route load failed';
    showToolStatus?.('Patrol route load failed.');
  }
}
function heliOnGPS(p){
  const c=p.coords||{};
  const fix={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy||9999,altitude:c.altitude,heading:c.heading,speed:c.speed,time:Date.now()};
  heliLastFix=fix;
  if(!heliBestFix || fix.accuracy<heliBestFix.accuracy)heliBestFix=fix;
  const ll=[fix.lat,fix.lng];
  if(locMarker)locMarker.setLatLng(ll);
  else locMarker=L.marker(ll,{icon:L.divIcon({className:'loc-marker'})}).addTo(map);
  locMarker._gps=ll;
  try{if(typeof registerMapToggleLayer==='function')registerMapToggleLayer(locMarker,null,'location');}catch(e){}
  patrolFollowGPS(fix,'heli');
  updateHeliTelemetry();
  if(patrolShouldUpdateNearest('heli',fix))updateHeliNearestPoles();
}
function updateHeliNearestPoles(){
  const prevEl=document.getElementById('heliPrevPole'), nextEl=document.getElementById('heliNextPole'), nearEl=document.getElementById('heliNearestPole');
  heliNextTargetRecord=null;
  if(!heliLastFix||!heliActiveLineRecords.length){if(prevEl)prevEl.textContent='--';if(nextEl)nextEl.textContent='--';if(nearEl)nearEl.textContent='--';return;}
  const info=patrolNearestInfo(heliActiveRouteGroups,heliActiveLineRecords,heliLastFix);
  if(!info){if(prevEl)prevEl.textContent='--';if(nextEl)nextEl.textContent='--';if(nearEl)nearEl.textContent='--';return;}
  const nearest=info.record;
  const prev=info.records[Math.max(0,info.index-1)];
  const next=info.records[Math.min(info.records.length-1,info.index+1)];
  heliNextTargetRecord=next||nearest;
  if(nearEl)nearEl.textContent=patrolFormatPointForNearest(nearest,heliLastFix);
  if(prevEl)prevEl.textContent=patrolFormatPointForNearest(prev,heliLastFix);
  if(nextEl)nextEl.textContent=patrolFormatPointForNearest(next,heliLastFix);
}
async function heliNextPole(){
  if(!heliActiveLineRecords.length)await heliRefreshLine();
  const target=heliNextTargetRecord||heliActiveLineRecords[0];
  if(target&&patrolPointHasCoord(target)){
    map.setView([patrolPointLat(target),patrolPointLng(target)],18);
    showToolStatus('Next patrol asset: '+patrolPointTitle(target)+(patrolPointIsEstimate(target)?' | estimate warning':'') );
  }
}
function heliSaveLocation(){
  const f=heliLastFix||heliBestFix;
  if(!f){alert('No GPS fix yet.');return;}
  const mark={id:Date.now(),type:'patrol-location',line:getHeliLineText(),gps:{lat:f.lat,lng:f.lng,accuracy:f.accuracy,altitude:f.altitude,heading:f.heading,speed:f.speed},createdAt:new Date().toISOString(),note:document.getElementById('heliLocationNote')?.value||''};
  heliMarks.push(mark); localStorage.setItem(HELI_KEY,JSON.stringify(heliMarks));
  showToolStatus('Patrol location saved locally.');
}
