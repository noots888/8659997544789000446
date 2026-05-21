/*
  Map controls module
  -------------------
  Owns the Map drawer controls and direct map navigation actions.
  Map drawer controls and direct map navigation actions.
*/
function renderMapMenu(){
  head("Map","Controls");
  body().innerHTML=`
    <div class="premium-map-menu compact-map-controls">
      <div class="premium-control-hero compact">
        <div class="premium-control-icon">⌖</div>
        <div>
          <b>Map controls</b>
          <span>Quick actions</span>
        </div>
      </div>

      <div class="compact-control-grid">
        <button class="premium-action-card primary" onclick="viewCurrentMapArea()">
          <i>▣</i><b>View Area</b><span>Assets in window</span>
        </button>
        <button class="premium-action-card amber" onclick="clearSelected()">
          <i>⌫</i><b>Clear</b><span>Remove markers</span>
        </button>
        <button class="premium-action-card teal" onclick="openFilter()">
          <i>◉</i><b>Filter</b><span>Layer toggles</span>
        </button>
        <button class="premium-action-card primary" onclick="openDataCorrections()">
          <i>✎</i><b>Corrections</b><span>Edit assets</span>
        </button>
        <button class="premium-action-card amber" id="lineCrossingsBtn" onclick="toggleLineCrossings(); refreshMapControlState?.();">
          <i>✕</i><b>Crossings</b><span id="lineCrossingsSub">Line check</span>
        </button>
        <button class="premium-action-card danger" onclick="openDisplayAllMenu()">
          <i>☷</i><b>Display All</b><span>Asset groups</span>
        </button>
      </div>
    </div>`;
  refreshMapControlState?.();
}

function refreshMapControlState(){
  const btn=document.getElementById('lineCrossingsBtn');
  const sub=document.getElementById('lineCrossingsSub');
  if(btn)btn.classList.toggle('tool-active',!!crossingsEnabled);
  if(sub)sub.textContent=crossingsEnabled?'Shown on map':'Line check';
}


function savePerformanceSettings(){try{localStorage.setItem(PERF_KEY,JSON.stringify(performanceSettings));}catch(e){}}
function performanceModeOn(){return false;}
function performanceMaxDots(def){return def;}
function performancePatrolDots(def){return def;}
function performanceBatch(def){return def;}
function togglePerformanceMode(){showToolStatus?.('Performance mode removed');}
function refreshPerformanceModeLabels(){}

function locateMe(){
  if(!navigator.geolocation)return alert("GPS unavailable.");
  navigator.geolocation.getCurrentPosition(p=>{
    let ll=[p.coords.latitude,p.coords.longitude];
    if(locMarker)locMarker.setLatLng(ll);
    else locMarker=registerMapToggleLayer(L.marker(ll,{icon:L.divIcon({className:"loc-marker"})}).addTo(map),null,'location');
    locMarker._gps=ll;
    map.setView(ll,17);
  },e=>alert("GPS failed: "+e.message),{enableHighAccuracy:true,timeout:12000,maximumAge:3000});
}

function zoomSelected(){
  if(selected&&hasGPS(selected))map.setView([getLat(selected),getLng(selected)],18);
}

function openMapsSelected(){
  if(selected&&hasGPS(selected))window.open(`https://www.google.com/maps/dir/?api=1&destination=${getLat(selected)},${getLng(selected)}&travelmode=driving`,"_blank");
}

function openMapsCurrentPosition(){
  if(!navigator.geolocation){
    alert("GPS unavailable.");
    return;
  }
  showToolStatus("Getting current GPS for Google Maps...");
  navigator.geolocation.getCurrentPosition(p=>{
    const lat=p.coords.latitude;
    const lng=p.coords.longitude;
    window.open(`https://www.google.com/maps?q=${lat},${lng}`,"_blank");
    showToolStatus("Opening current position in Google Maps");
  },e=>{
    const fallback=locMarker&&locMarker._gps;
    if(fallback){
      window.open(`https://www.google.com/maps?q=${fallback[0]},${fallback[1]}`,"_blank");
      showToolStatus("Opening last known GPS in Google Maps");
      return;
    }
    alert("GPS failed: "+e.message);
  },{enableHighAccuracy:true,timeout:12000,maximumAge:2000});
}

