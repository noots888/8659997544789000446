/* Clean no-freeze mobile search engine. Direct search over normalised imported records. */
// searchFilters is declared once in core/state.js. Assign only, do not redeclare, or the Search tab breaks.
searchFilters={line:true,poles:true,substations:true,depots:true,conductors:false};
let searchDetailOpen=false;
let assetIndexSelectedRoutes=new Map();
function openAssetIndex(){
  closePlus?.();
  closeDrawer?.();
  closeSettings?.();
  closePOI?.();
  document.getElementById('assetViewPage')?.classList.remove('show');
  const page=document.getElementById('assetIndexPage');
  if(!page)return;
  page.classList.add('open');
  document.body.classList.add('asset-index-open');
  document.body.classList.remove('drawer-open','settings-open','poi-open','search-keyboard-active','search-keyboard-collapsed');
  document.getElementById('searchKeyboardDock')?.remove();
  setActive?.('tabSearch');
  renderSearch();
}

function closeAssetIndex(){
  document.getElementById('assetIndexPage')?.classList.remove('open');
  document.body.classList.remove('asset-index-open','native-search-focus','search-keyboard-active','search-keyboard-collapsed');
  document.getElementById('searchKeyboardDock')?.remove();
  document.getElementById('assetIndexPage')?.classList.remove('native-keyboard-mode');
  if(typeof __nativeSearchKeyboardCleanup==='function'){try{__nativeSearchKeyboardCleanup();}catch(e){} __nativeSearchKeyboardCleanup=null;}
}

function searchBodyEl(){return document.getElementById('assetIndexBody')||body()}

function assetIndexSelectedRoutesHTML(){
  const count=assetIndexSelectedRoutes.size;
  if(!count)return '<div id="selectedRoutesBar" class="index-selected-routes"></div>';
  const labels=[...assetIndexSelectedRoutes.values()].slice(0,6).map(esc).join(' + ');
  const more=count>6?` + ${count-6} more`:'';
  return `<div id="selectedRoutesBar" class="index-selected-routes active"><b>${count} selected</b><span>${labels}${more}</span><button class="green" onclick="assetIndexShowSelectedRoutes()">Show selected on map</button><button class="secondary" onclick="assetIndexClearRouteSelection()">Clear</button></div>`;
}
function assetIndexRenderRouteSelection(){
  const bar=document.getElementById('selectedRoutesBar');
  if(!bar)return;
  const wrap=document.createElement('div');
  wrap.innerHTML=assetIndexSelectedRoutesHTML();
  bar.replaceWith(wrap.firstElementChild);
  assetIndexSyncSelectedButtons();
}
function assetIndexSyncSelectedButtons(){
  document.querySelectorAll('[data-route-select-key]').forEach(btn=>{
    const on=assetIndexSelectedRoutes.has(btn.dataset.routeSelectKey);
    btn.textContent=on?'Selected':'Select';
    btn.classList.toggle('green',on);
    btn.classList.toggle('secondary',!on);
  });
}
function assetIndexToggleRouteSelection(route){
  const key=compactSearch(route);
  if(!key)return;
  if(assetIndexSelectedRoutes.has(key))assetIndexSelectedRoutes.delete(key);
  else assetIndexSelectedRoutes.set(key,route);
  assetIndexRenderRouteSelection();
}
function assetIndexClearRouteSelection(){
  assetIndexSelectedRoutes.clear();
  assetIndexRenderRouteSelection();
}
function assetIndexShowSelectedRoutes(){
  const routes=[...assetIndexSelectedRoutes.values()];
  if(!routes.length){alert('No routes selected.');return;}
  closeAssetIndex?.();
  setActive?.('tabMap');
  showRoutesOnMap(routes);
}

function renderSearch(){
  // Full-page Asset Index. Search/list stays separate from the map until the user chooses Show on map.
  document.body.classList.remove('search-keyboard-active','search-keyboard-collapsed');
  document.getElementById('searchKeyboardDock')?.remove();
  const target=searchBodyEl();
  if(!target)return;
  target.innerHTML=`
    <div class="index-summary-row">
      <div><b>${Number(allRecords.length||0).toLocaleString()}</b><span>Total records</span></div>
      <div><b>${Number((typeof fastGPSCount==='function'?fastGPSCount():0)||0).toLocaleString()}</b><span>GPS ready</span></div>
      <div><b>${Number(visibleRecords.length||0).toLocaleString()}</b><span>Index hits</span></div>
    </div>
    <div class="search-panel clean-mobile-search-panel index-search-panel">
      <input id="searchBox" placeholder="Search Assets" autocomplete="off" autocapitalize="characters" inputmode="search" oninput="clearSearchResultsWhileTyping()" onkeydown="if(event.key==='Enter'){event.preventDefault();runSearch()}">
      <button class="typing-search-btn index-search-only-btn" onclick="runSearch()">Search</button>
    </div>
    ${assetIndexSelectedRoutesHTML()}
    <div class="index-hint">Tip: route-only search shows routes only. Turn on Points/Structures, Sites, or Bases when you want individual assets.</div>
    <div class="search-filter-tabs search-filter-tabs-mobile index-filter-tabs">
      <button id="sfLine" onclick="toggleSearchFilter('line')">Routes</button>
      <button id="sfPoles" onclick="toggleSearchFilter('poles')">Points/Structures</button>
      <button id="sfSubs" onclick="toggleSearchFilter('substations')">Sites</button>
      <button id="sfDepots" onclick="toggleSearchFilter('depots')">Bases</button>
    </div>
    <div id="resultsBox" class="search-results asset-index-results has-scroll-indicator"><div class="help">Type then press Search. Nothing is loaded onto the map until you press Show on map.</div></div>`;
  applySearchFilterUI();
  wireNativeSearchKeyboard();
}


let __nativeSearchKeyboardCleanup=null;
function wireNativeSearchKeyboard(){
  const input=document.getElementById('searchBox');
  if(!input)return;
  if(typeof __nativeSearchKeyboardCleanup==='function'){
    try{__nativeSearchKeyboardCleanup();}catch(e){}
    __nativeSearchKeyboardCleanup=null;
  }
  const pageEl=document.getElementById('assetIndexPage')||drawer();
  let kbOpen=false;

  const cleanupUi=()=>{
    kbOpen=false;
    document.body.classList.remove('native-search-focus');
    pageEl?.classList.remove('native-keyboard-mode');
    document.documentElement.style.setProperty('--native-kb','0px');
    document.documentElement.style.setProperty('--vvh', window.innerHeight+'px');
  };

  const setVars=()=>{
    try{
      const vv=window.visualViewport;
      const kb=vv?Math.max(0, window.innerHeight - vv.height - vv.offsetTop):0;
      document.documentElement.style.setProperty('--native-kb', Math.round(kb)+'px');
      document.documentElement.style.setProperty('--vvh', Math.round(vv?vv.height:window.innerHeight)+'px');
      if(kb < 70 && kbOpen){ cleanupUi(); return false; }
      if(kb >= 70){ kbOpen=true; document.body.classList.add('native-search-focus'); pageEl?.classList.add('native-keyboard-mode'); }
    }catch(e){}
    return true;
  };

  const onFocus=()=>{setTimeout(()=>{setVars(); window.scrollTo(0,0);},80);setTimeout(()=>{setVars(); window.scrollTo(0,0);},260);setTimeout(()=>{setVars();},520);};
  const onBlur=()=>{setTimeout(cleanupUi,80)};
  const onVisible=()=>{if(document.hidden)cleanupUi()};
  const onResize=()=>{if(kbOpen)setVars()};

  input.addEventListener('focus',onFocus,{passive:true});
  input.addEventListener('blur',onBlur,{passive:true});
  document.addEventListener('visibilitychange',onVisible,{passive:true});
  window.addEventListener('pagehide',cleanupUi,{passive:true});
  window.addEventListener('resize',onResize,{passive:true});
  if(window.visualViewport){window.visualViewport.addEventListener('resize',setVars,{passive:true});window.visualViewport.addEventListener('scroll',setVars,{passive:true});}
  __nativeSearchKeyboardCleanup=()=>{
    try{input.removeEventListener('focus',onFocus);input.removeEventListener('blur',onBlur);}catch(e){}
    try{document.removeEventListener('visibilitychange',onVisible);}catch(e){}
    try{window.removeEventListener('pagehide',cleanupUi);window.removeEventListener('resize',onResize);}catch(e){}
    try{if(window.visualViewport){window.visualViewport.removeEventListener('resize',setVars);window.visualViewport.removeEventListener('scroll',setVars);}}catch(e){}
    cleanupUi();
  };
}

