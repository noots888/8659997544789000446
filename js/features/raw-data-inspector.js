/* v3.6.73 Raw Data Inspector. No upload/network use; reads local in-memory records only. */
let rawInspectorMatches=[];
let rawInspectorRunId=0;

function rawInspectorEl(){return document.getElementById('rawInspectorBody');}
function openRawInspector(){
  closePlus?.(); closeDrawer?.(); closePOI?.(); closeAssetIndex?.();
  const p=document.getElementById('rawInspectorPage');
  if(!p)return;
  p.classList.add('open');
  document.body.classList.add('raw-inspector-open');
  renderRawInspector();
}
function closeRawInspector(){
  document.getElementById('rawInspectorPage')?.classList.remove('open');
  document.body.classList.remove('raw-inspector-open');
}
function rawEsc(s){return (typeof esc==='function')?esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function rawNorm(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
function rawCompact(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function rawSourceName(r){return String((r&&(r.__sourceFile||(r.original&&r.original.__sourceFile)||r.SOURCE_FILE||r.sourceFile||r.fileName||r.filename))||'Unknown source').trim()||'Unknown source';}
function rawText(r){
  const source=r?.original&&typeof r.original==='object'?r.original:r;
  let parts=[r?.__search,getStructure?.(r),getLine?.(r),getType?.(r),getSubstationName?.(r),getDepotName?.(r),resolveConductor?.(r),rawSourceName(r)];
  try{
    Object.entries(source||{}).slice(0,90).forEach(([k,v])=>{if(v!==null&&v!==undefined&&typeof v!=='object')parts.push(k,v);});
  }catch(e){}
  return rawNorm(parts.join(' '));
}
function rawSearchMatch(r,q,qc){
  if(!q)return true;
  const txt=rawText(r), compact=rawCompact(txt);
  const words=q.split(' ').filter(Boolean);
  if(txt.includes(q)||compact.includes(qc))return true;
  if(words.length && words.every(w=>txt.includes(w)||compact.includes(rawCompact(w))))return true;
  try{return !!looseCodeMatch?.(r,q,qc);}catch(e){return false;}
}
function rawAllRouteCandidates(r){
  const vals=[];
  const add=v=>{if(v!==undefined&&v!==null&&String(v).trim())vals.push(String(v).trim());};
  try{(routeOnlyCandidates?.(r)||[]).forEach(add);}catch(e){}
  try{(lineCandidates?.(r)||[]).forEach(add);}catch(e){}
  try{(r.__lines||[]).forEach(add);}catch(e){}
  const src=r?.original||r||{};
  ['__line','ROUTE_NAME','ROUTE','ROUTE_ID','LINE_NAME','LINE_NAME_1','LINE_NAME_2','LINE_NAME_3','LINE','CIRCUIT','CIRCUIT_NAME','FEEDER','NETWORK_ROUTE','ABBREVIATION'].forEach(k=>add(src[k]||r?.[k]));
  return unique?unique(vals):[...new Set(vals)];
}
function rawShownByCurrentFilters(r){
  try{return resultKindAllowed?.(r)!==false;}catch(e){return true;}
}
function rawStatus(r){
  const gps=!!(typeof hasGPS==='function'?hasGPS(r):(r&&r.__hasGPS));
  const routes=rawAllRouteCandidates(r);
  const grouped=routes.map(x=>canonicalRouteName?canonicalRouteName(x):x).filter(Boolean);
  const key=typeof importDedupeKey==='function'?importDedupeKey(r):'';
  return {gps,routes,grouped,hasRoute:!!grouped.length,shown:rawShownByCurrentFilters(r),key,source:rawSourceName(r)};
}
function rawBuildSummary(records,queryLabel){
  const total=(allRecords||[]).length;
  const src=new Map(), dup=new Set();
  const s={total,matched:records.length,gps:0,noGps:0,noRoute:0,hiddenByFilter:0,dupes:0,points:0,sites:0,bases:0,details:0,sourceCount:0};
  for(const r of records){
    const st=rawStatus(r);
    st.gps?s.gps++:s.noGps++;
    if(!st.hasRoute)s.noRoute++;
    if(!st.shown)s.hiddenByFilter++;
    if(st.key){if(dup.has(st.key))s.dupes++; else dup.add(st.key);}
    src.set(st.source,(src.get(st.source)||0)+1);
    const k=String(r?.__kind||getType?.(r)||'asset').toLowerCase();
    if(k.includes('conductor')||k.includes('detail'))s.details++;
    else if(k.includes('depot')||k.includes('base'))s.bases++;
    else if(k.includes('substation')||k.includes('terminal')||k.includes('site'))s.sites++;
    else s.points++;
  }
  s.sourceCount=src.size;
  s.sources=[...src.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,12);
  return s;
}
function rawMetric(label,value){return `<div class="raw-inspector-metric"><b>${rawEsc(value)}</b><span>${rawEsc(label)}</span></div>`;}
function rawSummaryHTML(s){
  return `<div class="raw-inspector-summary">
    ${rawMetric('Total accepted records',Number(s.total||0).toLocaleString())}
    ${rawMetric('Matched records',Number(s.matched||0).toLocaleString())}
    ${rawMetric('Map-loadable GPS',Number(s.gps||0).toLocaleString())}
    ${rawMetric('Accepted but no GPS',Number(s.noGps||0).toLocaleString())}
    ${rawMetric('No route/group',Number(s.noRoute||0).toLocaleString())}
    ${rawMetric('Hidden by current filters',Number(s.hiddenByFilter||0).toLocaleString())}
    ${rawMetric('Possible duplicate keys',Number(s.dupes||0).toLocaleString())}
    ${rawMetric('Source files matched',Number(s.sourceCount||0).toLocaleString())}
  </div>`;
}
function renderRawInspector(){
  const e=rawInspectorEl(); if(!e)return;
  const q=(document.getElementById('rawInspectorSearch')?.value||'').trim();
  const summary=rawBuildSummary(rawInspectorMatches.length?rawInspectorMatches:[],q);
  e.innerHTML=`<div class="raw-inspector-panel">
    <div class="raw-inspector-search"><input id="rawInspectorSearch" placeholder="Search exact route, point, source file, or raw field..." value="${rawEsc(q)}" onkeydown="if(event.key==='Enter'){event.preventDefault();runRawInspector();}"><button onclick="runRawInspector()">Inspect</button></div>
    <div class="raw-inspector-actions"><button class="green" onclick="rawInspectorShowMatchedOnMap()">Show matched GPS on map</button><button onclick="rawInspectorClear()">Clear</button><button onclick="renderRawInspectorFullSummary()">Full local summary</button></div>
    <div class="raw-inspector-alert">This inspector ignores the normal Search filters. It is for proving whether data is imported, hidden, missing GPS, deduped, or grouped under a different route.</div>
    <div id="rawInspectorSummary">${rawSummaryHTML(summary)}</div>
  </div>
  <div id="rawInspectorResults" class="raw-inspector-list"><div class="raw-inspector-panel">Type a route/point/source and press Inspect. Use a short exact code if possible.</div></div>`;
}
function rawInspectorClear(){rawInspectorMatches=[];renderRawInspector();}
async function runRawInspector(){
  const run=++rawInspectorRunId;
  const input=document.getElementById('rawInspectorSearch');
  const q=rawNorm(input?.value||''), qc=rawCompact(input?.value||'');
  const results=document.getElementById('rawInspectorResults');
  const summaryEl=document.getElementById('rawInspectorSummary');
  if(!q){rawInspectorMatches=[]; if(results)results.innerHTML='<div class="raw-inspector-panel">Enter a route, point, source file, or raw value first.</div>'; return;}
  rawInspectorMatches=[];
  const total=(allRecords||[]).length;
  if(results)results.innerHTML=`<div class="raw-inspector-panel">Inspecting local records… 0 / ${Number(total).toLocaleString()}</div>`;
  for(let i=0;i<total;i++){
    const r=allRecords[i];
    if(rawSearchMatch(r,q,qc))rawInspectorMatches.push(r);
    if(i%700===0){
      if(run!==rawInspectorRunId)return;
      if(results)results.innerHTML=`<div class="raw-inspector-panel">Inspecting local records… ${Number(i).toLocaleString()} / ${Number(total).toLocaleString()} · matches ${Number(rawInspectorMatches.length).toLocaleString()}</div>`;
      await sleepFrame?.();
    }
  }
  if(run!==rawInspectorRunId)return;
  const s=rawBuildSummary(rawInspectorMatches,input?.value||'');
  if(summaryEl)summaryEl.innerHTML=rawSummaryHTML(s)+rawInspectorWarningsHTML(s);
  if(results)results.innerHTML=rawInspectorResultsHTML(rawInspectorMatches,s,input?.value||'');
}
function rawInspectorWarningsHTML(s){
  const bits=[];
  if(s.noGps)bits.push(`<div class="raw-inspector-alert red">${Number(s.noGps).toLocaleString()} matched records are accepted but cannot show on the map because no usable GPS was extracted.</div>`);
  if(s.hiddenByFilter)bits.push(`<div class="raw-inspector-alert">${Number(s.hiddenByFilter).toLocaleString()} matched records are currently hidden by the active Index filters.</div>`);
  if(s.noRoute)bits.push(`<div class="raw-inspector-alert">${Number(s.noRoute).toLocaleString()} matched records have no route/group, so route loading will not find them unless searched directly.</div>`);
  if(s.dupes)bits.push(`<div class="raw-inspector-alert">${Number(s.dupes).toLocaleString()} possible duplicate identity keys are present inside these matches.</div>`);
  return bits.join('');
}
function rawInspectorResultsHTML(records,summary,query){
  if(!records.length)return `<div class="raw-inspector-panel">No accepted imported records matched <b>${rawEsc(query)}</b>. Check the skipped samples below or re-import with Replace all.</div>${rawSkippedSamplesHTML()}`;
  const src=summary.sources?.length?`<div class="raw-inspector-panel"><b>Matched source files</b><div class="raw-tags">${summary.sources.map(([n,c])=>`<span class="raw-tag">${rawEsc(n)} · ${Number(c).toLocaleString()}</span>`).join('')}</div></div>`:'';
  const cards=records.map(rawRecordCard).join('');
  const more='';
  return src+cards+more+rawSkippedSamplesHTML();
}
function rawRecordCard(r){
  const i=(typeof recordIndexOf==='function'?recordIndexOf(r):(allRecords||[]).indexOf(r));
  const st=rawStatus(r);
  const title=getStructure?.(r)||r?.__title||'Record';
  const route=getLine?.(r)||st.grouped[0]||'No route';
  const gpsTxt=st.gps?`${Number(getLat(r)).toFixed(6)}, ${Number(getLng(r)).toFixed(6)}`:'No GPS';
  const fields=rawPreviewFields(r);
  return `<div class="raw-record-card"><h4>${rawEsc(title)}</h4><p>${rawEsc(route)} · ${rawEsc(st.source)}</p><div class="raw-tags"><span class="raw-tag ${st.gps?'green':'red'}">${rawEsc(gpsTxt)}</span><span class="raw-tag ${st.shown?'green':'orange'}">${st.shown?'Allowed by filters':'Hidden by filters'}</span><span class="raw-tag">${rawEsc(getType?.(r)||r?.__kind||'asset')}</span>${st.hasRoute?`<span class="raw-tag green">Route grouped</span>`:`<span class="raw-tag orange">No route/group</span>`}</div><div class="raw-record-fields">${rawEsc(fields)}</div><div class="raw-inspector-actions"><button class="green" onclick="rawInspectorShowAsset(${i})" ${st.gps?'':'disabled'}>Show on map</button><button onclick="openAssetViewPage(${i})">Info</button></div></div>`;
}
function rawPreviewFields(r){
  const src=r?.original&&typeof r.original==='object'?r.original:r;
  const pairs=[];
  const wanted=['__kind','__line','__title','__pole','__lat','__lng','LINE_NAME','LINE_NAME_1','LINE_NAME_2','LINE_NAME_3','STRUCTURE_LABEL','NAMEPLATE_ID','NAMEPLATE_ID_1','ASSET_ID','FACILITYID','OBJECTID','EQUIP_NO','SUBSTATION','DEPOT_NAME'];
  for(const k of wanted){const v=r?.[k]??src?.[k]; if(v!==undefined&&v!==null&&String(v).trim()&&typeof v!=='object')pairs.push(`${k}: ${v}`);}
  Object.entries(src||{}).slice(0,16).forEach(([k,v])=>{if(!pairs.some(x=>x.startsWith(k+':'))&&v!==null&&v!==undefined&&typeof v!=='object'&&String(v).trim())pairs.push(`${k}: ${v}`);});
  return pairs.slice(0,24).join('\n');
}
function rawSkippedSamplesHTML(){
  const audits=(typeof lastImportAudit!=='undefined'&&lastImportAudit)||[];
  const rows=[];
  for(const a of audits){
    for(const sm of (a.skippedSamples||[]).slice(0,5)){
      rows.push(`<div class="raw-record-card raw-skip-sample"><b>${rawEsc(a.file)} · skipped ${rawEsc(sm.reason||'unknown')}</b><div class="raw-record-fields">${rawEsc(JSON.stringify(sm.fields||sm,null,2))}</div></div>`);
      if(rows.length>=12)break;
    }
    if(rows.length>=12)break;
  }
  if(!rows.length)return '<div class="raw-inspector-panel">Skipped sample records are captured on future imports. Re-import with Replace all to see examples of no-ID / geometry-only / duplicate rows.</div>';
  return `<div class="raw-inspector-panel"><b>Skipped samples from last import</b></div>${rows.join('')}`;
}
function renderRawInspectorFullSummary(){
  rawInspectorMatches=[...(allRecords||[])];
  const e=rawInspectorEl(); if(!e)return;
  const s=rawBuildSummary(rawInspectorMatches,'all');
  e.innerHTML=`<div class="raw-inspector-panel"><div class="raw-inspector-actions"><button onclick="renderRawInspector()">Back to inspector</button><button class="green" onclick="rawInspectorShowMatchedOnMap()">Show all accepted GPS on map</button></div>${rawSummaryHTML(s)}${rawInspectorWarningsHTML(s)}</div>${rawInspectorResultsHTML(rawInspectorMatches,s,'all')}`;
}
function rawInspectorShowMatchedOnMap(){
  forceMapAssetsVisibleForRoute?.();
  const rows=(rawInspectorMatches&&rawInspectorMatches.length?rawInspectorMatches:(allRecords||[])).filter(r=>typeof hasGPS==='function'?hasGPS(r):r?.__hasGPS);
  if(!rows.length){alert('No GPS records to show.');return;}
  closeRawInspector(); closeSettings?.(); closeAssetIndex?.(); setActive?.('tabMap');
  if(!assetLayer||!map){alert('Map not ready.');return;}
  assetLayer.clearLayers(); visibleRecords=rows; updateKPIs?.();
  let n=0; const bounds=[]; const token=Date.now()+Math.random(); window.__rawInspectorMapToken=token;
  function step(){
    if(window.__rawInspectorMapToken!==token)return;
    const end=Math.min(n+120,rows.length);
    for(;n<end;n++){
      const r=rows[n]; const lat=getLat(r),lng=getLng(r); if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
      bounds.push([lat,lng]);
      const idx=typeof recordIndexOf==='function'?recordIndexOf(r):(allRecords||[]).indexOf(r);
      const m=registerMapToggleLayer?registerMapToggleLayer(L.circleMarker([lat,lng],{radius:5,weight:2,fillOpacity:.88}).addTo(assetLayer),r,'dot'):L.circleMarker([lat,lng],{radius:5,weight:2,fillOpacity:.88}).addTo(assetLayer);
      try{m.bindTooltip(getStructure(r)); bindAssetMiniPopup?.(m,idx);}catch(e){}
    }
    showToolStatus?.(`Raw inspector loading… ${Number(n).toLocaleString()} / ${Number(rows.length).toLocaleString()} GPS dots`);
    if(n<rows.length)requestAnimationFrame(step); else {if(bounds.length>1)map.fitBounds(L.latLngBounds(bounds),{padding:[45,45],maxZoom:16}); else if(bounds.length===1)map.setView(bounds[0],17); showToolStatus?.(`Raw inspector showed ${Number(rows.length).toLocaleString()} GPS dots`);}
  }
  requestAnimationFrame(step);
}

function rawInspectorShowAsset(index){
  closeRawInspector();
  if(typeof selectAsset==='function')selectAsset(index);
  else if(typeof assetIndexShowAsset==='function')assetIndexShowAsset(index);
}