function clearSelected(){
  selected=null;
  selectedMarker=null;
  if(typeof clearMapToolLayers==="function") clearMapToolLayers();
  else {
    assetLayer.clearLayers();
    crossingLayer.clearLayers();
    radiusLayer.clearLayers();
    measureLayer.clearLayers();
  }
  showToolStatus("Map cleared");
}

function viewCurrentMapArea(){
  if(!map||typeof map.getBounds!=='function'){
    alert('Map is not ready yet.');
    return;
  }
  if(!(allRecords||[]).length){
    alert('No asset data loaded. Import JSON/CSV first.');
    return;
  }
  const b=map.getBounds();
  if(!b||!b.isValid||!b.isValid()){
    alert('Current map window is not available yet.');
    return;
  }
  const center=map.getCenter();
  const zoom=map.getZoom();
  const rows=(allRecords||[]).filter(r=>{
    if(!displayableAsset(r))return false;
    const lat=Number(getLat(r)), lng=Number(getLng(r));
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return false;
    try{return b.contains(L.latLng(lat,lng));}catch(e){return false;}
  });
  const noGpsTotal=(allRecords||[]).filter(r=>r&&r.__kind!=='conductor'&&!hasGPS(r)).length;
  if(!rows.length){
    showToolStatus('View Area: no GPS assets inside current map window');
    alert('No GPS assets found inside the current map window. No-GPS records cannot be placed unless they are estimated from a selected route.');
    return;
  }
  const heavy=rows.length>2500;
  const msg=`View Area will show ${rows.length.toLocaleString()} GPS asset${rows.length===1?'':'s'} inside the current map window.${noGpsTotal?`\n\n${noGpsTotal.toLocaleString()} no-GPS records exist in the file but cannot be placed by area view until they have an estimated/manual position.`:''}${heavy?'\n\nLarge area view can lag older phones. Continue?':''}`;
  if(heavy && !confirm(msg))return;
  showToolStatus(`View Area: loading ${rows.length.toLocaleString()} assets from current map window...`);
  displayRowsOnMap(rows,{title:'View Area',dots:true,drawLines:false,preserveView:true,preserveCenter:center,preserveZoom:zoom,viewArea:true});
}