function toggleSearchFilter(name){searchFilters[name]=!searchFilters[name]; if(!Object.values(searchFilters).some(Boolean))searchFilters[name]=true; applySearchFilterUI(); runSearch();}
function applySearchFilterUI(){const map={sfLine:'line',sfPoles:'poles',sfSubs:'substations',sfDepots:'depots'};Object.entries(map).forEach(([id,k])=>{const b=document.getElementById(id);if(b)b.classList.toggle('active',!!searchFilters[k])})}
function clearSearchResultsWhileTyping(){
  // Mobile performance: do not search/reload assets on every keypress.
  // Results only refresh when the orange search button is pressed or Enter is tapped.
  clearTimeout(window.__srchT);
  const box=document.getElementById('resultsBox');
  const raw=(document.getElementById('searchBox')?.value||'').trim();
  if(box){
    box.innerHTML = raw ? '<div class="help">Tap Search to run.</div>' : '<div class="help">Type then press Search.</div>';
  }
}
function normSearch(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function compactSearch(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function recordHay(r){return r.__search||normSearch(makeSearchText(r))}
function alphaNumParts(s){
  const parts=String(s||'').toUpperCase().match(/[A-Z]+|\d+/g)||[];
  const nums=parts.filter(x=>/^\d+$/.test(x)).map(x=>parseInt(x,10)).filter(Number.isFinite);
  return {
    letters:parts.filter(x=>/[A-Z]/.test(x)).join(''),
    nums,
    lastNum:nums.length?nums[nums.length-1]:null,
    compactNoZeros:parts.map(x=>/^\d+$/.test(x)?String(parseInt(x,10)):x).join('')
  };
}
function codeCandidateTexts(r){
  const vals=[getStructure(r),getLine(r),...(lineCandidates(r)||[])];
  const pairs=[
    [val(r,['LINE_NAME_1']),val(r,['NAMEPLATE_ID_1'])],
    [val(r,['LINE_NAME_2']),val(r,['NAMEPLATE_ID_2'])],
    [val(r,['LINE_NAME_3']),val(r,['NAMEPLATE_ID_3'])],
    [val(r,['__line','LINE_NAME','line_name']),val(r,['__pole','STRUCTURE_LABEL','EQUIP_NO','NAMEPLATE_ID_1','ASSET_ID','POINT_ID'])]
  ];
  pairs.forEach(([line,plate])=>{if(line&&plate){vals.push(`${line} ${plate}`);vals.push(`${line}-${plate}`)}});
  return unique(vals).filter(Boolean);
}
function looseCodeMatch(r,q,qc){
  if(!qc||qc.length<4)return false;
  const qp=alphaNumParts(q||qc);
  if(qp.letters.length<3||!qp.nums.length)return false;
  for(const text of codeCandidateTexts(r)){
    const cp=alphaNumParts(text);
    if(cp.letters.length<2||!cp.nums.length)continue;
    if(cp.compactNoZeros&&qp.compactNoZeros&&(cp.compactNoZeros.includes(qp.compactNoZeros)||compactSearch(text).includes(qc)))return true;
    const lettersOk=cp.letters===qp.letters||cp.letters.includes(qp.letters)||qp.letters.includes(cp.letters);
    if(!lettersOk)continue;
    if(qp.nums.length===1){
      if(cp.lastNum===qp.lastNum)return true;
    }else if(qp.nums.every(n=>cp.nums.includes(n))){
      return true;
    }
  }
  return false;
}
function matchesQuery(r,q,qc){const hay=recordHay(r), hc=r.__compact||compactSearch(hay); if(!q)return true; const words=q.split(' ').filter(Boolean); return hay.includes(q)||hc.includes(qc)||words.every(w=>hay.includes(w)||hc.includes(compactSearch(w)))||looseCodeMatch(r,q,qc);}
function searchAssetFiltersEnabled(){return !!(searchFilters.poles||searchFilters.substations||searchFilters.depots||searchFilters.conductors)}
function resultKindAllowed(r){
  const k=String(r.__kind||getType(r)||'asset').toLowerCase();
  if(k.includes('conductor')||k.includes('detail'))return !!searchFilters.conductors;
  if(k.includes('depot')||k.includes('base'))return !!searchFilters.depots;
  if(k.includes('substation')||k.includes('terminal')||k.includes('site'))return !!searchFilters.substations;
  if(k.includes('pole')||k.includes('tower')||k.includes('structure')||k.includes('point')||k==='asset')return !!searchFilters.poles;
  return !!searchFilters.poles;
}
function entryKindAllowed(e){
  const k=String(e.kind||'asset').toLowerCase();
  if(k.includes('conductor')||k.includes('detail'))return !!searchFilters.conductors;
  if(k.includes('depot')||k.includes('base'))return !!searchFilters.depots;
  if(k.includes('substation')||k.includes('terminal')||k.includes('site'))return !!searchFilters.substations;
  if(k.includes('pole')||k.includes('tower')||k.includes('structure')||k.includes('point')||k==='asset')return !!searchFilters.poles;
  return !!searchFilters.poles;
}
function queryNoZeroCompact(s){return (String(s||'').toUpperCase().match(/[A-Z]+|\d+/g)||[]).map(x=>/^\d+$/.test(x)?String(parseInt(x,10)||0):x).join('')}
function queryCodeParts(s){const parts=String(s||'').toUpperCase().match(/[A-Z]+|\d+/g)||[];const nums=parts.filter(x=>/^\d+$/.test(x)).map(x=>parseInt(x,10)).filter(Number.isFinite);return{letters:parts.filter(x=>/[A-Z]/.test(x)).join(''),nums,lastNum:nums.length?nums[nums.length-1]:null,noZero:parts.map(x=>/^\d+$/.test(x)?String(parseInt(x,10)||0):x).join(''),compact:compactSearch(s),hasCode:parts.some(x=>/[A-Z]/.test(x))&&nums.length>0}}
function makeQueryInfo(raw){const q=normSearch(raw),qc=compactSearch(raw),words=q.split(' ').filter(Boolean);return{raw,q,qc,words,wordCompacts:words.map(compactSearch),noZero:queryNoZeroCompact(raw),parts:queryCodeParts(raw)}}
function fastCodeEntryMatch(e,qi){
  const qp=qi.parts;
  if(!qp||!qp.hasCode||qp.letters.length<2||!qp.nums.length)return false;
  for(const cp of (e.codeParts||[])){
    if(!cp)continue;
    if((cp.letters||'').length>=2 && qi.qc&&cp.compact&&(cp.compact.includes(qi.qc)||qi.qc.includes(cp.compact)))return true;
    if((cp.letters||'').length>=2 && qi.noZero&&cp.noZero&&(cp.noZero.includes(qi.noZero)||qi.noZero.includes(cp.noZero)))return true;
    const lettersOk=cp.letters===qp.letters||cp.letters.includes(qp.letters)||qp.letters.includes(cp.letters);
    if(!lettersOk)continue;
    if(qp.nums.length===1){ if(cp.lastNum===qp.lastNum || (cp.nums||[]).includes(qp.lastNum))return true; }
    else if(qp.nums.every(n=>(cp.nums||[]).includes(n)))return true;
  }
  return false;
}
function entryMatches(e,qi){
  if(!qi.q)return true;
  if(e.search.includes(qi.q)||e.compact.includes(qi.qc))return true;
  if(qi.noZero&&e.noZeroCompact&&e.noZeroCompact.includes(qi.noZero))return true;
  if(qi.words.length && qi.words.every((w,i)=>e.search.includes(w)||e.compact.includes(qi.wordCompacts[i])||(e.noZeroCompact&&e.noZeroCompact.includes(queryNoZeroCompact(w)))))return true;
  return fastCodeEntryMatch(e,qi);
}
function scoreEntry(e,qi){
  const qc=qi.qc,nz=qi.noZero;
  const nzOk=!!nz;
  if(e.structureCompact===qc||e.lineCompact===qc||e.subCompact===qc||e.depCompact===qc||(nzOk&&(e.structureNoZero===nz||e.lineNoZero===nz)))return 0;
  if(e.structureCompact.startsWith(qc)||e.lineCompact.startsWith(qc)||e.subCompact.startsWith(qc)||e.depCompact.startsWith(qc)||(nzOk&&(e.structureNoZero?.startsWith(nz)||e.lineNoZero?.startsWith(nz)))||fastCodeEntryMatch(e,qi))return 1;
  if(e.structureCompact.includes(qc)||e.lineCompact.includes(qc)||e.subCompact.includes(qc)||e.depCompact.includes(qc)||(nzOk&&(e.structureNoZero?.includes(nz)||e.lineNoZero?.includes(nz))))return 2;
  return 4;
}
function ensureFastIndex(box){
  if(!allRecords.length)return true;
  if(searchIndex.length===allRecords.length && !searchIndexBuilding)return true;
  return false;
}
async function ensureFastIndexAsync(box,raw){
  if(!allRecords.length)return false;
  if(searchIndex.length===allRecords.length && !searchIndexBuilding)return true;
  if(box)box.innerHTML='<div class="help"><b>Building fast index…</b><br>This runs once after import/restart. The app stays usable.</div>';
  try{
    await rebuildIndexAsync((done,total)=>{
      if(box)box.innerHTML=`<div class="help"><b>Building fast index…</b><br>${Number(done||0).toLocaleString()} / ${Number(total||0).toLocaleString()} records</div>`;
    });
    return true;
  }catch(e){
    console.warn('Index build failed',e);
    if(box)box.innerHTML='<div class="help">Index failed. Reopen the app or reimport the data.</div>';
    return false;
  }
}
let __searchRunId=0;
function estimateMatchesQuery(dp,qi){
  const r=dp&&dp.r||{};
  const text=normSearch([getLine(r)||r.__line||'',getStructure(r)||'',dp&&dp.plate!=null?dp.plate:'',r.__sourceNote||'estimated missing estimate no gps'].join(' '));
  const compact=compactSearch(text);
  if(!qi.q)return true;
  if(text.includes(qi.q)||compact.includes(qi.qc))return true;
  if(qi.parts&&qi.parts.nums&&qi.parts.nums.length&&dp&&Number(dp.plate)===qi.parts.nums[qi.parts.nums.length-1]){
    if(!qi.parts.letters)return true;
    const lineC=compactSearch(getLine(r)||r.__line||'');
    return !qi.parts.letters||lineC.includes(qi.parts.letters)||compact.includes(qi.parts.letters);
  }
  return false;
}
async function appendVirtualEstimateSearchResults(results,qi,runId,box){
  if(!searchFilters.poles||!qi.parts||!qi.parts.nums||!qi.parts.nums.length)return;
  const groups=(lineSearchCache||[]);
  if(!groups.length)return;
  const seen=new Set();
  let checked=0, added=0;
  for(const g of groups){
    if(runId!==__searchRunId)return;
    const dps=routeDisplayPointList(g.records||[]).filter(dp=>dp&&dp.gapEstimate&&routeDisplayHasCoord(dp));
    for(const dp of dps){
      if(!estimateMatchesQuery(dp,qi))continue;
      const key=routeEstimateKey(dp);
      if(seen.has(key))continue;
      seen.add(key);
      results.push({kind:'estimate',score:1,row:dp});
      added++;
    }
    checked++;
    if(checked%8===0){
      if(box)box.innerHTML=`<div class="help">Searching estimates… ${Number(checked).toLocaleString()} route groups checked | ${Number(added).toLocaleString()} estimates found</div>`;
      await sleepFrame?.();
    }
  }
}
async function runSearch(){
  const runId=++__searchRunId;
  const raw=(document.getElementById('searchBox')?.value||'').trim();
  const qi=makeQueryInfo(raw);
  const box=document.getElementById('resultsBox');
  if(!box)return;
  if(!allRecords.length){box.innerHTML='<div class="help">No imported data found. Import your JSON/CSV in Settings first.</div>';return;}
  if(!qi.q){box.innerHTML=`<div class="help">${Number(allRecords.length||0).toLocaleString()} records loaded. Type an asset name, route, location, or detail.</div>`;return;}
  if(qi.qc.length<2){box.innerHTML='<div class="help">Type at least 2 letters/numbers for a fast search.</div>';return;}
  if(!await ensureFastIndexAsync(box,raw))return;
  if(runId!==__searchRunId)return;

  const results=[];
  if(searchFilters.line){
    for(const g of lineGroups(qi,16))results.push({kind:'line',score:g.score,row:g});
  }
  const idx=searchIndex||[];
  const total=idx.length;
  if(searchAssetFiltersEnabled()){
    box.innerHTML=`<div class="help">Searching… 0 / ${Number(total||0).toLocaleString()}</div>`;
    for(let n=0;n<total;n++){
      const e=idx[n];
      if(entryKindAllowed(e)&&entryMatches(e,qi))results.push({kind:'asset',score:scoreEntry(e,qi),row:e.record,index:e.i});
      if(n%700===0){
        if(runId!==__searchRunId)return;
        box.innerHTML=`<div class="help">Searching… ${Number(n||0).toLocaleString()} / ${Number(total||0).toLocaleString()}</div>`;
        await sleepFrame?.();
        // No result cap: every matching imported record stays searchable, including records without GPS.
      }
    }
  }
  if(searchFilters.poles)await appendVirtualEstimateSearchResults(results,qi,runId,box);
  if(runId!==__searchRunId)return;
  const final=results.sort((a,b)=>a.score-b.score||labelFor(a).localeCompare(labelFor(b)));
  visibleRecords=final.flatMap(x=>x.kind==='line'?x.row.records:[(x.kind==='estimate'?(x.row&&x.row.r):x.row)]).filter(Boolean); updateKPIs();
  box.innerHTML=final.map(cardFor).join('')||`<div class="help">No match. Try shorter text or another detail.</div>`;
}
function scoreRecord(r,q,qc){let title=compactSearch(getStructure(r)), line=compactSearch(getLine(r)), sub=compactSearch(getSubstationName(r)), dep=compactSearch(getDepotName(r)); if(title===qc||line===qc||sub===qc||dep===qc)return 0; if(title.startsWith(qc)||line.startsWith(qc)||sub.startsWith(qc)||dep.startsWith(qc)||looseCodeMatch(r,q,qc))return 1; if(title.includes(qc)||line.includes(qc)||sub.includes(qc)||dep.includes(qc))return 2; return 4;}
function labelFor(x){return x.kind==='line'?x.row.line:(x.kind==='estimate'?labelForEstimate(x.row):getStructure(x.row))}
function lineGroups(qi,max){
  if(typeof collapseLineSearchCache==='function')collapseLineSearchCache();
  const out=[];
  for(const g of (lineSearchCache||[])){
    if(qi.q && !g.compact.includes(qi.qc) && !g.search.includes(qi.q) && !(qi.noZero&&g.noZero&&g.noZero.includes(qi.noZero)))continue;
    const nz=qi.noZero;
    const score=(g.compact===qi.qc||(nz&&g.noZero===nz))?0:(g.compact.startsWith(qi.qc)||(nz&&g.noZero?.startsWith(nz))?1:(g.compact.includes(qi.qc)||(nz&&g.noZero?.includes(nz))?2:3));
    out.push({...g,score});
  }
  return out.sort((a,b)=>a.score-b.score||b.gps-a.gps||b.records.length-a.records.length);
}
function cardFor(item){return item.kind==='line'?lineResultCard(item.row):(item.kind==='estimate'?estimateResultCard(item.row):assetResultCard(item.row,item.index,item.dp||null))}
function labelForEstimate(dp){const r=dp&&dp.r||{};return [getLine(r)||r.__line||'',getStructure(r)||'',dp&&dp.plate!=null?dp.plate:''].filter(Boolean).join(' ')}

function assetHasRouteContext(r){
  if(!r||hasGPS(r))return false;
  try{return !!(getLine(r)||(lineCandidates(r)||[])[0]||r.__line);}catch(e){return false;}
}
function assetPrimaryRoute(r){
  try{return getLine(r)||(lineCandidates(r)||[])[0]||r.__line||'';}catch(e){return '';}
}
function estimateForRecordByIndex(index){
  index=Number(index);
  const r=(allRecords||[])[index];
  if(!r||hasGPS(r))return null;
  const route=assetPrimaryRoute(r);
  if(!route)return null;
  const targetIdx=(typeof recordIndexOf==='function')?recordIndexOf(r):index;
  const rows=routeHitsFromCache(route);
  const dps=routeDisplayPointList(rows);
  return dps.find(dp=>dp&&!dp.gapEstimate&&dp.recIndex===targetIdx&&dp.estimated&&routeDisplayHasCoord(dp))||null;
}
function assetIndexShowLine(line){selectLine(line)}
function assetIndexShowAsset(index){selectAsset(index)}
function assetIndexShowEstimatedAsset(index){selectAsset(index,true)}
function openMapsForEstimatedAsset(index){
  const dp=estimateForRecordByIndex(index);
  if(!dp){alert('No GPS in the source record and no safe estimate could be calculated.');return;}
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${Number(dp.lat)},${Number(dp.lng)}&travelmode=driving`,'_blank');
}
function routeFocusEstimateByKey(key,tries=0){
  try{
    const marker=routeEstimateMarkerByKey.get(key);
    if(marker&&marker.getLatLng){
      const ll=marker.getLatLng();
      map.setView(ll,18);
      if(marker.openPopup)marker.openPopup();
      return true;
    }
  }catch(e){}
  if(tries<20)setTimeout(()=>routeFocusEstimateByKey(key,tries+1),180);
  return false;
}
function assetIndexShowVirtualEstimate(line,plate){
  closeAssetIndex?.();
  setActive?.('tabMap');
  showLineOnMap(routeHitsFromCache(line),line);
  const key='V:'+compactSearch(line)+':'+String(Number(plate));
  showToolStatus?.('Loading route and focusing estimated missing point...');
  setTimeout(()=>routeFocusEstimateByKey(key),450);
}

function routeLooseKey(line){return compactSearch(line||'')}
function routeNameLooksLikeRealRoute(line){
  const raw=String(line||'').trim();
  const key=compactSearch(raw);
  if(!key||key.length<2)return false;
  // Single-letter site abbreviations such as "F" were being treated as routes and pulled sites into line views.
  if(/^[A-Z]$/i.test(raw))return false;
  if(/^\d+$/.test(key)&&key.length<4)return false;
  return true;
}
function routeRecordIsLineAsset(r){
  if(!r)return false;
  const k=String(r.__kind||((typeof getType==='function')?getType(r):'asset')||'asset').toLowerCase();
  if(k.includes('conductor')||k.includes('detail'))return false;
  if(k.includes('substation')||k.includes('terminal')||k.includes('site'))return false;
  if(k.includes('depot')||k.includes('base'))return false;
  const typeText=String((typeof getType==='function'?getType(r):'')||'').toLowerCase();
  if(/substation|terminal|\bsite\b|depot|\bbase\b/.test(typeText))return false;
  const lineKindHint=/tower|pole|structure|point/.test(k)||/tower|pole|structure|point/.test(typeText);
  const subName=(typeof getSubstationName==='function'?getSubstationName(r):'');
  const depName=(typeof getDepotName==='function'?getDepotName(r):'');
  if((subName||depName) && !lineKindHint)return false;
  // Records that only have a site/depot name and no proper point/structure fields are not line assets.
  const structure=String((typeof getStructure==='function'?getStructure(r):'')||'').trim();
  const hasPointField=(typeof val==='function')?!!val(r,['POINT_ID','POINTID','ASSET_ID','ASSETID','FACILITYID','FACILITY_ID','EQUIPMENT_ID','EQUIP_ID','EQUIP_NO','EQUIPMENT_NO','STRUCTURE_ID','STRUCTUREID','STRUCTURE_LABEL','STRUCTURE_NO','STRUCTURE_NUMBER','NAMEPLATE_ID','NAMEPLATE_ID_1','NAMEPLATE_ID_2','NAMEPLATE_ID_3']):false;
  const routeVals=(typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):(typeof lineCandidates==='function'?lineCandidates(r):[]));
  const hasRealRoute=routeVals.some(routeNameLooksLikeRealRoute);
  if(!hasRealRoute)return false;
  if(hasPointField)return true;
  if(/tower|pole|structure|point|asset/.test(k)||/tower|pole|structure|point/.test(typeText))return true;
  return !!structure && !subName && !depName;
}
function routeRecordsOnly(records){
  return (records||[]).filter(routeRecordIsLineAsset);
}
function routeRecordLooseKeys(r){
  if(!routeRecordIsLineAsset(r))return [];
  const vals=[];
  const add=v=>{if(v!==undefined&&v!==null&&String(v).trim()&&routeNameLooksLikeRealRoute(v))vals.push(String(v));};
  try{add(getLine(r));}catch(e){}
  try{(routeOnlyCandidates?.(r)||[]).forEach(add);}catch(e){}
  try{(lineCandidates?.(r)||[]).forEach(add);}catch(e){}
  try{add(deriveCircuitFromRecord?.(r));}catch(e){}
  // Never use full search text or substation/site abbreviations for loose route matching.
  return unique(vals.map(compactSearch).filter(Boolean));
}
function routeMatchesLooseRecord(r,line){
  const key=routeLooseKey(line);
  if(!routeNameLooksLikeRealRoute(line)||!r||!routeRecordIsLineAsset(r))return false;
  const keys=routeRecordLooseKeys(r);
  for(const k of keys){
    if(k===key)return true;
    // Include individual point codes under a route only when the route key is specific enough.
    if(key.length>=5 && (k.startsWith(key)||k.includes(key)))return true;
  }
  return false;
}
function mergeRouteRecordLists(primary,line){
  const key=routeLooseKey(line);
  const seen=new Set(), out=[];
  const push=r=>{
    if(!routeRecordIsLineAsset(r))return;
    const idx=(typeof recordIndexOf==='function')?recordIndexOf(r):((r&&r.__idx!==undefined)?r.__idx:(allRecords||[]).indexOf(r));
    const id=(idx>=0?idx:'')+'|'+compactSearch(getStructure(r)||'')+'|'+Number(getLat(r)||0).toFixed(6)+'|'+Number(getLng(r)||0).toFixed(6);
    if(seen.has(id))return; seen.add(id); out.push(r);
  };
  (primary||[]).forEach(push);
  if(key.length>=4&&routeNameLooksLikeRealRoute(line)){
    for(const r of (allRecords||[])){
      if(routeMatchesLooseRecord(r,line))push(r);
    }
  }
  return out;
}
function routeHitsFromCache(line){
  if(typeof collapseLineSearchCache==='function')collapseLineSearchCache();
  const key=compactSearch(line);
  if(!routeNameLooksLikeRealRoute(line))return [];
  const groups=(lineSearchCache||[]).filter(g=>routeNameLooksLikeRealRoute(g.line||g.key||g.compact));
  const direct=[];
  const g=groups.find(x=>x.key===key||x.compact===key);
  if(g&&g.records)direct.push(...routeRecordsOnly(g.records));
  // Limited loose route expansion only; stops sites/substations or tiny abbreviations from hijacking a route.
  for(const row of groups){
    const k=row.key||row.compact||'';
    if(key.length>=5 && k!==key && (k.startsWith(key)||key.startsWith(k))){
      if(row.records)direct.push(...routeRecordsOnly(row.records));
    }
  }
  if(!direct.length){
    direct.push(...(allRecords||[]).filter(r=>routeRecordIsLineAsset(r)&&(typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):(typeof lineCandidates==='function'?lineCandidates(r):[])).some(l=>compactSearch(l)===key)));
  }
  return mergeRouteRecordLists(direct,line);
}
function assetIndexListRoute(line){
  const hits=routeHitsFromCache(line);
  const dps=routeDisplayPointList(hits);
  visibleRecords=hits;
  updateKPIs();
  const box=document.getElementById('resultsBox');
  if(!box)return;
  const sourceCount=hits.length;
  const gpsCount=hits.filter(hasGPS).length;
  const estCount=dps.filter(dp=>dp&&dp.estimated&&!dp.gapEstimate&&routeDisplayHasCoord(dp)).length;
  const gapCount=dps.filter(dp=>dp&&dp.gapEstimate&&routeDisplayHasCoord(dp)).length;
  box.innerHTML=`<div class="result selected-line-card"><div class="rtitle">${esc(line)}</div><div class="rsub">${sourceCount} source records | ${gpsCount} true GPS | ${estCount} no-GPS estimates | ${gapCount} inferred missing-number estimates</div><span class="tag green">Route list incl estimates</span><span class="tag clay">Estimate warning: verify before field use</span><div class="asset-index-card-actions"><button class="green" onclick="assetIndexShowLine(decodeURIComponent('${encodeURIComponent(line)}'))">Show route on map</button><button class="secondary" onclick="runSearch()">Back to results</button></div></div>`+
    dps.map((dp)=>dp&&dp.gapEstimate?estimateResultCard(dp):assetResultCard(dp.r,(Number.isInteger(dp.recIndex)?dp.recIndex:(typeof recordIndexOf==='function'?recordIndexOf(dp.r):allRecords.indexOf(dp.r))),dp)).join('');
}


function genericKindLabel(kind){
  const k=String(kind||'').toLowerCase();
  if(k==='line'||k.includes('line'))return 'Route';
  if(k.includes('pole'))return 'Point';
  if(k.includes('tower'))return 'Structure';
  if(k.includes('substation')||k.includes('terminal'))return 'Site';
  if(k.includes('depot'))return 'Base';
  if(k.includes('conductor'))return 'Detail';
  return k?String(kind).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()):'Asset';
}
function lineResultCard(g){
  const lineArg=encodeURIComponent(g.line||'');
  const key=compactSearch(g.line||'');
  const selectedRoute=assetIndexSelectedRoutes.has(key);
  return `<div class="result line-result index-result-card"><div class="rtitle">${esc(g.line)}</div><div class="rsub">Whole route | ${g.records.length} items | ${g.gps} GPS | ${Math.max(0,(g.records.length||0)-(g.gps||0))} no GPS</div><span class="tag clay">Route</span><span class="tag green">Index only</span><div class="asset-index-card-actions"><button class="green" onclick="assetIndexShowLine(decodeURIComponent('${lineArg}'))">Show on map</button><button class="${selectedRoute?'green':'secondary'} route-select-btn" data-route-select-key="${esc(key)}" onclick="assetIndexToggleRouteSelection(decodeURIComponent('${lineArg}'))">${selectedRoute?'Selected':'Select'}</button><button class="secondary" onclick="assetIndexListRoute(decodeURIComponent('${lineArg}'))">List route</button></div></div>`;
}
function assetResultCard(r,i,dp=null){
  const kind=r.__kind||getType(r)||'asset';
  const detail=resolveConductor(r);
  const sub=getSubstationName(r),dep=getDepotName(r);
  const line=getLine(r)||assetPrimaryRoute(r);
  const gps=hasGPS(r);
  const estimated=!!(dp&&dp.estimated&&!dp.gapEstimate&&routeDisplayHasCoord(dp));
  const canEstimate=!gps&&(estimated||assetHasRouteContext(r));
  const mapBtn=gps?`<button class="green" onclick="assetIndexShowAsset(${i})">Show on map</button>`:(canEstimate?`<button class="green" onclick="assetIndexShowEstimatedAsset(${i})">Show estimate</button>`:`<button class="green" disabled>Show on map</button>`);
  const navBtn=gps?`<button class="clay" onclick="openMapsForAsset(${i})">Google Maps</button>`:(canEstimate?`<button class="clay" onclick="openMapsForEstimatedAsset(${i})">Open estimate</button>`:`<button class="clay" disabled>Google Maps</button>`);
  const gpsTag=gps?'<span class="tag green">GPS</span>':(canEstimate?'<span class="tag clay">Estimate warning</span><span class="tag red">No source GPS</span>':'<span class="tag red">No GPS</span>');
  const warn=canEstimate?'<div class="estimate-search-warning">Estimated position only. Check against map layers before field use.</div>':'';
  return `<div class="result pole-result index-result-card"><div class="rtitle">${esc(getStructure(r))}</div><div class="rsub">${esc(line||sub||dep||'No route')}</div><span class="tag clay">${esc(genericKindLabel(kind))}</span>${detail?`<span class="tag clay">Detail</span>`:''}${sub?`<span class="tag green">Site: ${esc(sub)}</span>`:''}${dep?`<span class="tag green">Base: ${esc(dep)}</span>`:''}${gpsTag}${warn}<div class="asset-index-card-actions">${mapBtn}${navBtn}<button class="secondary" onclick="openAssetViewPage(${i})">Info</button></div></div>`;
}
function estimateResultCard(dp){
  const r=dp&&dp.r||{};
  const line=getLine(r)||r.__line||'';
  const plate=dp&&dp.plate!=null?dp.plate:'';
  const lineArg=encodeURIComponent(line);
  return `<div class="result pole-result index-result-card estimate-result-card"><div class="rtitle">${esc(getStructure(r)||('Estimated missing '+plate))}</div><div class="rsub">${esc(line||'No route')} | inferred between nearby GPS assets</div><span class="tag clay">Estimate warning</span><span class="tag red">Not in source data</span><span class="tag clay">Missing-number estimate</span><div class="estimate-search-warning">This is an app-created estimate only. No matching source record/GPS exists. Verify against map layers before field use.</div><div class="asset-index-card-actions"><button class="green" onclick="assetIndexShowVirtualEstimate(decodeURIComponent('${lineArg}'),${Number(plate)||0})">Show route estimate</button><button class="secondary" onclick="assetIndexListRoute(decodeURIComponent('${lineArg}'))">List route</button></div></div>`;
}
function plateNo(r){
  const src=[getStructure(r),val(r,['NAMEPLATE_ID_1','NAMEPLATE_ID_2','NAMEPLATE_ID_3','POINT_ID','ASSET_ID','EQUIP_NO','STRUCTURE_LABEL'])].join(' ');
  const m=String(src||'').match(/(\d{1,6})(?!.*\d)/);
  return m?parseInt(m[1],10):999999;
}
function routeMeters(a,b){
  try{return map&&map.distance?map.distance([a.lat,a.lng],[b.lat,b.lng]):distanceMeters(a.lat,a.lng,b.lat,b.lng)}catch(e){return distanceMeters(a.lat,a.lng,b.lat,b.lng)}
}
function routePointList(records){
  const seen=new Set(), pts=[];
  (records||[]).forEach((r,sourceOrder)=>{
    if(!hasGPS(r))return;
    const lat=getLat(r),lng=getLng(r);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const key=`${lat.toFixed(6)},${lng.toFixed(6)}`;
    if(seen.has(key))return;
    seen.add(key);
    pts.push({r,lat,lng,plate:plateNo(r),sourceOrder,title:String(getStructure(r)||'')});
  });
  return pts;
}
function finitePlateNo(r){
  const p=plateNo(r);
  return Number.isFinite(p)&&p!==999999?p:null;
}
function routeDisplayOrderValue(item){
  return item.plate!==null&&item.plate!==undefined?item.plate:(1000000000+item.sourceOrder);
}
function routeOrderRatio(item,a,b,pos,aPos,bPos){
  if(item.plate!==null&&a.plate!==null&&b.plate!==null&&b.plate!==a.plate){
    return (item.plate-a.plate)/(b.plate-a.plate);
  }
  if(bPos!==aPos)return (pos-aPos)/(bPos-aPos);
  return .5;
}
function clampRouteRatio(t,min=-2.5,max=2.5){
  t=Number(t);
  if(!Number.isFinite(t))return .5;
  return Math.max(min,Math.min(max,t));
}
function interpolateRoutePoint(a,b,t){
  t=Number(t);
  if(!Number.isFinite(t))t=.5;
  return {lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t};
}
function estimateRoutePoint(sorted,item,pos){
  let left=null,leftPos=-1,right=null,rightPos=-1;
  for(let i=pos-1;i>=0;i--){if(sorted[i].hasGPS){left=sorted[i];leftPos=i;break;}}
  for(let i=pos+1;i<sorted.length;i++){if(sorted[i].hasGPS){right=sorted[i];rightPos=i;break;}}
  if(left&&right){
    const t=clampRouteRatio(routeOrderRatio(item,left,right,pos,leftPos,rightPos),0,1);
    return interpolateRoutePoint(left,right,t);
  }
  if(left){
    let prev=null,prevPos=-1;
    for(let i=leftPos-1;i>=0;i--){if(sorted[i].hasGPS){prev=sorted[i];prevPos=i;break;}}
    if(prev){
      const baseT=routeOrderRatio(item,prev,left,pos,prevPos,leftPos);
      const t=clampRouteRatio(baseT,1,3);
      return interpolateRoutePoint(prev,left,t);
    }
  }
  if(right){
    let next=null,nextPos=-1;
    for(let i=rightPos+1;i<sorted.length;i++){if(sorted[i].hasGPS){next=sorted[i];nextPos=i;break;}}
    if(next){
      const baseT=routeOrderRatio(item,right,next,pos,rightPos,nextPos);
      const t=clampRouteRatio(baseT,-2,0);
      return interpolateRoutePoint(right,next,t);
    }
  }
  return null;
}

const ROUTE_ESTIMATE_CORRECTION_KEY='asset_tracker_v37_manual_estimate_corrections_v1';
const ROUTE_AUTO_ALIGN_VERSION='3.7.1-estimate-dots-visible-safe-lines';
let routeEstimateSelectedKey=null;
let routeEstimateSelectedMarker=null;
let routeEstimateSelectedDP=null;
let routeEstimateMarkerByKey=new Map();
let routeEstimateHitTargetByKey=new Map();
function routeEstimateCorrections(){
  try{return JSON.parse(localStorage.getItem(ROUTE_ESTIMATE_CORRECTION_KEY)||'{}')||{};}catch(e){return {};}
}
function saveRouteEstimateCorrections(obj){
  try{localStorage.setItem(ROUTE_ESTIMATE_CORRECTION_KEY,JSON.stringify(obj||{}));}catch(e){}
}
function routeEstimateKey(dp){
  if(!dp)return '';
  const idx=Number.isInteger(dp.recIndex)?dp.recIndex:(typeof recordIndexOf==='function'?recordIndexOf(dp.r):-1);
  if(idx>=0)return 'R:'+idx;
  const r=dp.r||{};
  const route=compactSearch(getLine(r)||r.__line||'');
  const plate=dp.plate!=null?String(dp.plate):compactSearch(getStructure(r)||r.__title||'');
  return 'V:'+route+':'+plate;
}
function routeEstimateApplyCorrection(dp){
  if(!dp)return dp;
  const key=routeEstimateKey(dp);
  if(!key)return dp;
  const c=routeEstimateCorrections()[key];
  if(!c)return dp;
  if(c.autoAligned&&c.alignVersion!==ROUTE_AUTO_ALIGN_VERSION)return dp;
  if(c.hidden)return null;
  if(Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lng))){
    const isAuto=c.autoAligned===true;
    // Auto-align is helpful for placing the warning dot, but it is not trusted enough to bend the solid blue route line.
    // Manual moves are trusted because the user deliberately corrected the point against map layers.
    return {...dp,lat:Number(c.lat),lng:Number(c.lng),corrected:!isAuto,autoAligned:isAuto,alignVersion:c.alignVersion||'',estimated:true};
  }
  return dp;
}
function routeEstimateSetSelected(key,marker,dp){
  routeEstimateSelectedKey=key||null;
  routeEstimateSelectedMarker=marker||null;
  routeEstimateSelectedDP=dp||null;
  // v3.7.4: selecting an estimate is silent; no top toast popup.
}
function routeEstimateStyleAfterCorrection(marker){
  try{
    if(!marker||!marker.setStyle)return;
    const isGap=marker._tlEstimateType==='gap';
    marker.setStyle({
      radius:isGap?7.4:7.8,
      weight:2.6,
      opacity:1,
      fillOpacity:.98,
      color:'#fff8e8',
      fillColor:isGap?'#ff9f1a':'#ffd34d'
    });
    if(marker.bringToFront)marker.bringToFront();
  }catch(e){}
}
function routeEstimateMoveKeyTo(key,lat,lng){
  if(!key||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))){showToolStatus?.('No selected estimate to move.');return;}
  const all=routeEstimateCorrections();
  all[key]={...(all[key]||{}),lat:Number(lat),lng:Number(lng),hidden:false,autoAligned:false,alignVersion:'manual',updatedAt:new Date().toISOString()};
  saveRouteEstimateCorrections(all);
  const marker=routeEstimateMarkerByKey.get(key)||routeEstimateSelectedMarker;
  try{if(marker&&marker.setLatLng)marker.setLatLng([Number(lat),Number(lng)]);routeEstimateStyleAfterCorrection(marker);}catch(e){}
  try{const hit=routeEstimateHitTargetByKey.get(key)||(marker&&marker._routeEstimateHitLayer);if(hit&&hit.setLatLng)hit.setLatLng([Number(lat),Number(lng)]);}catch(e){}
  if(routeEstimateSelectedDP){routeEstimateSelectedDP.lat=Number(lat);routeEstimateSelectedDP.lng=Number(lng);routeEstimateSelectedDP.corrected=true;}
  showToolStatus?.('Estimate moved and saved locally. Route line recalculating.');
  try{routeRefreshCurrentAfterEstimateChange?.();}catch(e){}
}
function routeEstimateArmMove(key){
  key=String(key||routeEstimateSelectedKey||'');
  if(!key){showToolStatus?.('Tap a yellow/orange estimate dot first.');return;}
  routeEstimateSelectedKey=key;
  closeEstimateReviewSheet?.();
  showToolStatus?.('Tap the map where this estimate should move.');
  if(map&&map.once){
    map.once('click',e=>{
      if(!e||!e.latlng)return;
      routeEstimateMoveKeyTo(key,e.latlng.lat,e.latlng.lng);
    });
  }
}
function routeEstimateArmMoveSelected(){routeEstimateArmMove(routeEstimateSelectedKey)}
function routeEstimateMoveSelectedToCentre(){
  if(!routeEstimateSelectedKey){showToolStatus?.('Tap a yellow/orange estimate dot first.');return;}
  const c=map&&map.getCenter?map.getCenter():null;
  if(!c){showToolStatus?.('Map centre unavailable.');return;}
  routeEstimateMoveKeyTo(routeEstimateSelectedKey,c.lat,c.lng);
}
function routeEstimateHideKey(key){
  key=String(key||routeEstimateSelectedKey||'');
  if(!key){showToolStatus?.('Tap a yellow/orange estimate dot first.');return;}
  const all=routeEstimateCorrections();
  all[key]={...(all[key]||{}),hidden:true,autoAligned:false,alignVersion:'manual',updatedAt:new Date().toISOString()};
  saveRouteEstimateCorrections(all);
  const marker=routeEstimateMarkerByKey.get(key)||routeEstimateSelectedMarker;
  try{const hit=routeEstimateHitTargetByKey.get(key)||(marker&&marker._routeEstimateHitLayer);if(hit&&assetLayer&&assetLayer.hasLayer(hit))assetLayer.removeLayer(hit);routeEstimateHitTargetByKey.delete(key);}catch(e){}
  try{if(marker&&assetLayer&&assetLayer.hasLayer(marker))assetLayer.removeLayer(marker);}catch(e){}
  showToolStatus?.('Estimate hidden locally. Route line recalculating.');
  try{routeRefreshCurrentAfterEstimateChange?.();}catch(e){}
}
function routeEstimateHideSelected(){routeEstimateHideKey(routeEstimateSelectedKey)}
function routeEstimateResetKey(key){
  key=String(key||routeEstimateSelectedKey||'');
  if(!key){showToolStatus?.('Tap a yellow/orange estimate dot first.');return;}
  const all=routeEstimateCorrections();
  delete all[key];
  saveRouteEstimateCorrections(all);
  showToolStatus?.('Estimate correction reset. Route reloading.');
  try{routeRefreshCurrentAfterEstimateChange?.();}catch(e){}
}
function routeEstimateResetSelected(){routeEstimateResetKey(routeEstimateSelectedKey)}
function routeEstimatePopupButtons(dp){
  if(!dp||!dp.estimated)return '';
  const key=routeEstimateKey(dp);
  const enc=encodeURIComponent(key);
  return `<button class="asset-popup-nav estimate-move-btn" onclick="event.stopPropagation();routeEstimateArmMove(decodeURIComponent('${enc}'))">Move</button><button class="asset-popup-view estimate-hide-btn" onclick="event.stopPropagation();routeEstimateHideKey(decodeURIComponent('${enc}'))">Hide</button>`;
}

/* v3.6.87 dynamic estimate-aware route lines + live auto-align progress/status OSM feature snap.
   Map tiles themselves are raster images, so the app cannot read roads/symbols out of the tile image.
   This uses public vector features from OpenStreetMap/Overpass when the user presses Auto align.
*/
let routeReviewLineLayers=[];
let routeLastSingleRows=null;
let routeLastSingleName='';
let routeLastMultiNames=null;
let routeLastDisplayGroups=[];
let routeAutoAlignOnLineLoad=false;
let routeAutoAlignSuppressNextLoad=false;
let routeAutoAlignRunning=false;
const ROUTE_AUTO_ALIGN_DONE_KEY='asset_tracker_v37_auto_align_done_v1';
function routeSimpleHash(str){
  str=String(str||'');
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36);
}
function routeAutoAlignDoneMap(){
  try{return JSON.parse(localStorage.getItem(ROUTE_AUTO_ALIGN_DONE_KEY)||'{}')||{};}catch(e){return {};}
}
function saveRouteAutoAlignDoneMap(obj){
  try{localStorage.setItem(ROUTE_AUTO_ALIGN_DONE_KEY,JSON.stringify(obj||{}));}catch(e){}
}
function routeClearAutoAlignSavedChecks(){
  try{localStorage.removeItem(ROUTE_AUTO_ALIGN_DONE_KEY);}catch(e){}
  routeAutoAlignSetStatus('Saved auto-align checks cleared',100,'Next route load/manual run will check again.');
}
function routeAutoAlignDoneKey(estimates,label){
  const names=(routeLastDisplayGroups||[]).map(g=>g&&g.name?String(g.name):'').filter(Boolean).join('|') || String(label||routeLastSingleName||(routeLastMultiNames||[]).join('|')||'route');
  const src=(routeLastSingleRows&&routeLastSingleRows.length?routeLastSingleRows:[]);
  const srcCount=src.length;
  const gpsCount=src.filter(r=>{try{return hasGPS(r)}catch(e){return false;}}).length;
  const sample=[];
  if(src.length){
    const picks=[0,Math.floor(src.length*.25),Math.floor(src.length*.5),Math.floor(src.length*.75),src.length-1];
    picks.forEach(i=>{const r=src[i]; if(r)sample.push([getLine(r)||'',getStructure(r)||'',hasGPS(r)?String(getLat(r).toFixed?getLat(r).toFixed(5):getLat(r)):'',hasGPS(r)?String(getLng(r).toFixed?getLng(r).toFixed(5):getLng(r)):''].join('/'));});
  }
  const estKeys=(estimates||[]).filter(dp=>dp&&dp.estimated&&routeDisplayHasCoord(dp)).map(dp=>routeEstimateKey(dp)).filter(Boolean).sort();
  const sig=[ROUTE_AUTO_ALIGN_VERSION,names,srcCount,gpsCount,estKeys.length,sample.join('|'),estKeys.join(',')].join('||');
  return 'aal:'+routeSimpleHash(sig);
}
function routeAutoAlignWasDone(estimates,label){
  const key=routeAutoAlignDoneKey(estimates,label);
  const done=routeAutoAlignDoneMap();
  const hit=key&&done[key]&&done[key].alignVersion===ROUTE_AUTO_ALIGN_VERSION;
  // Do not treat previous failed / zero-move checks as finished. They must retry after a better lookup or better signal.
  return !!(hit && Number(done[key].moved)>0);
}
function routeAutoAlignMarkDone(estimates,label,res){
  const moved=Number(res&&res.moved)||0;
  if(moved<=0)return;
  const key=routeAutoAlignDoneKey(estimates,label);
  if(!key)return;
  const done=routeAutoAlignDoneMap();
  done[key]={alignVersion:ROUTE_AUTO_ALIGN_VERSION,label:String(label||routeLastSingleName||''),checked:Number(res&&res.checked)||0,moved,features:Number(res&&res.featureCount)||0,at:new Date().toISOString()};
  const keys=Object.keys(done).sort((a,b)=>String(done[b].at||'').localeCompare(String(done[a].at||'')));
  keys.slice(220).forEach(k=>delete done[k]);
  saveRouteAutoAlignDoneMap(done);
}
function routeClearReviewLines(){
  try{
    (routeReviewLineLayers||[]).forEach(l=>{try{if(assetLayer&&assetLayer.hasLayer(l))assetLayer.removeLayer(l);}catch(e){}});
    routeReviewLineLayers=[];
  }catch(e){routeReviewLineLayers=[];}
}
function routeDisplayLineBreakMeters(dps){
  const rows=(dps||[]).filter(routeDisplayHasCoord).sort((a,b)=>routeDisplayOrderValue(a)-routeDisplayOrderValue(b)||a.sourceOrder-b.sourceOrder);
  const steps=[];
  for(let i=1;i<rows.length;i++){
    const d=routeMeters(rows[i-1],rows[i]);
    if(Number.isFinite(d)&&d>3&&d<6000)steps.push(d);
  }
  steps.sort((a,b)=>a-b);
  const med=steps.length?steps[Math.floor(steps.length*.5)]:220;
  return Math.max(650,Math.min(4200,med*6.5));
}
function routeGapBridgeLimitMeters(rows,breakM){
  const ds=[];
  for(let i=1;i<(rows||[]).length;i++){
    const d=routeMeters(rows[i-1],rows[i]);
    if(Number.isFinite(d)&&d>5)ds.push(d);
  }
  ds.sort((a,b)=>a-b);
  const p90=ds.length?ds[Math.floor(ds.length*.9)]:(breakM||1600);
  return Math.max(8000,Math.min(60000,Math.max((breakM||1600)*12,p90*1.25)));
}
function routeGapBridgeLooksSafe(prev,next,d,breakM,bridgeLimit){
  if(!prev||!next||!Number.isFinite(d))return false;
  if(d<=breakM)return false;
  if(d>bridgeLimit)return false;
  const pa=Number(prev.plate), pb=Number(next.plate);
  const plateGap=(Number.isFinite(pa)&&Number.isFinite(pb))?Math.abs(pb-pa):null;
  const sourceGap=Math.abs(Number(next.sourceOrder||0)-Number(prev.sourceOrder||0));
  // Bridge likely same-run gaps, but still avoid absurd cross-country links.
  if(plateGap!==null&&plateGap>0){
    const step=d/plateGap;
    if(step>=8&&step<=1800&&plateGap<=220)return true;
    if(sourceGap>0&&sourceGap<=plateGap+8&&step<=2300&&plateGap<=260)return true;
  }
  return sourceGap>0&&sourceGap<=18&&d<=Math.max(12000,(breakM||1600)*5.5);
}
function routeDrawGapBridgeLine(prev,next,layer,opts,d,breakM,bridgeLimit){
  if(!prev||!next||!layer||typeof L==='undefined')return null;
  if(!routeGapBridgeLooksSafe(prev,next,d,breakM,bridgeLimit))return null;
  const l=registerMapToggleLayer(L.polyline([[Number(prev.lat),Number(prev.lng)],[Number(next.lat),Number(next.lng)]],{
    color:opts.bridgeColor||opts.color||'#2f80ed',
    weight:Math.max(2.4,(opts.weight||3.2)-.4),
    opacity:opts.bridgeOpacity??.38,
    fill:false,
    lineCap:'round',
    lineJoin:'round',
    smoothFactor:.25,
    noClip:false,
    dashArray:opts.bridgeDash||'8 8',
    className:opts.bridgeClassName||'route-gap-bridge-line'
  }).addTo(layer),null,'line');
  l._tlDynamicRouteLine=true;
  l._tlRouteGapBridge=true;
  try{l.bindTooltip('Unverified bridged route gap - check against map layers');}catch(e){}
  routeReviewLineLayers.push(l);
  return l;
}
function routeConnectionPlateLooksSafe(prev,cur,d,breakM){
  try{
    if(!prev||!cur||!Number.isFinite(d))return true;
    const pa=Number(prev.plate), pb=Number(cur.plate);
    if(Number.isFinite(pa)&&Number.isFinite(pb)){
      const gap=Math.abs(pb-pa);
      if(gap===0 && d>35)return false;
      if(gap<=2 && d>Math.max(900,(breakM||1200)*.72))return false;
      if(gap>0){
        const step=d/gap;
        if(gap<=8 && step>1800)return false;
      }
    }
    return true;
  }catch(e){return true;}
}
function routeConnectionAngleLooksSafe(prevPrev,prev,cur,next){
  try{
    // Reject obvious fan/triangle joins caused by duplicate/branch records, but allow normal 90-degree route corners.
    if(!prev||!cur)return true;
    if(prevPrev&&next){
      const a=routeMeters(prevPrev,prev), b=routeMeters(prev,cur), c=routeMeters(cur,next), chord=routeMeters(prevPrev,next);
      if([a,b,c,chord].every(Number.isFinite)){
        const path=a+b+c;
        // A forced fan often makes a long dog-leg through one bad point when a direct local corridor is much shorter.
        if(path>Math.max(900,chord*3.8) && b>Math.max(a,c)*1.7)return false;
        if((prev.estimated||cur.estimated||prevPrev.estimated||next.estimated) && path>Math.max(780,chord*2.55) && b>Math.max(240,Math.min(a,c)*1.85))return false;
      }
    }
    return true;
  }catch(e){return true;}
}
function routeConnectionLooksSafe(rows,i,breakM){
  const prev=rows[i-1], cur=rows[i];
  if(!prev||!cur)return true;
  const d=routeMeters(prev,cur);
  if(!routeConnectionPlateLooksSafe(prev,cur,d,breakM))return false;
  const prevPrev=i>=2?rows[i-2]:null;
  const next=i+1<rows.length?rows[i+1]:null;
  if(next){
    try{
      const a=routeMeters(prev,cur), b=routeMeters(cur,next), c=routeMeters(prev,next);
      if([a,b,c].every(Number.isFinite)&&c>8&&(prev.estimated||cur.estimated||next.estimated)){
        if(a+b>Math.max(720,c*2.55) && Math.max(a,b)>Math.max(240,Math.min(a,b)*1.9))return false;
      }
    }catch(e){}
  }
  if(!routeConnectionAngleLooksSafe(prevPrev,prev,cur,next))return false;
  return true;
}

function routeLineCleanerRows(rows,breakM,stats){
  try{
    rows=(rows||[]).filter(routeDisplayHasCoord).sort((a,b)=>routeDisplayOrderValue(a)-routeDisplayOrderValue(b)||a.sourceOrder-b.sourceOrder);
    if(rows.length<4)return rows;
    stats=stats||routeLineSpacingStats(rows);
    const cleaned=[];
    for(let i=0;i<rows.length;i++){
      const prev=rows[i-1], cur=rows[i], next=rows[i+1];
      let skip=false;
      if(prev&&cur&&next){
        const a=routeMeters(prev,cur), b=routeMeters(cur,next), c=routeMeters(prev,next);
        if([a,b,c].every(Number.isFinite)&&c>8){
          const path=a+b;
          const worst=Math.max(a,b), smallest=Math.min(a,b);
          // Drop single off-corridor points from the line only. Dots remain clickable/visible.
          if(path>Math.max(stats.cleanPathMin,c*2.45) && worst>Math.max(stats.cleanWorstMin,smallest*1.75))skip=true;
          // Strong fan removal: if prev->next is clearly the clean local path, don't draw a dog-leg through cur.
          if(c<Math.max(stats.cleanWorstMin,worst*.50) && smallest>Math.max(80,stats.median*.55) && path>c*2.2)skip=true;
        }
      }
      if(!skip)cleaned.push(cur);
    }
    return cleaned.length>=2?cleaned:rows;
  }catch(e){return rows||[];}
}

function routeDrawInferredGapLine(prev,next,layer,opts,d){
  if(!prev||!next||!layer||typeof L==='undefined')return null;
  if(!Number.isFinite(Number(prev.lat))||!Number.isFinite(Number(prev.lng))||!Number.isFinite(Number(next.lat))||!Number.isFinite(Number(next.lng)))return null;
  const l=registerMapToggleLayer(L.polyline([[Number(prev.lat),Number(prev.lng)],[Number(next.lat),Number(next.lng)]],{
    color:opts.inferredColor||'#ffb13b',
    weight:Math.max(2.2,(opts.weight||3.2)-.8),
    opacity:opts.inferredOpacity??.46,
    fill:false,
    lineCap:'round',
    lineJoin:'round',
    smoothFactor:.25,
    noClip:false,
    dashArray:opts.inferredDash||'5 9',
    className:opts.inferredClassName||'route-inferred-estimate-line'
  }).addTo(layer),null,'line');
  l._tlDynamicRouteLine=true;
  l._tlRouteInferredEstimate=true;
  try{l.bindTooltip('Unverified estimate gap - yellow/orange dots are not trusted GPS. Move/correct estimates to lock the line.');}catch(e){}
  routeReviewLineLayers.push(l);
  return l;
}
function routeLineDedupTrustedRows(rows){
  // Keep the line from being dragged into fans by duplicate branch/detail records sharing the same number.
  // Dots still draw; this only affects line geometry.
  const byPlate=new Map(), loose=[];
  (rows||[]).forEach(dp=>{
    if(!routeDisplayHasCoord(dp) || !routeEstimateIsTrustedForLine(dp))return;
    const p=Number(dp.plate);
    if(Number.isFinite(p)){
      const old=byPlate.get(p);
      // Prefer real GPS over manually corrected estimates; otherwise first source order wins.
      if(!old || (old.estimated&&!dp.estimated) || ((old.estimated===dp.estimated) && (Number(dp.sourceOrder)||0)<(Number(old.sourceOrder)||0))) byPlate.set(p,dp);
    }else loose.push(dp);
  });
  return Array.from(byPlate.values()).concat(loose).sort((a,b)=>routeDisplayOrderValue(a)-routeDisplayOrderValue(b)||a.sourceOrder-b.sourceOrder);
}
function routeLineSpacingStats(rows){
  const steps=[];
  const ordered=(rows||[]).filter(routeDisplayHasCoord).sort((a,b)=>routeDisplayOrderValue(a)-routeDisplayOrderValue(b)||a.sourceOrder-b.sourceOrder);
  for(let i=1;i<ordered.length;i++){
    const a=ordered[i-1],b=ordered[i];
    const d=routeMeters(a,b);
    const pa=Number(a.plate),pb=Number(b.plate);
    if(!Number.isFinite(d)||d<5)continue;
    if(Number.isFinite(pa)&&Number.isFinite(pb)){
      const gap=Math.abs(pb-pa);
      if(gap>=1&&gap<=8){
        const step=d/gap;
        if(step>=8&&step<=1800)steps.push(step);
      }
    }else if(d<1800){steps.push(d);}
  }
  steps.sort((a,b)=>a-b);
  const median=steps.length?steps[Math.floor(steps.length*.5)]:220;
  const p85=steps.length?steps[Math.floor(steps.length*.85)]:median;
  const p95=steps.length?steps[Math.floor(steps.length*.95)]:p85;
  return {
    median,
    p85,
    p95,
    maxSingle:Math.max(240,Math.min(1800,Math.max(median*4.5,p85*2.8))),
    maxStep:Math.max(280,Math.min(1800,Math.max(median*4.2,p85*2.5))),
    hardBreak:Math.max(550,Math.min(4200,Math.max(median*8,p85*4,p95*2.2))),
    cleanPathMin:Math.max(420,Math.min(1500,median*5.8)),
    cleanWorstMin:Math.max(180,Math.min(900,median*2.8))
  };
}
function routeReliableLineConnectionSafe(rows,i,breakM,stats){
  const prev=rows[i-1], cur=rows[i];
  if(!prev||!cur)return true;
  stats=stats||routeLineSpacingStats(rows);
  const d=routeMeters(prev,cur);
  if(!Number.isFinite(d))return false;
  const hard=Math.min(Number(breakM)||stats.hardBreak||1800,stats.hardBreak||1800,4200);
  if(d>hard)return false;
  const pa=Number(prev.plate), pb=Number(cur.plate);
  if(Number.isFinite(pa)&&Number.isFinite(pb)){
    const gap=Math.abs(pb-pa);
    if(gap===0 && d>Math.max(45,stats.median*.9))return false;
    if(gap<=1 && d>stats.maxSingle)return false;
    if(gap>1 && gap<=3 && (d/gap)>Math.max(260,stats.maxStep*.85))return false;
    if(gap>3 && (d/gap)>stats.maxStep)return false;
    if(i>=2){
      const pp=Number(rows[i-2].plate);
      if(Number.isFinite(pp)){
        const dir1=Math.sign(pa-pp), dir2=Math.sign(pb-pa);
        if(dir1&&dir2&&dir1!==dir2&&d>Math.max(90,stats.median*1.2))return false;
      }
    }
  }
  if(!routeConnectionLooksSafe(rows,i,breakM))return false;
  if(i+1<rows.length){
    const next=rows[i+1];
    const a=routeMeters(prev,cur), b=routeMeters(cur,next), c=routeMeters(prev,next);
    if([a,b,c].every(Number.isFinite)&&c>8){
      const path=a+b;
      // Break spikes/fans through one wrong point. This applies to real GPS too; the dot remains visible.
      if(path>Math.max(stats.cleanPathMin,c*2.35) && Math.max(a,b)>Math.max(stats.cleanWorstMin,Math.min(a,b)*1.65))return false;
    }
  }
  return true;
}

function routeDrawEstimateAwareLine(dps,layer,opts={}){
  if(!layer||typeof L==='undefined')return [];
  // v3.7.1 reliable-lines mode:
  //   - no raw orange/yellow estimate can pull or bridge the blue line
  //   - no automatic inferred amber bridge lines
  //   - line is only real GPS + manual-corrected estimates, deduped by structure number; yellow/orange dots still draw as warnings
  let rows=routeLineDedupTrustedRows(dps||[]);
  let stats=routeLineSpacingStats(rows);
  rows=routeLineCleanerRows(rows,opts.breakM||routeDisplayLineBreakMeters(rows),stats);
  stats=routeLineSpacingStats(rows);
  if(rows.length<2)return [];
  const breakM=Math.min(opts.breakM||routeDisplayLineBreakMeters(rows),stats.hardBreak||2600,4200);
  const made=[];
  let seg=[];
  const flush=()=>{
    if(seg.length>1){
      const l=registerMapToggleLayer(L.polyline(seg,{
        color:opts.color||'#2f80ed',
        weight:opts.weight||3.2,
        opacity:opts.opacity??.70,
        fill:false,
        lineCap:'round',
        lineJoin:'round',
        smoothFactor:.35,
        noClip:false,
        className:opts.className||'route-estimate-aware-line route-reliable-line'
      }).addTo(layer),null,'line');
      l._tlDynamicRouteLine=true;
      if(opts.tooltip)l.bindTooltip(opts.tooltip+' | reliable GPS/manual line only');
      made.push(l);
      routeReviewLineLayers.push(l);
    }
    seg=[];
  };
  for(let i=0;i<rows.length;i++){
    const dp=rows[i];
    const ll=[Number(dp.lat),Number(dp.lng)];
    if(!Number.isFinite(ll[0])||!Number.isFinite(ll[1]))continue;
    if(!seg.length){seg.push(ll);continue;}
    const safe=routeReliableLineConnectionSafe(rows,i,breakM,stats);
    if(!safe)flush();
    seg.push(ll);
  }
  flush();
  return made;
}
function routeStoreDisplayGroup(name,dps){
  if(!Array.isArray(routeLastDisplayGroups))routeLastDisplayGroups=[];
  routeLastDisplayGroups.push({name:String(name||''),dps:dps||[]});
}
function routeRedrawReviewLinesFromGroups(){
  routeClearReviewLines();
  (routeLastDisplayGroups||[]).forEach(g=>routeDrawEstimateAwareLine(g.dps,assetLayer,{tooltip:(g.name||'Route')+' | adjusted path'}));
  try{applyMapToggleSettings?.();}catch(e){}
}
function routeRefreshCurrentAfterEstimateChange(){
  if(routeLastMultiNames&&routeLastMultiNames.length){
    const names=routeLastMultiNames.slice();
    setTimeout(()=>showRoutesOnMap(names),60);
    return;
  }
  if(routeLastSingleRows&&routeLastSingleName){
    const rows=routeLastSingleRows.slice();
    const name=routeLastSingleName;
    setTimeout(()=>showLineOnMap(rows,name),60);
    return;
  }
  routeRedrawReviewLinesFromGroups();
}
function routeAutoAlignEnsureStatusEl(){
  let el=document.getElementById('routeAutoAlignStatus');
  if(!el){
    el=document.createElement('div');
    el.id='routeAutoAlignStatus';
    el.className='auto-align-status';
    document.body.appendChild(el);
  }
  return el;
}
function routeAutoAlignSetStatus(message,pct,details){
  const n=Number(pct);
  const safePct=Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0;
  const text=String(message||'Auto align running...');
  try{
    const el=routeAutoAlignEnsureStatusEl();
    el.classList.add('show');
    el.innerHTML=`<div class="auto-align-status-head"><b>${esc(text)}</b><span>${safePct}%</span></div><div class="auto-align-status-bar"><i style="width:${safePct}%"></i></div>${details?`<div class="auto-align-status-detail">${esc(details)}</div>`:''}`;
  }catch(e){}
  try{showToolStatus?.(`${text} ${safePct}%${details?' | '+details:''}`);}catch(e){}
  try{
    const mini=document.getElementById('estimateReviewProgress');
    if(mini){
      mini.classList.add('show');
      mini.innerHTML=`<div><b>${esc(text)}</b><span>${safePct}%</span></div><div class="estimate-review-progress-bar"><i style="width:${safePct}%"></i></div>${details?`<small>${esc(details)}</small>`:''}`;
    }
  }catch(e){}
}
function routeAutoAlignFinishStatus(message,details){
  routeAutoAlignSetStatus(message||'Auto align complete',100,details||'');
  clearTimeout(window.__routeAutoAlignStatusTimer);
  window.__routeAutoAlignStatusTimer=setTimeout(()=>{
    try{document.getElementById('routeAutoAlignStatus')?.classList.remove('show');}catch(e){}
  },9000);
}
function routeEstimateUpdateLive(key,lat,lng,meta){
  key=String(key||'');
  lat=Number(lat);lng=Number(lng);
  if(!key||!Number.isFinite(lat)||!Number.isFinite(lng))return false;
  let updated=false;
  try{
    (routeLastDisplayGroups||[]).forEach(g=>(g.dps||[]).forEach(dp=>{
      if(dp&&dp.estimated&&routeEstimateKey(dp)===key){
        dp.lat=lat;dp.lng=lng;dp.corrected=true;dp.autoAligned=true;dp.alignVersion=ROUTE_AUTO_ALIGN_VERSION;
        if(meta&&meta.kind)dp._alignKind=meta.kind;
        if(meta&&Number.isFinite(Number(meta.d)))dp._alignDistance=Number(meta.d);
        updated=true;
      }
    }));
  }catch(e){}
  try{
    const marker=routeEstimateMarkerByKey.get(key);
    if(marker&&marker.setLatLng){
      marker.setLatLng([lat,lng]);
      routeEstimateStyleAfterCorrection(marker);
      const hit=routeEstimateHitTargetByKey.get(key)||marker._routeEstimateHitLayer;
      if(hit&&hit.setLatLng)hit.setLatLng([lat,lng]);
      updated=true;
    }
  }catch(e){}
  return updated;
}
function routeEstimateMoveKeyToNoRedraw(key,lat,lng,meta){
  if(!key||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng)))return false;
  let current=null;
  try{
    (routeLastDisplayGroups||[]).some(g=>(g.dps||[]).some(dp=>{
      if(dp&&dp.estimated&&routeEstimateKey(dp)===key){current=dp;return true;}
      return false;
    }));
  }catch(e){}
  if(current && !routeAutoAlignMeaningfulMove(current,lat,lng))return false;
  const all=routeEstimateCorrections();
  all[key]={...(all[key]||{}),lat:Number(lat),lng:Number(lng),hidden:false,updatedAt:new Date().toISOString(),autoAligned:true,alignVersion:ROUTE_AUTO_ALIGN_VERSION,alignKind:meta&&meta.kind?String(meta.kind):'',alignDistance:Number.isFinite(Number(meta&&meta.d))?Number(meta.d):null};
  saveRouteEstimateCorrections(all);
  routeEstimateUpdateLive(key,lat,lng,meta||{});
  return true;
}
function routeLatLngBoundsExpanded(points,padMeters){
  const pts=(points||[]).map(p=>Array.isArray(p)?{lat:Number(p[0]),lng:Number(p[1])}:p).filter(p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)));
  if(!pts.length)return null;
  let minLat=Infinity,maxLat=-Infinity,minLng=Infinity,maxLng=-Infinity;
  pts.forEach(p=>{const lat=Number(p.lat),lng=Number(p.lng);minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);minLng=Math.min(minLng,lng);maxLng=Math.max(maxLng,lng);});
  const midLat=(minLat+maxLat)/2;
  const metres=Math.max(900,Number(padMeters)||1800);
  const dLat=metres/111320;
  const dLng=metres/(111320*Math.max(.18,Math.cos(midLat*Math.PI/180)));
  const heightM=Math.abs(maxLat-minLat)*111320;
  const widthM=Math.abs(maxLng-minLng)*111320*Math.max(.18,Math.cos(midLat*Math.PI/180));
  const extraLat=Math.max(dLat,(Math.max(0,(metres*2)-heightM)/2)/111320);
  const extraLng=Math.max(dLng,(Math.max(0,(metres*2)-widthM)/2)/(111320*Math.max(.18,Math.cos(midLat*Math.PI/180))));
  try{return L.latLngBounds([[minLat-extraLat,minLng-extraLng],[maxLat+extraLat,maxLng+extraLng]]);}catch(e){return null;}
}
function routeBoundsFromEstimateDps(estimates,padMeters){
  const pts=(estimates||[]).filter(routeDisplayHasCoord).map(dp=>({lat:Number(dp.lat),lng:Number(dp.lng)}));
  const b=routeLatLngBoundsExpanded(pts,padMeters||2200);
  if(b)return b;
  if(map&&map.getBounds)return map.getBounds().pad?map.getBounds().pad(.2):map.getBounds();
  return null;
}
function routeOsmQueryForBounds(bounds,mode){
  const b=bounds||(map&&map.getBounds?(map.getBounds().pad?map.getBounds().pad(.16):map.getBounds()):null);
  if(!b)return '';
  const s=b.getSouth(),w=b.getWest(),n=b.getNorth(),e=b.getEast();
  // v3.6.94: small targeted Overpass lookups. The old query asked for broad relations/large ways and often timed out,
  // so auto-align looked like it was doing nothing. First pass is power pole/tower/switch nodes only.
  const nodeQuery=[
    `node["power"~"^(pole|tower|portal|terminal|switch|transformer|switchgear)$"](${s},${w},${n},${e});`,
    `node["man_made"~"^(utility_pole|tower)$"](${s},${w},${n},${e});`,
    `node["tower:type"](${s},${w},${n},${e});`,
    `node["pole:type"](${s},${w},${n},${e});`,
    `node["utility"="power"](${s},${w},${n},${e});`
  ].join('');
  const wayQuery=[
    `way["power"~"^(line|minor_line|cable|portal|connection)$"](${s},${w},${n},${e});`,
    `way["voltage"](${s},${w},${n},${e});`,
    `way["utility"="power"](${s},${w},${n},${e});`
  ].join('');
  if(mode==='powerNodes')return `[out:json][timeout:12];(${nodeQuery});out body;`;
  if(mode==='powerWays')return `[out:json][timeout:16];(${wayQuery});out geom;`;
  if(mode==='powerOnly')return `[out:json][timeout:18];(${nodeQuery}${wayQuery});out geom;`;
  return `[out:json][timeout:18];(${nodeQuery}${wayQuery}way["railway"](${s},${w},${n},${e});way["waterway"](${s},${w},${n},${e});way["highway"](${s},${w},${n},${e}););out geom;`;
}
function routeFeaturePriority(tags){
  tags=tags||{};
  const power=String(tags.power||'').toLowerCase();
  const utility=String(tags.utility||'').toLowerCase();
  const man=String(tags.man_made||'').toLowerCase();
  const voltage=String(tags.voltage||'');
  const hasLineTag=!!tags.line;
  const nodeLike=!!(tags.tower_type||tags['tower:type']||tags.pole_type||tags['pole:type']) || /^(tower|pole|portal|terminal|switch|transformer|substation|insulator|switchgear|busbar)$/.test(power)||/^(utility_pole|tower|communications_tower)$/.test(man);
  if(tags.power||utility==='power'||voltage||nodeLike||hasLineTag){
    const kind=nodeLike?'powerNode':'power';
    const isLine=/^(line|minor_line|cable|busbar|portal|connection)$/.test(power)||voltage||hasLineTag||(!nodeLike&&tags.power);
    // v3.6.94: pole/tower nodes are now prioritised over long power-line ways.
    // If a missing estimate sits on a straight blue bridge, the previous scoring often picked the
    // line itself with almost zero movement, so nothing visibly changed. Nodes now win when nearby.
    return {kind,limit:nodeLike?720:(isLine?6500:2600),score:nodeLike?-9800:-5200};
  }
  if(tags.railway)return {kind:'railway',limit:75,score:1800};
  if(tags.waterway)return {kind:'waterway',limit:65,score:2200};
  if(tags.highway)return {kind:'road',limit:42,score:6800};
  return {kind:'other',limit:45,score:9000};
}
function routeEnhanceOsmPowerFeatures(features){
  const base=(features||[]).filter(Boolean);
  const extra=[];
  // v3.6.94: OSM/HOT tiles often draw tower/pole symbols from vertices along a power way,
  // not separate power=tower/pole nodes. Previous builds snapped to the long way itself, so the
  // estimate barely moved. Create high-priority snap points from power-way vertices as well.
  const vertexSeen=new Set();
  function addVertex(pt,sourceKind){
    if(!pt||!Number.isFinite(Number(pt.lat))||!Number.isFinite(Number(pt.lng)))return;
    const key=Number(pt.lat).toFixed(7)+','+Number(pt.lng).toFixed(7);
    if(vertexSeen.has(key))return;
    vertexSeen.add(key);
    extra.push({tags:{power:'way_vertex'},meta:{kind:sourceKind||'powerVertex',limit:1100,score:-9700},pts:[{lat:Number(pt.lat),lng:Number(pt.lng)}]});
  }
  base.forEach(f=>{
    const kind=String(f&&f.meta&&f.meta.kind||'');
    const tags=f&&f.tags||{};
    const isPower=kind.startsWith('power')||!!tags.power||!!tags.voltage||tags.utility==='power'||!!tags.line;
    if(!isPower||!Array.isArray(f.pts)||f.pts.length<2)return;
    f.pts.forEach((pt,idx)=>{
      // Keep all vertices for smaller ways; for very large ways keep enough vertices without flooding the phone.
      if(f.pts.length<=260 || idx===0 || idx===f.pts.length-1 || idx%2===0) addVertex(pt,'powerVertex');
    });
  });
  const nodes=base.concat(extra)
    .filter(f=>f&&f.pts&&f.pts.length===1&&f.meta&&String(f.meta.kind||'').startsWith('power'))
    .map((f,i)=>({i,lat:Number(f.pts[0].lat),lng:Number(f.pts[0].lng),f}))
    .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  // If only poles/towers/vertices are mapped, synthesize short power corridor segments between nearby power points.
  if(nodes.length>=2&&nodes.length<=2400){
    const made=new Set();
    for(let i=0;i<nodes.length;i++){
      const near=[];
      for(let j=0;j<nodes.length;j++){
        if(i===j)continue;
        const d=distanceMeters(nodes[i].lat,nodes[i].lng,nodes[j].lat,nodes[j].lng);
        if(Number.isFinite(d)&&d>=8&&d<=2600)near.push({j,d});
      }
      near.sort((a,b)=>a.d-b.d);
      near.slice(0,3).forEach(n=>{
        const a=Math.min(i,n.j),b=Math.max(i,n.j),key=a+'-'+b;
        if(made.has(key))return; made.add(key);
        extra.push({tags:{power:'synthetic-node-corridor'},meta:{kind:'powerSynthetic',limit:2200,score:-5000},pts:[{lat:nodes[a].lat,lng:nodes[a].lng},{lat:nodes[b].lat,lng:nodes[b].lng}]});
      });
    }
  }
  return base.concat(extra);
}
function routeLatLngToXY(lat,lng,origin){
  const R=6371000;
  const lat0=(origin?.lat??lat)*Math.PI/180;
  return {x:(lng-(origin?.lng??lng))*Math.PI/180*Math.cos(lat0)*R,y:(lat-(origin?.lat??lat))*Math.PI/180*R};
}
function routeXYToLatLng(x,y,origin){
  const R=6371000;
  const lat0=(origin?.lat??0)*Math.PI/180;
  return {lat:(origin.lat+(y/R)*180/Math.PI),lng:(origin.lng+(x/(Math.cos(lat0)*R))*180/Math.PI)};
}
function routeNearestPointOnSegment(p,a,b){
  const origin={lat:p.lat,lng:p.lng};
  const P=routeLatLngToXY(p.lat,p.lng,origin), A=routeLatLngToXY(a.lat,a.lng,origin), B=routeLatLngToXY(b.lat,b.lng,origin);
  const dx=B.x-A.x, dy=B.y-A.y;
  const len2=dx*dx+dy*dy;
  let t=len2?((P.x-A.x)*dx+(P.y-A.y)*dy)/len2:0;
  t=Math.max(0,Math.min(1,t));
  const x=A.x+dx*t, y=A.y+dy*t;
  const ll=routeXYToLatLng(x,y,origin);
  const d=Math.sqrt((P.x-x)*(P.x-x)+(P.y-y)*(P.y-y));
  return {lat:ll.lat,lng:ll.lng,d};
}
function routeCollectCurrentEstimateDps(){
  const out=[];
  (routeLastDisplayGroups||[]).forEach(g=>(g.dps||[]).forEach(dp=>{
    if(dp&&dp.estimated&&routeDisplayHasCoord(dp))out.push(dp);
  }));
  if(out.length)return out;
  try{
    assetLayer&&assetLayer.eachLayer&&assetLayer.eachLayer(l=>{
      if(l&&l._tlRole==='dot'&&(l._tlEstimateType==='gap'||l._tlEstimateType==='estimate')&&l.getLatLng){
        const ll=l.getLatLng();
        out.push({lat:ll.lat,lng:ll.lng,estimated:true,_marker:l,_key:l._routeEstimateKey});
      }
    });
  }catch(e){}
  return out;
}
function routeCollectCurrentContextDps(){
  const out=[];
  try{
    (routeLastDisplayGroups||[]).forEach(g=>(g.dps||[]).forEach(dp=>{
      if(dp&&routeDisplayHasCoord(dp))out.push(dp);
    }));
  }catch(e){}
  return out;
}
async function routeFetchOsmFeaturesForView(bounds,mode){
  const q=routeOsmQueryForBounds(bounds,mode||'powerOnly');
  if(!q)throw new Error('No map bounds available');
  const endpoints=[
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
  ];
  let lastErr=null;
  for(const ep of endpoints){
    const controller=(typeof AbortController!=='undefined')?new AbortController():null;
    const t=controller?setTimeout(()=>controller.abort(),18000):null;
    try{
      const url=ep+'?data='+encodeURIComponent(q);
      const res=await fetch(url,{method:'GET',cache:'no-store',signal:controller?controller.signal:undefined});
      if(!res.ok)throw new Error('OSM feature request failed: '+res.status);
      const data=await res.json();
      const parsed=(data.elements||[]).map(el=>{
        const tags=el.tags||{};
        if(el.type==='way'&&Array.isArray(el.geometry)&&el.geometry.length>1){
          const pts=el.geometry.map(p=>({lat:Number(p.lat),lng:Number(p.lon)})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
          return {tags,meta:routeFeaturePriority(tags),pts};
        }
        if(el.type==='node'&&Number.isFinite(Number(el.lat))&&Number.isFinite(Number(el.lon))){
          return {tags,meta:routeFeaturePriority(tags),pts:[{lat:Number(el.lat),lng:Number(el.lon)}]};
        }
        if(el.type==='relation'&&Array.isArray(el.geometry)&&el.geometry.length>1){
          const pts=el.geometry.map(p=>({lat:Number(p.lat),lng:Number(p.lon)})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
          return {tags,meta:routeFeaturePriority(tags),pts};
        }
        return null;
      }).filter(f=>f&&f.pts&&f.pts.length);
      const enhanced=routeEnhanceOsmPowerFeatures(parsed);
      try{enhanced._sourceEndpoint=ep; enhanced._rawCount=parsed.length;}catch(e){}
      return enhanced;
    }catch(e){lastErr=e;}
    finally{if(t)clearTimeout(t);}
  }
  throw lastErr||new Error('OSM feature lookup failed');
}
function routeAnglePenalty(a,b,refA,refB){
  if(!a||!b||!refA||!refB)return 0;
  try{
    const o={lat:(a.lat+b.lat+refA.lat+refB.lat)/4,lng:(a.lng+b.lng+refA.lng+refB.lng)/4};
    const A=routeLatLngToXY(a.lat,a.lng,o),B=routeLatLngToXY(b.lat,b.lng,o),R1=routeLatLngToXY(refA.lat,refA.lng,o),R2=routeLatLngToXY(refB.lat,refB.lng,o);
    const vx=B.x-A.x,vy=B.y-A.y,wx=R2.x-R1.x,wy=R2.y-R1.y;
    const vl=Math.sqrt(vx*vx+vy*vy),wl=Math.sqrt(wx*wx+wy*wy);
    if(vl<1||wl<1)return 0;
    const cos=Math.abs((vx*wx+vy*wy)/(vl*wl));
    return (1-Math.max(0,Math.min(1,cos)))*180;
  }catch(e){return 0;}
}
function routeNeighbourContext(dp,all){
  const rows=(all||[]).filter(routeDisplayHasCoord).sort((a,b)=>routeDisplayOrderValue(a)-routeDisplayOrderValue(b)||a.sourceOrder-b.sourceOrder);
  const key=routeEstimateKey(dp);
  let pos=rows.findIndex(x=>x===dp||routeEstimateKey(x)===key);
  if(pos<0)return null;
  let left=null,right=null;
  for(let i=pos-1;i>=0;i--){if(routeDisplayHasCoord(rows[i])){left=rows[i];break;}}
  for(let i=pos+1;i<rows.length;i++){if(routeDisplayHasCoord(rows[i])){right=rows[i];break;}}
  if(left&&right)return {a:left,b:right};
  return null;
}
function routeAutoAlignMeaningfulMove(dp,lat,lng){
  if(!dp||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng)))return false;
  const d=distanceMeters(Number(dp.lat),Number(dp.lng),Number(lat),Number(lng));
  // Do not count a snap as a correction if the point barely moves. Previous builds saved these as success, then skipped future checks.
  return Number.isFinite(d)&&d>=3.5;
}
function routeSnapKeepsLocalRun(dp,lat,lng,allEstimates){
  // Reject absurd snaps that break the local sequence. This still allows strong moves to real power features.
  try{
    const ctx=routeNeighbourContext(dp,allEstimates);
    if(!ctx||!ctx.a||!ctx.b)return true;
    const oldTotal=routeMeters(ctx.a,dp)+routeMeters(dp,ctx.b);
    const neu={lat:Number(lat),lng:Number(lng)};
    const newTotal=routeMeters(ctx.a,neu)+routeMeters(neu,ctx.b);
    const chord=routeMeters(ctx.a,ctx.b);
    if(!Number.isFinite(newTotal)||!Number.isFinite(chord))return true;
    const allowance=Math.max(1200,chord*2.8,Number.isFinite(oldTotal)?oldTotal*3.5:0);
    return newTotal<=allowance;
  }catch(e){return true;}
}
function routeNodeSnapLimitForDp(dp,allEstimates){
  let limit=dp&&dp.gapEstimate?520:460;
  try{
    const ctx=routeNeighbourContext(dp,allEstimates);
    if(ctx&&ctx.a&&ctx.b){
      const chord=routeMeters(ctx.a,ctx.b);
      if(Number.isFinite(chord)&&chord>0){
        // v3.6.94: allow enough room to pull bad straight-line estimates onto nearby mapped poles/towers,
        // but do not allow kilometres of drift across suburbs.
        limit=Math.max(limit,Math.min(1800,Math.max(180,chord*.74)));
      }
    }
  }catch(e){}
  return Math.max(120,Math.min(1800,limit));
}
function routeNearestPowerNodeSnap(dp,features,allEstimates,usedTargets){
  const p={lat:Number(dp.lat),lng:Number(dp.lng)};
  if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))return null;
  const nodeLimit=routeNodeSnapLimitForDp(dp,allEstimates);
  let best=null;
  for(const f of features||[]){
    const meta=f&&f.meta?f.meta:routeFeaturePriority(f&&f.tags);
    const kind=String(meta&&meta.kind||'');
    if(!f||!Array.isArray(f.pts)||f.pts.length!==1||!(kind==='powerNode'||kind==='powerVertex'))continue;
    const pt=f.pts[0];
    const d=routeMeters(p,pt);
    const limit=Math.min(Number(meta.limit)||nodeLimit,nodeLimit);
    if(!Number.isFinite(d)||d>limit)continue;
    const targetKey=Number(pt.lat).toFixed(7)+','+Number(pt.lng).toFixed(7);
    const already=usedTargets&&usedTargets.has&&usedTargets.has(targetKey);
    // Do not stack a whole run onto the same public vertex; that created triangle/fan lines.
    const repeatPenalty=already?9000:0;
    const localOk=routeSnapKeepsLocalRun(dp,pt.lat,pt.lng,allEstimates);
    if(!localOk && d>Math.max(420,nodeLimit*.45))continue;
    const score=d+(kind==='powerNode'?-16000:-13200)+repeatPenalty;
    if(!best||score<best.score)best={lat:pt.lat,lng:pt.lng,d,kind,score,limit,angle:0,targetKey};
  }
  return best;
}
function routeBestFeatureSnap(dp,features,allEstimates,usedTargets){
  const p={lat:Number(dp.lat),lng:Number(dp.lng)};
  if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))return null;
  const nodeSnap=routeNearestPowerNodeSnap(dp,features,allEstimates,usedTargets);
  if(nodeSnap)return nodeSnap;
  const ctx=routeNeighbourContext(dp,allEstimates);
  let best=null;
  for(const f of features||[]){
    const meta=f.meta||routeFeaturePriority(f.tags);
    if(f.pts.length===1){
      const pt=f.pts[0];
      const d=routeMeters(p,pt);
      if(Number.isFinite(d)&&d<=meta.limit){
        const score=d+meta.score-120;
        if(!best||score<best.score)best={lat:pt.lat,lng:pt.lng,d,kind:meta.kind,score,limit:meta.limit,angle:0,targetKey:Number(pt.lat).toFixed(7)+','+Number(pt.lng).toFixed(7)};
      }
      continue;
    }
    for(let i=1;i<f.pts.length;i++){
      const a=f.pts[i-1], b=f.pts[i];
      const hit=routeNearestPointOnSegment(p,a,b);
      if(!hit||!Number.isFinite(hit.d)||hit.d>meta.limit)continue;
      // Only use long ways as fallback. If the point barely moves, it is not an alignment.
      if(hit.d<8)continue;
      const angle=ctx?routeAnglePenalty(a,b,ctx.a,ctx.b):0;
      const angleWeight=String(meta.kind||'').startsWith('power')?11:4;
      const score=hit.d+meta.score+(angle*angleWeight)+2500;
      if(!best||score<best.score)best={...hit,kind:meta.kind,score,limit:meta.limit,angle,targetKey:null};
    }
  }
  if(best && !routeSnapKeepsLocalRun(dp,best.lat,best.lng,allEstimates))return null;
  return best;
}
function routeAutoAlignEstimateChunks(estimates){
  const rows=(estimates||[])
    .filter(dp=>dp&&dp.estimated&&routeDisplayHasCoord(dp)&&(dp._key||routeEstimateKey(dp)))
    .sort((a,b)=>routeDisplayOrderValue(a)-routeDisplayOrderValue(b)||Number(a.sourceOrder||0)-Number(b.sourceOrder||0));
  const chunks=[];
  let cur=[], first=null, last=null;
  const flush=()=>{if(cur.length){chunks.push(cur);cur=[];first=null;last=null;}};
  for(const dp of rows){
    if(!cur.length){cur=[dp];first=dp;last=dp;continue;}
    const fromFirst=routeMeters(first,dp);
    const fromLast=routeMeters(last,dp);
    const tooMany=cur.length>=18;
    const tooWide=Number.isFinite(fromFirst)&&fromFirst>1800;
    const bigJump=Number.isFinite(fromLast)&&fromLast>900;
    if(tooMany||tooWide||bigJump){flush();cur=[dp];first=dp;}else cur.push(dp);
    last=dp;
  }
  flush();
  return chunks;
}

async function routeAutoAlignEstimateSet(estimates,opts={}){
  let all=(estimates||[]).filter(dp=>dp&&dp.estimated&&routeDisplayHasCoord(dp));
  if(opts.visibleOnly){
    try{
      const vb=map&&map.getBounds?(map.getBounds().pad?map.getBounds().pad(.35):map.getBounds()):null;
      const visible=vb?all.filter(dp=>vb.contains([Number(dp.lat),Number(dp.lng)])):[];
      if(visible.length)all=visible;
    }catch(e){}
  }
  const total=all.length||0;
  const contextAll=routeCollectCurrentContextDps();
  const snapContext=contextAll.length?contextAll:all;
  const chunks=opts.chunked===false?[all]:routeAutoAlignEstimateChunks(all);
  let moved=0, checked=0, processed=0, powerMoved=0, otherMoved=0, featureCount=0, failedChunks=0, noFeatureChunks=0, nodeFeatureCount=0, wayFeatureCount=0;
  const usedTargets=new Set();
  let lastPct=-1;
  const label=opts.label||'Auto align';
  const status=(phase,extra)=>{
    const pct=total?Math.max(1,Math.min(99,Math.floor((processed/total)*100))):0;
    if(pct!==lastPct || extra || phase){
      lastPct=pct;
      routeAutoAlignSetStatus(`${label}: ${phase||'aligning'}`,pct,extra||`${processed.toLocaleString()} / ${total.toLocaleString()} estimates processed | ${moved.toLocaleString()} moved`);
    }
  };
  if(!total){return {moved,checked,processed,powerMoved,otherMoved,featureCount,failedChunks,noFeatureChunks,chunks:0,total:0};}
  status('starting',`${total.toLocaleString()} estimate${total===1?'':'s'} queued`);
  for(let ci=0;ci<chunks.length;ci++){
    if(opts.token&&window.__showLineToken&&opts.token!==window.__showLineToken)return {cancelled:true,moved,checked,processed,powerMoved,otherMoved,featureCount,failedChunks,noFeatureChunks,chunks:chunks.length,total};
    const chunk=chunks[ci].filter(dp=>dp&&dp.estimated&&routeDisplayHasCoord(dp));
    if(!chunk.length)continue;
    status('fetching map features',`section ${ci+1} / ${chunks.length} | ${processed.toLocaleString()} / ${total.toLocaleString()} estimates processed`);
    let features=[];
    const bounds=routeBoundsFromEstimateDps(chunk,opts.padMeters||900);
    let nodeFeatures=[], wayFeatures=[];
    try{nodeFeatures=await routeFetchOsmFeaturesForView(bounds,'powerNodes');}
    catch(e){failedChunks++;nodeFeatures=[];}
    nodeFeatureCount+=nodeFeatures.length;
    if(!nodeFeatures.length){
      status('checking power line vertices',`section ${ci+1} / ${chunks.length} | no pole/tower nodes in this section`);
      try{wayFeatures=await routeFetchOsmFeaturesForView(bounds,'powerWays');}
      catch(e){if(!nodeFeatures.length)failedChunks++;wayFeatures=[];}
    }
    wayFeatureCount+=wayFeatures.length;
    features=nodeFeatures.length?nodeFeatures:wayFeatures;
    if(!features.length&&opts.allowFallbackFeatures){
      status('checking fallback features',`section ${ci+1} / ${chunks.length} | no power feature found yet`);
      try{features=await routeFetchOsmFeaturesForView(bounds,'all');}
      catch(e){if(!features.length)failedChunks++;}
    }
    if(!features.length){
      noFeatureChunks++;
      processed+=chunk.length;
      checked+=chunk.length;
      status('no public feature match in section',`section ${ci+1} / ${chunks.length} | ${processed.toLocaleString()} / ${total.toLocaleString()} estimates processed | nodes ${nodeFeatureCount.toLocaleString()} | ways ${wayFeatureCount.toLocaleString()}`);
      continue;
    }
    featureCount+=features.length;
    const power=features.filter(f=>(f.meta&&String(f.meta.kind||'').startsWith('power')));
    const firstPass=power.length?power:features;
    for(const dp of chunk){
      if(opts.token&&window.__showLineToken&&opts.token!==window.__showLineToken)return {cancelled:true,moved,checked,processed,powerMoved,otherMoved,featureCount,failedChunks,noFeatureChunks,chunks:chunks.length,total};
      checked++;
      const key=dp._key||routeEstimateKey(dp);
      if(key){
        let snap=routeBestFeatureSnap(dp,firstPass,snapContext,usedTargets);
        if(!snap && power.length) snap=routeBestFeatureSnap(dp,features,snapContext,usedTargets);
        if(snap&&routeEstimateMoveKeyToNoRedraw(key,snap.lat,snap.lng,snap)){
          if(snap.targetKey)usedTargets.add(snap.targetKey);
          moved++;
          if(String(snap.kind||'').startsWith('power'))powerMoved++; else otherMoved++;
        }
      }
      processed++;
      const pct=total?Math.floor((processed/total)*100):100;
      if(pct!==lastPct || processed===total || processed%8===0){
        status('aligning live',`${processed.toLocaleString()} / ${total.toLocaleString()} estimates processed | ${moved.toLocaleString()} moved | nodes ${nodeFeatureCount.toLocaleString()} | ways ${wayFeatureCount.toLocaleString()}`);
      }
      if(processed%18===0){
        try{routeRedrawReviewLinesFromGroups();}catch(e){}
        await new Promise(r=>setTimeout(r,0));
      }
    }
    try{routeRedrawReviewLinesFromGroups();applyMapToggleSettings?.();}catch(e){}
    await new Promise(r=>setTimeout(r,35));
  }
  routeAutoAlignSetStatus(`${label}: finishing`,99,`${processed.toLocaleString()} / ${total.toLocaleString()} estimates processed | ${moved.toLocaleString()} moved | nodes ${nodeFeatureCount.toLocaleString()} | ways ${wayFeatureCount.toLocaleString()}`);
  try{routeRedrawReviewLinesFromGroups();applyMapToggleSettings?.();}catch(e){}
  return {moved,checked,processed,powerMoved,otherMoved,featureCount,nodeFeatureCount,wayFeatureCount,failedChunks,noFeatureChunks,chunks:chunks.length,total};
}


let routePublicPowerDebugLayers=[];
function routeClearPublicPowerDebug(){
  try{routePublicPowerDebugLayers.forEach(l=>{try{if(assetLayer&&assetLayer.hasLayer(l))assetLayer.removeLayer(l);}catch(e){}});}catch(e){}
  routePublicPowerDebugLayers=[];
  showToolStatus?.('Public power feature overlay cleared.');
}
async function routeShowPublicPowerFeaturesForView(){
  if(!map||!assetLayer||typeof L==='undefined'){showToolStatus?.('Map not ready.');return;}
  routeClearPublicPowerDebug();
  routeAutoAlignSetStatus('Checking public power features',3,'Fetching Overpass data for current view');
  try{
    const b=map.getBounds().pad?map.getBounds().pad(.2):map.getBounds();
    let features=[];
    try{features=features.concat(await routeFetchOsmFeaturesForView(b,'powerNodes'));}catch(e){}
    try{features=features.concat(await routeFetchOsmFeaturesForView(b,'powerWays'));}catch(e){}
    let nodes=0,lines=0;
    (features||[]).slice(0,1800).forEach(f=>{
      const kind=String(f&&f.meta&&f.meta.kind||'');
      if(!f||!Array.isArray(f.pts)||!f.pts.length)return;
      if(f.pts.length===1){
        const pt=f.pts[0];
        const m=L.circleMarker([pt.lat,pt.lng],{radius:4.2,weight:2,color:'#7c2cff',fillColor:'#f0c4ff',fillOpacity:.9,opacity:.95}).addTo(assetLayer);
        m.bindTooltip(kind||'public power feature');
        routePublicPowerDebugLayers.push(m);nodes++;
      }else{
        const pts=f.pts.map(p=>[p.lat,p.lng]);
        const l=L.polyline(pts,{color:'#7c2cff',weight:2.2,opacity:.45,dashArray:'5 7'}).addTo(assetLayer);
        routePublicPowerDebugLayers.push(l);lines++;
      }
    });
    routeAutoAlignFinishStatus('Public power feature check complete',`${nodes.toLocaleString()} snap points | ${lines.toLocaleString()} power lines/corridors shown. If zero, tiles show imagery the app cannot read.`);
  }catch(e){
    routeAutoAlignFinishStatus('Public power feature lookup failed',String(e&&e.message||e||'Overpass unavailable'));
  }
}
async function routeAutoAlignEstimatesFromLayers(){
  if(routeAutoAlignRunning){showToolStatus?.('Auto align already running.');return;}
  const allEstimates=routeCollectCurrentEstimateDps();
  if(!allEstimates.length){showToolStatus?.('No estimate dots currently loaded.');return;}
  routeAutoAlignRunning=true;
  routeAutoAlignSetStatus('Auto align: starting',0,`${allEstimates.length.toLocaleString()} estimate${allEstimates.length===1?'':'s'} loaded | targeted public pole/tower nodes first, then power-line vertices`);
  try{
    const res=await routeAutoAlignEstimateSet(allEstimates,{visibleOnly:true,chunked:true,label:'Manual auto align',allowFallbackFeatures:true,padMeters:900});
    if(res.cancelled)return;
    routeAutoAlignMarkDone(allEstimates,'manual',res);
    if(res.moved){
      routeAutoAlignFinishStatus(`Auto aligned ${res.moved} / ${res.checked} estimates`,`${res.powerMoved} powerline | ${res.otherMoved} other | saved locally | live route line redrawn`);
      try{routeRedrawReviewLinesFromGroups();applyMapToggleSettings?.();}catch(e){}
    }else{
      const fail=res.failedChunks?` | ${res.failedChunks} lookup section${res.failedChunks===1?'':'s'} failed`:'';
      const noFeat=res.noFeatureChunks?` | ${res.noFeatureChunks} section${res.noFeatureChunks===1?'':'s'} had no public feature data`:'';
      routeAutoAlignFinishStatus(`Auto align checked ${res.checked} estimates`,`${res.featureCount} public features found | 0 moved | not saved, will retry${fail}${noFeat}`);
    }
  }finally{routeAutoAlignRunning=false;}
}

function routeScheduleAutoAlignOnLoad(token,label){
  if(!routeAutoAlignOnLineLoad)return;
  if(routeAutoAlignSuppressNextLoad){routeAutoAlignSuppressNextLoad=false;return;}
  const estimates=routeCollectCurrentEstimateDps();
  if(!estimates.length)return;
  if(routeAutoAlignWasDone(estimates,label)){
    showToolStatus?.('Route loaded. Previous successful auto-align is saved, so auto-align was skipped. Use Estimate Review to re-run manually.');
    return;
  }
  setTimeout(()=>routeAutoAlignAfterLineLoad(token,label),650);
}
async function routeAutoAlignAfterLineLoad(token,label){
  if(routeAutoAlignRunning)return;
  if(token&&window.__showLineToken&&token!==window.__showLineToken)return;
  const estimates=routeCollectCurrentEstimateDps();
  if(!estimates.length)return;
  routeAutoAlignRunning=true;
  routeAutoAlignSetStatus('Auto align on load: starting',0,`${estimates.length.toLocaleString()} estimate${estimates.length===1?'':'s'} loaded | targeted public pole/tower nodes first, then power-line vertices`);
  try{
    const res=await routeAutoAlignEstimateSet(estimates,{visibleOnly:false,chunked:true,token,label:'Auto align on load',allowFallbackFeatures:false,padMeters:900});
    if(res.cancelled)return;
    routeAutoAlignMarkDone(estimates,label,res);
    if(res.moved){
      routeAutoAlignFinishStatus(`Auto aligned on load: ${res.moved} / ${res.checked} estimates moved`,`${res.powerMoved} powerline | ${res.otherMoved} other | saved locally | live route line redrawn`);
      try{routeRedrawReviewLinesFromGroups();applyMapToggleSettings?.();}catch(e){}
    }else{
      const fail=res.failedChunks?` | ${res.failedChunks} lookup section${res.failedChunks===1?'':'s'} failed`:'';
      const noFeat=res.noFeatureChunks?` | ${res.noFeatureChunks} section${res.noFeatureChunks===1?'':'s'} had no public feature data`:'';
      routeAutoAlignFinishStatus(`Auto align on load checked ${res.checked} estimates`,`${res.featureCount} public features found | 0 moved | not saved, will retry next load${fail}${noFeat}`);
    }
  }finally{routeAutoAlignRunning=false;}
}


function routeVirtualEstimateRecord(route,plate,sourceNote){
  const p=Number(plate);
  const label=Number.isFinite(p)?String(p):'missing';
  return {
    __kind:'estimated_missing',
    __title:'Estimated missing '+label,
    __pole:'Estimated missing '+label,
    __line:route||'',
    __isVirtualEstimate:true,
    __sourceNote:sourceNote||'No matching source record found in imported data.'
  };
}
function routeEstimateDistance(a,b){
  try{return routeMeters(a,b)}catch(e){return (typeof distanceMeters==='function'?distanceMeters(a.lat,a.lng,b.lat,b.lng):Infinity)}
}
function routeEstimateStats(gps){
  const steps=[];
  const ordered=(gps||[])
    .filter(x=>x&&Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng))&&Number.isFinite(Number(x.plate)))
    .sort((a,b)=>Number(a.plate)-Number(b.plate)||a.sourceOrder-b.sourceOrder);
  for(let i=0;i<ordered.length-1;i++){
    const a=ordered[i],b=ordered[i+1];
    const gap=Math.abs(Number(b.plate)-Number(a.plate));
    if(gap<1||gap>6)continue;
    const d=routeEstimateDistance(a,b);
    if(!Number.isFinite(d)||d<5)continue;
    const step=d/gap;
    if(step>=10&&step<=900)steps.push(step);
  }
  steps.sort((a,b)=>a-b);
  const median=steps.length?steps[Math.floor(steps.length*.5)]:180;
  const p85=steps.length?steps[Math.floor(steps.length*.85)]:median;
  return {
    median,
    p85,
    maxPairDistance:Math.max(2500,Math.min(22000,Math.max(p85*18,median*24))),
    maxStep:Math.max(650,Math.min(1800,Math.max(p85*5.2,median*6)))
  };
}
function routeGapEstimateLooksSafe(a,b,gap,stats){
  if(!a||!b||!Number.isFinite(gap)||gap<=1)return false;
  const d=routeEstimateDistance(a,b);
  if(!Number.isFinite(d)||d<5)return false;
  const step=d/gap;
  // v3.6.85: allow rural/longer missing-number gaps when sequence spacing is still believable.
  // This prevents the visible route from breaking just because source GPS is sparse.
  if(d>Math.max(26000,stats.maxPairDistance))return false;
  if(step<8||step>stats.maxStep)return false;
  const sourceDelta=Math.abs((b.sourceOrder??0)-(a.sourceOrder??0));
  if(sourceDelta>0 && sourceDelta<gap*.12)return false;
  if(gap>260)return false;
  return true;
}
function routeAddMissingNumberEstimates(out,sorted){
  const existingPlates=new Set();
  (sorted||[]).forEach(item=>{
    if(item&&item.plate!==null&&item.plate!==undefined&&Number.isFinite(Number(item.plate)))existingPlates.add(Number(item.plate));
  });
  (out||[]).forEach(item=>{
    if(item&&item.plate!==null&&item.plate!==undefined&&Number.isFinite(Number(item.plate)))existingPlates.add(Number(item.plate));
  });
  const gps=(sorted||[])
    .filter(item=>item&&item.hasGPS&&Number.isFinite(Number(item.lat))&&Number.isFinite(Number(item.lng))&&Number.isFinite(Number(item.plate)))
    .sort((a,b)=>Number(a.plate)-Number(b.plate)||a.sourceOrder-b.sourceOrder);
  const stats=routeEstimateStats(gps);
  const added=[];
  let skipped=0;
  for(let i=0;i<gps.length-1;i++){
    const a=gps[i], b=gps[i+1];
    const pa=Number(a.plate), pb=Number(b.plate);
    if(!Number.isFinite(pa)||!Number.isFinite(pb))continue;
    const gap=pb-pa;
    if(gap<=1)continue;
    if(!routeGapEstimateLooksSafe(a,b,gap,stats)){skipped+=Math.max(0,gap-1);continue;}
    const route=getLine(a.r)||getLine(b.r)||'';
    for(let p=pa+1;p<pb;p++){
      if(existingPlates.has(p))continue;
      const t=(p-pa)/gap;
      const est=interpolateRoutePoint(a,b,t);
      if(!est||!Number.isFinite(est.lat)||!Number.isFinite(est.lng))continue;
      const r=routeVirtualEstimateRecord(route,p,`Number ${p} was safely inferred between ${getStructure(a.r)||pa} and ${getStructure(b.r)||pb}. It is not a source record.`);
      const dp={
        r,
        sourceOrder:a.sourceOrder+((b.sourceOrder-a.sourceOrder)*t),
        recIndex:-1,
        plate:p,
        hasGPS:false,
        lat:est.lat,
        lng:est.lng,
        estimated:true,
        virtual:true,
        gapEstimate:true
      };
      added.push(dp);
      existingPlates.add(p);
    }
  }
  if(skipped)window.__lastRouteGapEstimatesSkipped=skipped;
  return added.length?out.concat(added).sort((a,b)=>routeDisplayOrderValue(a)-routeDisplayOrderValue(b)||a.sourceOrder-b.sourceOrder):out;
}
function routeDisplayPointList(records){
  const raw=routeRecordsOnly(records); // route view must not include substations/sites/depots; they distort the line
  const items=raw.map((r,sourceOrder)=>{
    const gps=hasGPS(r);
    const lat=gps?getLat(r):null, lng=gps?getLng(r):null;
    return {r,sourceOrder,recIndex:(typeof recordIndexOf==='function'?recordIndexOf(r):((r&&r.__idx!==undefined)?r.__idx:(allRecords||[]).indexOf(r))),plate:finitePlateNo(r),hasGPS:gps,lat,lng,estimated:false};
  });
  const sorted=items.slice().sort((a,b)=>routeDisplayOrderValue(a)-routeDisplayOrderValue(b)||a.sourceOrder-b.sourceOrder);
  let out=[];
  for(let pos=0;pos<sorted.length;pos++){
    const item=sorted[pos];
    if(item.hasGPS&&Number.isFinite(item.lat)&&Number.isFinite(item.lng)){
      out.push(item);
      continue;
    }
    const est=estimateRoutePoint(sorted,item,pos);
    if(est&&Number.isFinite(est.lat)&&Number.isFinite(est.lng)){
      out.push({...item,lat:est.lat,lng:est.lng,estimated:true,hasGPS:false});
    }else{
      out.push(item);
    }
  }
  out=routeAddMissingNumberEstimates(out,sorted);
  out=out.map(routeEstimateApplyCorrection).filter(Boolean);
  return out;
}
function routeDisplayHasCoord(dp){return dp&&Number.isFinite(Number(dp.lat))&&Number.isFinite(Number(dp.lng));}
function routeDisplayMarkerClass(dp){
  if(dp&&dp.gapEstimate)return 'asset-gap-estimate-dot';
  if(dp&&dp.estimated)return 'asset-estimated-dot';
  const r=dp&&dp.r;
  const cat=(typeof assetCategory==='function')?assetCategory(r):'';
  return cat==='tower'?'tower-dot':cat==='substation'?'sub-dot':cat==='depot'?'depot-dot':cat==='pole'?'pole-dot':'asset-dot';
}
function routeDisplayMarkerStyle(dp){
  const cls=routeDisplayMarkerClass(dp);
  // v3.7.1: keep estimates visible without massive rings. The tap target is handled separately.
  if(dp&&dp.gapEstimate)return {radius:8.6,weight:2.2,opacity:1,fillOpacity:.98,color:'#fff8e8',fillColor:'#ff9f1a',className:cls};
  if(dp&&dp.estimated)return {radius:9.0,weight:2.3,opacity:1,fillOpacity:.98,color:'#fff8e8',fillColor:'#ffd34d',className:cls};
  return {radius:5.2,weight:1.8,fillOpacity:.92,className:cls};
}
function routeEstimateIsTrustedForLine(dp){
  // v3.7.1: blue route lines are reliable geometry only.
  // Raw estimates and auto-align guesses stay as warning dots; they cannot drag the route path.
  // Manual moves are trusted because the user deliberately corrected the point.
  return !!(dp && (!dp.estimated || (dp.corrected && !dp.autoAligned)));
}
function routeDisplayTooltip(dp){
  const r=dp&&dp.r||{};
  const route=getLine(r)||getSubstationName(r)||getDepotName(r)||'';
  if(dp&&dp.gapEstimate)return `${route?route+' | ':''}${getStructure(r)} | estimated missing number - not in source data`;
  return `${route?route+' | ':''}${getStructure(r)}${dp&&dp.estimated?' | estimated - no GPS in file':''}`;
}
function routeCreateEstimateHitTarget(marker,dp){
  // v3.6.90: keep the visible yellow/orange estimate dots small, but give them a large invisible tap target.
  try{
    if(!dp||!dp.estimated||!assetLayer||!routeDisplayHasCoord(dp)||typeof L==='undefined')return null;
    const key=routeEstimateKey(dp);
    if(!key)return null;
    const old=routeEstimateHitTargetByKey&&routeEstimateHitTargetByKey.get?routeEstimateHitTargetByKey.get(key):null;
    if(old&&assetLayer&&assetLayer.hasLayer&&assetLayer.hasLayer(old))assetLayer.removeLayer(old);
    const isGap=!!dp.gapEstimate;
    const radius=isGap?21:20;
    const hit=L.circleMarker([Number(dp.lat),Number(dp.lng)],{
      radius,
      weight:0,
      opacity:0,
      fillOpacity:0,
      color:isGap?'#ff9f1a':'#ffd34d',
      fillColor:isGap?'#ff9f1a':'#ffd34d',
      interactive:true,
      className:'asset-estimate-hit-target '+(isGap?'gap-estimate-hit':'nogps-estimate-hit')
    }).addTo(assetLayer);
    hit._tlRole='estimateHit';
    hit._tlEstimateType=dp.gapEstimate?'gap':'estimate';
    hit._tlKind=marker?marker._tlKind:(dp.r?(dp.r.__kind||getType(dp.r)||''):'');
    hit._routeEstimateKey=key;
    hit._linkedEstimateMarker=marker||null;
    if(marker)marker._routeEstimateHitLayer=hit;
    routeEstimateHitTargetByKey.set(key,hit);
    // v3.7.4: no tooltip strip on estimate tap targets.
    hit.on('click',ev=>{
      try{if(ev&&ev.originalEvent)L.DomEvent.stop(ev.originalEvent);}catch(e){}
      const index=Number.isInteger(dp.recIndex)?dp.recIndex:(typeof recordIndexOf==='function'?recordIndexOf(dp.r):(allRecords||[]).indexOf(dp.r));
      try{if(marker&&marker.closeTooltip)marker.closeTooltip();}catch(e){}
      closePointInfoWindows();
      selected=index>=0?allRecords[index]:dp.r;
      selectedMarker=marker||hit;
      routeEstimateSetSelected(key,marker||hit,dp);
      try{
        if(marker&&marker.openPopup)marker.openPopup();
        else{
          hit.bindPopup(routeAssetPopupHTML(index,dp.lat,dp.lng,true,dp),{className:'asset-mini-popup',closeButton:true,autoPan:true,keepInView:true});
          hit.openPopup();
        }
      }catch(e){}
      // v3.7.4: no selection toast.
    });
    return hit;
  }catch(e){return null;}
}
function routeAssetPopupHTML(index,lat,lng,estimated,dp){
  const r=(dp&&dp.r)||(index>=0?allRecords[index]:{})||{};
  const title=getStructure(r)||'Selected point';
  const route=getLine(r)||getSubstationName(r)||getDepotName(r)||'';
  const nav=Number.isFinite(Number(lat))&&Number.isFinite(Number(lng));
  const virtual=!!(dp&&dp.virtual)||!!r.__isVirtualEstimate;
  const note=virtual?'<span class="estimated-pop-note">Estimated missing number only - no source record exists in the imported data.</span>':(estimated?'<span class="estimated-pop-note">Estimated position only - source record has no GPS</span>':'');
  const view=virtual?'<button class="asset-popup-view" disabled>Not in source</button>':`<button class="asset-popup-view" onclick="event.stopPropagation();assetViewMore(${index})">View more</button>`;
  const estimateButtons=routeEstimatePopupButtons(dp);
  const correctionNote=(dp&&dp.corrected&&!dp.autoAligned)?'<span class="estimated-pop-note corrected">Manually corrected locally - trusted for blue line</span>':((dp&&dp.autoAligned)?'<span class="estimated-pop-note">Auto-aligned warning dot - not trusted for blue line</span>':'');
  return `<div class="asset-mini-pop single-point-pop"><b>${esc(title)}</b>${route?`<span>${esc(route)}</span>`:''}${note}${correctionNote}<div class="asset-popup-actions">${view}<button class="asset-popup-nav" onclick="event.stopPropagation();openMapsForRoutePoint(${Number(lat)},${Number(lng)})" ${nav?'':'disabled'}>${estimated?'Open estimate':'Google Maps'}</button>${estimateButtons}</div></div>`;
}
function bindRouteDisplayPopup(marker,dp){
  try{
    const index=Number.isInteger(dp.recIndex)?dp.recIndex:(typeof recordIndexOf==='function'?recordIndexOf(dp.r):(allRecords||[]).indexOf(dp.r));
    if(marker.unbindTooltip)marker.unbindTooltip();
    marker.bindPopup(routeAssetPopupHTML(index,dp.lat,dp.lng,!!dp.estimated,dp),{className:'asset-mini-popup',closeButton:true,autoPan:true,keepInView:true});
    marker._assetRecordIndex=index;
    if(dp&&dp.estimated){
      const eKey=routeEstimateKey(dp);
      marker._tlEstimateType=dp.gapEstimate?'gap':'estimate';
      marker._routeEstimateKey=eKey;
      routeEstimateMarkerByKey.set(eKey,marker);
      routeCreateEstimateHitTarget(marker,dp);
      try{if(marker.bringToFront)marker.bringToFront();}catch(e){}
    }else{
      marker._tlEstimateType='trueGps';
    }
    marker.on('click',()=>{try{if(marker.closeTooltip)marker.closeTooltip();}catch(e){}closePointInfoWindows();selected=index>=0?allRecords[index]:dp.r;selectedMarker=marker;if(dp&&dp.estimated)routeEstimateSetSelected(routeEstimateKey(dp),marker,dp)});
  }catch(e){}
}
function openMapsForRoutePoint(lat,lng){
  lat=Number(lat);lng=Number(lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)){alert('No map position available.');return;}
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,'_blank');
}
function routeEdgeKey(a,b){return a<b?`${a}-${b}`:`${b}-${a}`}
function routeInsertNearest(list,edge,limit){
  let at=list.findIndex(x=>edge.d<x.d);
  if(at<0)list.push(edge); else list.splice(at,0,edge);
  if(list.length>limit)list.length=limit;
}
function routeAdaptiveLimit(nearest){
  const ds=(nearest||[]).filter(d=>Number.isFinite(d)&&d>5).sort((a,b)=>a-b);
  if(!ds.length)return 2500;
  const median=ds[Math.floor(ds.length*.5)]||500;
  const p85=ds[Math.floor(ds.length*.85)]||median;
  const p95=ds[Math.floor(ds.length*.95)]||p85;
  return Math.max(900,Math.min(18000,Math.max(median*5.5,p85*3,p95*1.6)));
}
function routeBuildNearestGraph(points){
  const n=points.length;
  const adj=Array.from({length:n},()=>[]);
  if(n<2)return {adj,limit:0,edges:[]};
  if(n>1800){
    const ordered=[...points].map((p,i)=>({p,i})).sort((a,b)=>(a.p.plate-b.p.plate)||a.p.title.localeCompare(b.p.title)||a.p.sourceOrder-b.p.sourceOrder);
    for(let i=1;i<ordered.length;i++){
      const a=ordered[i-1].i,b=ordered[i].i,d=routeMeters(points[a],points[b]);
      if(Number.isFinite(d)&&d<25000){adj[a].push({i:b,d});adj[b].push({i:a,d});}
    }
    return {adj,limit:25000,edges:[]};
  }
  const k=n>700?5:7;
  const nearest=Array(n).fill(Infinity);
  const rows=Array.from({length:n},()=>[]);
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      const d=routeMeters(points[i],points[j]);
      if(!Number.isFinite(d)||d<=0)continue;
      if(d<nearest[i])nearest[i]=d;
      if(d<nearest[j])nearest[j]=d;
      routeInsertNearest(rows[i],{a:i,b:j,d},k);
      routeInsertNearest(rows[j],{a:j,b:i,d},k);
    }
  }
  const limit=routeAdaptiveLimit(nearest);
  const edgeMap=new Map();
  rows.forEach((list,i)=>list.forEach(e=>{
    const a=Math.min(e.a,e.b),b=Math.max(e.a,e.b),pa=points[a].plate,pb=points[b].plate;
    const plateGap=(pa!==999999&&pb!==999999)?Math.abs(pa-pb):999999;
    const allowed=e.d<=limit || (plateGap>0&&plateGap<=10&&e.d<=limit*1.7);
    if(!allowed)return;
    const key=routeEdgeKey(a,b);
    const old=edgeMap.get(key);
    if(!old||e.d<old.d)edgeMap.set(key,{a,b,d:e.d});
  }));
  let edges=[...edgeMap.values()].sort((a,b)=>a.d-b.d);
  if(!edges.length){
    rows.forEach(list=>list.slice(0,1).forEach(e=>{
      const a=Math.min(e.a,e.b),b=Math.max(e.a,e.b),key=routeEdgeKey(a,b);
      if(!edgeMap.has(key))edgeMap.set(key,{a,b,d:e.d});
    }));
    edges=[...edgeMap.values()].sort((a,b)=>a.d-b.d);
  }
  const parent=Array.from({length:n},(_,i)=>i),rank=Array(n).fill(0);
  const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x};
  const union=(a,b)=>{a=find(a);b=find(b);if(a===b)return false;if(rank[a]<rank[b])[a,b]=[b,a];parent[b]=a;if(rank[a]===rank[b])rank[a]++;return true};
  edges.forEach(e=>{if(union(e.a,e.b)){adj[e.a].push({i:e.b,d:e.d});adj[e.b].push({i:e.a,d:e.d});}});
  return {adj,limit,edges};
}
function routeComponents(adj){
  const seen=new Set(), comps=[];
  for(let i=0;i<adj.length;i++){
    if(seen.has(i)||!adj[i].length)continue;
    const stack=[i],nodes=[];seen.add(i);
    while(stack.length){
      const cur=stack.pop();nodes.push(cur);
      adj[cur].forEach(e=>{if(!seen.has(e.i)){seen.add(e.i);stack.push(e.i);}});
    }
    if(nodes.length>1)comps.push(nodes);
  }
  return comps;
}
function routeFarthest(start,allowed,adj){
  const dist=new Map([[start,0]]),parent=new Map([[start,null]]),stack=[start];
  while(stack.length){
    const cur=stack.pop();
    adj[cur].forEach(e=>{
      if(!allowed.has(e.i)||parent.has(e.i))return;
      parent.set(e.i,cur);
      dist.set(e.i,(dist.get(cur)||0)+e.d);
      stack.push(e.i);
    });
  }
  let far=start,best=-1;
  dist.forEach((d,i)=>{if(d>best){best=d;far=i;}});
  return {far,dist:best,parent};
}
function routeTreeDiameter(nodes,adj){
  const allowed=new Set(nodes);
  const a=routeFarthest(nodes[0],allowed,adj).far;
  const b=routeFarthest(a,allowed,adj);
  const path=[];let cur=b.far;
  while(cur!==null&&cur!==undefined){path.push(cur);if(cur===a)break;cur=b.parent.get(cur);}
  return {path,pathLen:b.dist||0};
}
function routeUnusedDegree(node,adj,used){return adj[node].filter(e=>!used.has(routeEdgeKey(node,e.i))).length}
function routeExtractBranchChains(nodes,adj,used){
  const chains=[],visited=new Set(),nodeSet=new Set(nodes);
  const starts=nodes.filter(n=>routeUnusedDegree(n,adj,used)!==2);
  const startList=starts.length?starts:nodes;
  startList.forEach(start=>{
    adj[start].forEach(first=>{
      const firstKey=routeEdgeKey(start,first.i);
      if(used.has(firstKey)||visited.has(firstKey)||!nodeSet.has(first.i))return;
      const chain=[start];
      let prev=start,cur=first.i;
      visited.add(firstKey);
      while(true){
        chain.push(cur);
        const next=adj[cur].filter(e=>e.i!==prev&&!used.has(routeEdgeKey(cur,e.i))&&!visited.has(routeEdgeKey(cur,e.i))&&nodeSet.has(e.i));
        if(next.length!==1)break;
        const e=next[0];
        visited.add(routeEdgeKey(cur,e.i));
        prev=cur;cur=e.i;
      }
      if(chain.length>1)chains.push(chain);
    });
  });
  return chains;
}
function routePathLength(path,points){
  let total=0;
  for(let i=1;i<path.length;i++)total+=routeMeters(points[path[i-1]],points[path[i]]);
  return total;
}
let routeSegmentCache=new Map();
function routeSegmentCacheKey(records,maxSegments){
  try{
    const gps=(records||[]).filter(hasGPS);
    if(!gps.length)return '';
    const first=gps[0], last=gps[gps.length-1];
    return [maxSegments,gps.length,compactSearch(getLine(first)||''),compactSearch(getLine(last)||''),getStructure(first),getStructure(last),Number(getLat(first)).toFixed(5),Number(getLng(first)).toFixed(5),Number(getLat(last)).toFixed(5),Number(getLng(last)).toFixed(5)].join('|');
  }catch(e){return '';}
}
function clearRouteSegmentCache(){try{routeSegmentCache.clear();}catch(e){}}
function buildRouteSegments(records,maxSegments=4){
  const ck=routeSegmentCacheKey(records,maxSegments);
  if(ck && routeSegmentCache.has(ck))return routeSegmentCache.get(ck);
  const points=routePointList(records);
  if(points.length<2)return {points,segments:[],limit:0};
  const built=routeBuildNearestGraph(points);
  const comps=routeComponents(built.adj);
  const used=new Set();
  const paths=[];
  comps.forEach(nodes=>{
    const main=routeTreeDiameter(nodes,built.adj);
    if(main.path.length>1){
      for(let i=1;i<main.path.length;i++)used.add(routeEdgeKey(main.path[i-1],main.path[i]));
      paths.push({idxs:main.path,len:main.pathLen,main:true});
    }
  });
  comps.forEach(nodes=>{
    routeExtractBranchChains(nodes,built.adj,used).forEach(path=>paths.push({idxs:path,len:routePathLength(path,points),main:false}));
  });
  const segments=paths
    .filter(x=>x.idxs.length>1&&x.len>20)
    .sort((a,b)=>(b.main===a.main?0:(b.main?1:-1))||b.len-a.len)
    .slice(0,maxSegments)
    .map(x=>x.idxs.map(i=>points[i]));
  const result={points,segments,limit:built.limit};
  if(ck){
    if(routeSegmentCache.size>80)routeSegmentCache.clear();
    routeSegmentCache.set(ck,result);
  }
  return result;
}
function drawCleanRouteSegments(records,layer,opts={}){
  const built=buildRouteSegments(records,opts.maxSegments||4);
  const colour=opts.color||'#2f80ed';
  built.segments.forEach(seg=>{
    const pts=seg.map(p=>[p.lat,p.lng]);
    const lineObj=L.polyline(pts,{color:colour,weight:opts.weight||4,opacity:opts.opacity??.75,fill:false,lineCap:'round',lineJoin:'round',smoothFactor:.6,noClip:false,className:opts.className||'route-clean-line'}).addTo(layer);
    registerMapToggleLayer(lineObj,null,'line');
    if(opts.tooltip)lineObj.bindTooltip(opts.tooltip);
  });
  return built;
}
function showRoutesOnMap(routes){
  setActive?.('tabMap');
  document.body.classList.remove('asset-index-open');
  forceMapAssetsVisibleForRoute?.();
  const names=(routes||[]).filter(Boolean);
  if(!names.length)return;
  assetLayer.clearLayers(); selectedMarker=null; selected=null; window.__lastRouteGapBridges=0; routeClearReviewLines?.(); routeLastDisplayGroups=[]; routeLastMultiNames=names.slice(); routeLastSingleRows=null; routeLastSingleName=''; routeEstimateMarkerByKey.clear(); routeEstimateHitTargetByKey.clear(); routeEstimateSelectedKey=null; routeEstimateSelectedMarker=null; routeEstimateSelectedDP=null;
  window.__showLineToken=Date.now()+Math.random();
  const token=window.__showLineToken;
  const allPoints=[], bounds=[];
  let drawn=0, totalRecords=0, gpsRecords=0, estimatedRecords=0, gapEstimateRecords=0, noMapRecords=0;
  for(const name of names){
    const hits=routeRecordsOnly(routeHitsFromCache(name));
    totalRecords+=hits.length;
    const gps=hits.filter(hasGPS).sort((a,b)=>plateNo(a)-plateNo(b));
    gpsRecords+=gps.length;
    const dps=routeDisplayPointList(hits);
    const mapDps=dps; // v3.7.1: always create estimate dots; layer toggles hide/show them without affecting the blue line
    if(mapDps.filter(routeDisplayHasCoord).length>=2){
      drawn++;
      routeStoreDisplayGroup(name,mapDps);
      routeDrawEstimateAwareLine(mapDps,assetLayer,{tooltip:`${name} | reliable route path`});
    }
    for(const dp of mapDps){
      if(routeDisplayHasCoord(dp)){
        allPoints.push(dp); bounds.push([dp.lat,dp.lng]);
        if(dp.gapEstimate)gapEstimateRecords++;
        else if(dp.estimated)estimatedRecords++;
      }else noMapRecords++;
    }
  }
  const seen=new Set(), dotPoints=[];
  for(const dp of allPoints){
    const idx=Number.isInteger(dp.recIndex)?dp.recIndex:(typeof recordIndexOf==='function'?recordIndexOf(dp.r):(allRecords||[]).indexOf(dp.r));
    const key=(idx>=0?idx:'')+'|'+Number(dp.lat).toFixed(6)+'|'+Number(dp.lng).toFixed(6)+'|'+(dp.estimated?'E':'G');
    if(seen.has(key))continue;
    seen.add(key); dotPoints.push({...dp,recIndex:idx});
  }
  visibleRecords=names.flatMap(name=>routeRecordsOnly(routeHitsFromCache(name))); updateKPIs?.();
  let n=0;
  function addRouteDots(){
    if(window.__showLineToken!==token || !assetLayer)return;
    const end=Math.min(n+performanceBatch(65),dotPoints.length);
    for(;n<end;n++){
      const dp=dotPoints[n];
      const m=registerMapToggleLayer(L.circleMarker([dp.lat,dp.lng],routeDisplayMarkerStyle(dp)).addTo(assetLayer),dp.r,'dot');
      m._tlEstimateType=dp.gapEstimate?'gap':(dp.estimated?'estimate':'trueGps');
      if(!dp.estimated){try{m.bindTooltip(routeDisplayTooltip(dp));}catch(e){}}
      bindRouteDisplayPopup(m,dp);
    }
    applyMapToggleSettings?.();
    if(n<dotPoints.length){showToolStatus(`Loading selected routes... ${n.toLocaleString()} / ${dotPoints.length.toLocaleString()} dots`);setTimeout(addRouteDots,0);}
    else {
      refreshMapTilesSoft?.();
      showToolStatus(`Selected routes loaded: ${drawn} route${drawn===1?'':'s'} | ${dotPoints.length.toLocaleString()} map dots shown | ${estimatedRecords.toLocaleString()} no-GPS estimated | ${gapEstimateRecords.toLocaleString()} inferred missing-number estimates | ${noMapRecords.toLocaleString()} still no position`);
      routeScheduleAutoAlignOnLoad?.(token,'selected routes');
    }
  }
  if(bounds.length===1)map.setView(bounds[0],17); else if(bounds.length>1)map.fitBounds(L.latLngBounds(bounds),{padding:[45,45],maxZoom:16});
  setTimeout(()=>{refreshMapTilesSoft?.(); addRouteDots();},180);
  showToolStatus(`Loading ${drawn||names.length} selected route${names.length===1?'':'s'} | ${dotPoints.length.toLocaleString()} dots`);
}
function showLineOnMap(records,line){
  setActive?.('tabMap');
  document.body.classList.remove('asset-index-open');
  forceMapAssetsVisibleForRoute?.();
  assetLayer.clearLayers();selectedMarker=null;selected=null;window.__lastRouteGapBridges=0;routeClearReviewLines?.();routeLastDisplayGroups=[];routeLastMultiNames=null;routeLastSingleRows=(records||[]).slice();routeLastSingleName=String(line||'');routeEstimateMarkerByKey.clear();routeEstimateHitTargetByKey.clear();routeEstimateSelectedKey=null;routeEstimateSelectedMarker=null;routeEstimateSelectedDP=null;
  const routeRows=routeRecordsOnly(records);
  const gps=routeRows.filter(hasGPS).sort((a,b)=>plateNo(a)-plateNo(b));
  if(!routeRows.length){showToolStatus('No records for route '+line);return;}
  const rawDotPoints=routeDisplayPointList(routeRows);
  const mapDotPoints=rawDotPoints; // v3.7.1: always create estimate dots; layer toggles hide/show them without affecting the blue line
  const dotPoints=mapDotPoints.filter(routeDisplayHasCoord);
  routeStoreDisplayGroup(line,mapDotPoints);
  const built={points:dotPoints,segments:routeDrawEstimateAwareLine(mapDotPoints,assetLayer,{tooltip:`${line} | reliable route path`})};
  const estimatedCount=dotPoints.filter(x=>x.estimated&&!x.gapEstimate).length;
  const gapEstimateCount=dotPoints.filter(x=>x.gapEstimate).length;
  const noMapCount=Math.max(0,routeRows.length-dotPoints.filter(x=>!x.gapEstimate).length);
  let n=0;
  const token=Date.now()+Math.random();
  window.__showLineToken=token;
  visibleRecords=routeRows; updateKPIs?.();
  function addRouteDots(){
    if(window.__showLineToken!==token || !assetLayer)return;
    const end=Math.min(n+performanceBatch(55),dotPoints.length);
    for(;n<end;n++){
      const dp=dotPoints[n];
      const idx=Number.isInteger(dp.recIndex)?dp.recIndex:(typeof recordIndexOf==='function'?recordIndexOf(dp.r):((dp.r&&dp.r.__idx!==undefined)?dp.r.__idx:(allRecords||[]).indexOf(dp.r)));
      dp.recIndex=idx;
      const m=registerMapToggleLayer(L.circleMarker([dp.lat,dp.lng],routeDisplayMarkerStyle(dp)).addTo(assetLayer),dp.r,'dot');
      m._tlEstimateType=dp.gapEstimate?'gap':(dp.estimated?'estimate':'trueGps');
      if(!dp.estimated){try{m.bindTooltip(routeDisplayTooltip(dp));}catch(e){}}
      bindRouteDisplayPopup(m,dp);
    }
    applyMapToggleSettings?.();
    if(n<dotPoints.length){
      showToolStatus('Loading route '+line+'... '+n.toLocaleString()+' / '+dotPoints.length.toLocaleString()+' dots');
      setTimeout(addRouteDots,0);
    }else{
      refreshMapTilesSoft?.();
      const segText=(built.segments&&built.segments.length)?` | ${built.segments.length} path segment${built.segments.length===1?'':'s'}`:' | dots only';
      const bridgeText=window.__lastRouteGapBridges?` | ${window.__lastRouteGapBridges} bridged line gap${window.__lastRouteGapBridges===1?'':'s'}`:'';
      showToolStatus('Route loaded '+line+' | '+dotPoints.length.toLocaleString()+' map dots | '+routeRows.length.toLocaleString()+' source records | '+estimatedCount.toLocaleString()+' no-GPS estimated | '+gapEstimateCount.toLocaleString()+' inferred missing-number estimates | '+noMapCount.toLocaleString()+' still no position'+segText+bridgeText);
      routeScheduleAutoAlignOnLoad?.(token,line);
    }
  }
  const bounds=dotPoints.map(dp=>[dp.lat,dp.lng]);
  if(bounds.length===1)map.setView(bounds[0],17); else if(bounds.length>1)map.fitBounds(L.latLngBounds(bounds),{padding:[45,45],maxZoom:16});
  else showToolStatus('No GPS or estimatable position for route '+line);
  setTimeout(()=>{refreshMapTilesSoft?.(); addRouteDots();},180);
  showToolStatus('Loading route '+line+'... 0 / '+dotPoints.length.toLocaleString()+' dots');
}
function selectLine(line){const hits=routeRecordsOnly(routeHitsFromCache(line));visibleRecords=hits;updateKPIs();closeAssetIndex?.();setActive?.('tabMap');showLineOnMap(hits,line);const box=document.getElementById('resultsBox');if(box)box.innerHTML=`<div class="result selected-line-card"><div class="rtitle">${esc(line)}</div><div class="rsub">${hits.length} line assets | ${hits.filter(hasGPS).length} true GPS | ${hits.length-hits.filter(hasGPS).length} no GPS included / estimated where possible</div><span class="tag green">Route shown on map</span><span class="tag clay">Sites/substations excluded from line geometry</span></div>`}
function selectAsset(i,allowEstimate=false){i=Number(i);if(!Number.isInteger(i)||i<0||i>=allRecords.length)return;searchDetailOpen=true;selected=allRecords[i];closeAssetIndex?.();setActive?.('tabMap');closePointInfoWindows();assetLayer.clearLayers();selectedMarker=null;if(selected&&hasGPS(selected)){selectedMarker=registerMapToggleLayer(L.marker([getLat(selected),getLng(selected)],{icon:L.divIcon({className:'asset-marker'})}).addTo(assetLayer),selected,'selected');selectedMarker.bindTooltip(getStructure(selected));bindAssetMiniPopup(selectedMarker,i);map.setView([getLat(selected),getLng(selected)],17);selectedMarker.openPopup()}else if(allowEstimate){const dp=estimateForRecordByIndex(i);if(dp&&routeDisplayHasCoord(dp)){selectedMarker=registerMapToggleLayer(L.circleMarker([dp.lat,dp.lng],routeDisplayMarkerStyle(dp)).addTo(assetLayer),selected,'selected');selectedMarker._tlEstimateType='estimate';bindRouteDisplayPopup(selectedMarker,dp);routeCreateEstimateHitTarget(selectedMarker,dp);map.setView([dp.lat,dp.lng],18);selectedMarker.openPopup();showToolStatus('Estimated position only - source record has no GPS. Estimate dot has enlarged invisible tap target. Verify against map layers.')}else{showToolStatus('No GPS in source record and no safe estimate could be calculated.')}}else{showToolStatus('No GPS available for this point. Use Show estimate if available.')}applyDisplaySettings?.();applyMapToggleSettings?.()}
function renderAsset(r,i=(typeof recordIndexOf==='function'?recordIndexOf(r):allRecords.indexOf(r))){searchBodyEl().innerHTML=`<div class="card"><div class="asset-card-top"><button class="green" onclick="openAssetViewPage(${i})">View more</button><button class="secondary" onclick="openAssetIndex()">Back</button></div><span class="tag clay">${esc(genericKindLabel(getType(r)))}</span><span class="tag ${hasGPS(r)?'green':'red'}">${hasGPS(r)?'GPS available':'No GPS'}</span>${assetInfoHTML(r)}<div class="actions"><button class="clay" onclick="zoomSelected()">Zoom</button><button class="green" onclick="openMapsSelected()">Google Maps</button><button class="secondary" onclick="copyAsset()">Copy</button></div></div>`}
function assetInfoHTML(r){const gps=hasGPS(r)?`${getLat(r).toFixed(6)}, ${getLng(r).toFixed(6)}`:'No GPS';let rows=[['Title',getStructure(r)],['Route',getLine(r)],['All routes',lineCandidates(r).join(' | ')],['Detail',resolveConductor(r)],['Site',getSubstationName(r)],['Base',getDepotName(r)],['Type',genericKindLabel(getType(r))],['Material',getMaterial(r)],['Structure detail',val(r,['STRUC_TYP_DESC','SUB_STRUC_DESC','STRUC_CAT_DESC'])],['Height / length',val(r,['POLE_HEIGHT_M','POLE_LEN_M','TOWER_HEIGHT'])],['Drawing',getDrawing(r)],['GPS',gps],['Easting/Northing',[val(r,['EASTING','EASTING_COORD','__easting']),val(r,['NORTHING','NORTHING_COORD','__northing'])].filter(Boolean).join(', ')],['Zone',val(r,['ZONE_','ZONE','__zone'])]];return rows.map(([k,v])=>field(k,v)).join('')}
function assetPopupHTML(index){const r=allRecords[index]||{};const title=getStructure(r)||'Selected point';const route=getLine(r)||getSubstationName(r)||getDepotName(r)||'';return `<div class="asset-mini-pop single-point-pop"><b>${esc(title)}</b>${route?`<span>${esc(route)}</span>`:''}<div class="asset-popup-actions"><button class="asset-popup-view" onclick="event.stopPropagation();assetViewMore(${index})">View more</button><button class="asset-popup-nav" onclick="event.stopPropagation();openMapsForAsset(${index})">Google Maps</button></div></div>`}
function bindAssetMiniPopup(marker,index){try{if(marker.unbindTooltip)marker.unbindTooltip();marker.bindPopup(assetPopupHTML(index),{className:'asset-mini-popup',closeButton:true,autoPan:true,keepInView:true});marker._assetRecordIndex=index;marker.on('click',()=>{try{if(marker.closeTooltip)marker.closeTooltip();}catch(e){}closePointInfoWindows();selected=allRecords[index];selectedMarker=marker})}catch(e){}}
function closePointInfoWindows(){try{if(typeof closeDrawer==='function')closeDrawer();if(typeof closePlus==='function')closePlus();if(typeof closeSettings==='function')closeSettings();if(typeof closePOI==='function')closePOI();if(typeof closeAssetIndex==='function')closeAssetIndex();document.getElementById('assetViewPage')?.classList.remove('show');document.getElementById('assetEditorPage')?.classList.remove('open');document.getElementById('dataCorrectionsPage')?.classList.remove('open');document.body.classList.remove('drawer-open','settings-open','poi-open','plus-open')}catch(e){}}
function assetViewMore(index){selected=allRecords[index];if(map&&map.closePopup)map.closePopup();openAssetViewPage(index)}
function openMapsForAsset(index){const r=allRecords[index]||selected;if(!r||!hasGPS(r)){openMapsForEstimatedAsset(index);return;}const lat=getLat(r),lng=getLng(r);window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,'_blank')}
function openAssetViewPage(index){const r=allRecords[index]||selected;if(!r)return;let page=document.getElementById('assetViewPage');if(!page){page=document.createElement('div');page.id='assetViewPage';page.className='asset-view-page';document.body.appendChild(page)}const source=r.original||r;const keys=Object.keys(source).filter(k=>!(typeof genericFieldIsHidden==='function'?genericFieldIsHidden(k):String(k).startsWith('__'))).sort();page.innerHTML=`<div class="asset-view-head"><button onclick="closeAssetViewPage()">← Back</button><h2>${esc(getStructure(r))}</h2><button onclick="openAssetEditor(${index})">Data Correction Edit</button></div><div class="asset-view-body">${assetInfoHTML(r)}<h3>All fields</h3>${keys.map(k=>field((typeof genericFieldLabel==='function'?genericFieldLabel(k):k),source[k])).join('')}</div>`;page.classList.add('show')}
function closeAssetViewPage(){document.getElementById('assetViewPage')?.classList.remove('show')}
function zoomSelected(){if(selected&&hasGPS(selected))map.setView([getLat(selected),getLng(selected)],18)}
function openMapsSelected(){if(selected&&hasGPS(selected))window.open(`https://www.google.com/maps/dir/?api=1&destination=${getLat(selected)},${getLng(selected)}&travelmode=driving`,'_blank')}
function getSpecialKind(r){return r.__kind==='depot'||r.__kind==='substation'?r.__kind:''}
function getSpecialName(r,type){return type==='depot'?getDepotName(r):getSubstationName(r)}
function getSpecialKey(r,type){return compactSearch(getSpecialName(r,type)||getStructure(r))}
function getSpecialAddress(r){return val(r,['ADDRESS','LOCATION','MAINTENANCE_ZONE'])}