function openDisplayAllMenu(){
  const total=(typeof fastGPSCount==='function'?fastGPSCount():(allRecords||[]).filter(displayableAsset).length);
  if(!total){alert('No GPS assets loaded. Import your JSON/CSV first.');return;}
  let sheet=document.getElementById('displayAllMenuSheet');
  if(!sheet){
    sheet=document.createElement('div');
    sheet.id='displayAllMenuSheet';
    sheet.className='display-all-menu-sheet';
    document.body.appendChild(sheet);
  }
  const counts={
    everything:countDisplayAssets(()=>true),
    lines:countLineGroups(()=>true),
    poles:countDisplayAssets(r=>assetCategory(r)==='pole'),
    towers:countDisplayAssets(r=>assetCategory(r)==='tower'),
    subs:countDisplayAssets(r=>assetCategory(r)==='substation'),
    depots:countDisplayAssets(r=>assetCategory(r)==='depot')
  };
  sheet.innerHTML=`
    <div class="display-all-card">
      <div class="display-all-head">
        <div><b>Display all menu</b><span>Large views can lag older phones. Pick the smallest useful layer.</span></div>
        <button onclick="closeDisplayAllMenu()">×</button>
      </div>
      <div class="display-all-grid">
        ${displayAllBtn('Display everything',counts.everything,'displayAllAssetsBy("everything")','All GPS assets')}
        ${displayAllBtn('All Routes',counts.lines,'displayAllAssetsBy("lines")','Draw route paths')}
        ${displayAllBtn('All Points',counts.poles,'displayAllAssetsBy("poles")','Point markers')}
        ${displayAllBtn('All Structures',counts.towers,'displayAllAssetsBy("towers")','Structure markers')}
        ${displayAllBtn('All Sites',counts.subs,'displayAllAssetsBy("substations")','Site markers')}
        ${displayAllBtn('All Bases',counts.depots,'displayAllAssetsBy("depots")','Base sites')}
      </div>
      <div class="display-all-actions"><button class="secondary" onclick="closeDisplayAllMenu()">Cancel</button><button class="sun" onclick="clearSelected();closeDisplayAllMenu()">Clear map</button></div>
    </div>`;
  sheet.classList.add('show');
}
function displayAllBtn(title,count,action,sub){return `<button class="display-all-choice" onclick='${action}'><b>${title}</b><span>${sub}</span><em>${Number(count||0).toLocaleString()}</em></button>`}
function closeDisplayAllMenu(){document.getElementById('displayAllMenuSheet')?.classList.remove('show')}
function displayableAsset(r){return r && r.__kind!=='conductor' && hasGPS(r)}
function countDisplayAssets(fn){return (allRecords||[]).filter(r=>displayableAsset(r)&&fn(r)).length}
function countLineGroups(fn){const set=new Set();(allRecords||[]).forEach(r=>{if(!displayableAsset(r)||!fn(r))return;(typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):lineCandidates(r)).forEach(l=>{const k=compactSearch(l);if(k)set.add(k)})});return set.size}
function assetCategory(r){
  const k=String(r.__kind||getType(r)||'').toLowerCase();
  if(k.includes('tower'))return 'tower';
  if(k.includes('pole'))return 'pole';
  if(k.includes('substation')||k.includes('terminal'))return 'substation';
  if(k.includes('depot'))return 'depot';
  const t=String([getStructure(r),getLine(r),val(r,['EQUIP_GRP_ID_DESC','STRUC_TYP_DESC','STRUC_CAT_DESC'])].join(' ')).toLowerCase();
  if(t.includes('tower')||t.includes('lattice'))return 'tower';
  if(t.includes('pole'))return 'pole';
  return 'asset';
}
function displayAllAssetsBy(mode){
  let title='Display everything', filter=()=>true, drawLines=false, dots=true;
  if(mode==='lines'){title='All Routes'; drawLines=true; dots=false;}
    if(mode==='poles'){title='All Points'; filter=r=>assetCategory(r)==='pole';}
  if(mode==='towers'){title='All Structures'; filter=r=>assetCategory(r)==='tower';}
  if(mode==='substations'){title='All Sites'; filter=r=>assetCategory(r)==='substation';}
  if(mode==='depots'){title='All Bases'; filter=r=>assetCategory(r)==='depot';}
  const rows=(allRecords||[]).filter(r=>displayableAsset(r)&&filter(r));
  const lineCount=drawLines?countLineGroups(filter):0;
  const warn=`${title}\n\nThis will load ${rows.length.toLocaleString()} GPS assets${drawLines?` and up to ${lineCount.toLocaleString()} route paths`:''}.\n\nWarning: large views can lag or freeze phones. Continue?`;
  if(!rows.length){alert('No matching GPS assets found for '+title+'.');return;}
  if(!confirm(warn))return;
  closeDisplayAllMenu();
  displayRowsOnMap(rows,{title,drawLines,dots});
}
function drawDisplayAllFastLine(gps,lineName){
  if(!gps||gps.length<2)return;
  const ordered=gps.slice().sort((a,b)=>plateNo(a)-plateNo(b));
  let seg=[];
  const flush=()=>{
    if(seg.length>1){
      const line=registerMapToggleLayer(L.polyline(seg,{weight:2.6,opacity:.45,fill:false,lineCap:'round',lineJoin:'round',className:'display-all-line'}).addTo(assetLayer),null,'line');
      line.bindTooltip(`${lineName} | ${gps.length} GPS`);
    }
    seg=[];
  };
  for(const r of ordered){
    const ll=[getLat(r),getLng(r)];
    if(seg.length){
      const last=seg[seg.length-1];
      const d=distanceMeters(last[0],last[1],ll[0],ll[1]);
      if(!Number.isFinite(d)||d>8000)flush();
    }
    seg.push(ll);
  }
  flush();
}
function displayRowsOnMap(rows,opts={}){
  forceMapAssetsVisibleForRoute?.();
  if(!assetLayer)return;
  window.__displayRowsToken=(window.__displayRowsToken||0)+1;
  const token=window.__displayRowsToken;
  assetLayer.clearLayers();
  selected=null; selectedMarker=null;
  const maxDots=opts.dots===false?0:rows.length;
  const maxLines=Infinity;
  const bounds=[];
  const addBounds=r=>{if(hasGPS(r))bounds.push([getLat(r),getLng(r)])};
  const dotRows=opts.dots===false?[]:rows;
  showToolStatus(`Loading ${opts.title||'assets'}...`);

  const finish=()=>{
    if(token!==window.__displayRowsToken)return;
    if(opts.preserveView&&map){
      try{
        const c=opts.preserveCenter||map.getCenter();
        const z=Number.isFinite(Number(opts.preserveZoom))?Number(opts.preserveZoom):map.getZoom();
        map.setView(c,z,{animate:false});
      }catch(e){}
    }else if(bounds.length>1)map.fitBounds(L.latLngBounds(bounds),{padding:[35,35],maxZoom:13});
    else if(bounds.length===1)map.setView(bounds[0],17);
    const suffix=opts.viewArea?' assets in current map window':' GPS dots';
    showToolStatus(`${opts.title||'Assets'} displayed: ${rows.length.toLocaleString()}${suffix}`);
  };

  const addDots=()=>{
    let i=0;
    function addBatch(){
      if(token!==window.__displayRowsToken)return;
      const end=Math.min(i+performanceBatch(180),dotRows.length);
      for(;i<end;i++){
        const r=dotRows[i];
        const idx=(typeof recordIndexOf==='function')?recordIndexOf(r):((r&&r.__idx!==undefined)?r.__idx:allRecords.indexOf(r));
        const cat=assetCategory(r);
        const cls=cat==='tower'?'tower-dot':cat==='substation'?'sub-dot':cat==='depot'?'depot-dot':cat==='pole'?'pole-dot':'asset-dot';
        const radius=cat==='substation'||cat==='depot'?6:4;
        const m=registerMapToggleLayer(L.circleMarker([getLat(r),getLng(r)],{radius,weight:1.6,fillOpacity:.85,className:cls}).addTo(assetLayer),r,'dot');
        m.bindTooltip(`${getLine(r)||getSubstationName(r)||getDepotName(r)||''} | ${getStructure(r)}`);
        bindAssetMiniPopup(m,idx);
        addBounds(r);
      }
      applyMapToggleSettings?.();
      if(i<dotRows.length){showToolStatus(`Loading ${opts.title||'assets'}... ${i.toLocaleString()} / ${dotRows.length.toLocaleString()}`);requestAnimationFrame(addBatch);return;}
      finish();
    }
    addBatch();
  };

  if(opts.drawLines){
    const groups=groupRowsByLine(rows);
    let gidx=0;
    function drawLineBatch(){
      if(token!==window.__displayRowsToken)return;
      const end=Math.min(gidx+(performanceModeOn()?4:8),groups.length);
      for(;gidx<end;gidx++){
        const g=groups[gidx];
        const gps=g.records.filter(hasGPS).sort((a,b)=>plateNo(a)-plateNo(b));
        if(gps.length<2)continue;
        if(typeof drawCleanRouteSegments==='function' && gps.length<=220){
          drawCleanRouteSegments(gps,assetLayer,{maxSegments:4,weight:2.8,opacity:.5,className:'display-all-line',tooltip:`${g.line} | ${gps.length} GPS`});
        }else{
          drawDisplayAllFastLine(gps,g.line);
        }
        gps.forEach(addBounds);
      }
      applyMapToggleSettings?.();
      if(gidx<groups.length){showToolStatus(`Drawing routes... ${gidx.toLocaleString()} / ${groups.length.toLocaleString()}`);requestAnimationFrame(drawLineBatch);return;}
      addDots();
    }
    drawLineBatch();
  }else{
    addDots();
  }
}
function groupRowsByLine(rows){
  const mapObj={};
  rows.forEach(r=>{
    const lines=(typeof routeOnlyCandidates==='function'?routeOnlyCandidates(r):lineCandidates(r)).filter(Boolean);
    const line=lines[0]||getLine(r)||'Unknown';
    const key=compactSearch(line)||line;
    if(!mapObj[key])mapObj[key]={line,records:[]};
    mapObj[key].records.push(r);
  });
  return Object.values(mapObj).sort((a,b)=>a.line.localeCompare(b.line));
}

// Legacy wrapper kept so older buttons/calls still work.
function confirmDisplayAllAssets(){openDisplayAllMenu()}
function displayAllAssetsOnMap(){displayAllAssetsBy('everything')}
