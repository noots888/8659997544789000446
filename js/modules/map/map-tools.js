/*
  Map tools module
  ----------------
  Owns measure tools, satellite toggle, 3 km radius, route crossings and breadcrumb trail.
  Search keyboard/menu code should not be edited here unless changing map tools directly.
*/
/* Measure tool, multi-measure, satellite, radius, crossings, breadcrumb trail. */
function mapClick(e){if(document.getElementById("plusSheet").classList.contains("open")&&!measureOn&&!multiMeasureOn){closePlus();return}if(!measureOn&&!multiMeasureOn)return;let point=e.latlng;if(measureLock){let snap=findNearestLoadedAsset(point,70);if(snap)point=snap}if(multiMeasureOn){measurePts.push(point);L.marker(point,{icon:L.divIcon({className:"measure-poly-point"})}).addTo(measureLayer);if(multiMeasureLine)map.removeLayer(multiMeasureLine);if(measurePts.length>1){multiMeasureLine=L.polyline(measurePts,{color:"#e6aa34",weight:4}).addTo(map);let total=0;for(let i=1;i<measurePts.length;i++)total+=map.distance(measurePts[i-1],measurePts[i]);showToolStatus("Multi measure: "+fmt(total))}return}measurePts.push(point);L.marker(point,{icon:L.divIcon({className:"measure-point"})}).addTo(measureLayer);if(measurePts.length===2){if(measureLine)map.removeLayer(measureLine);measureLine=L.polyline(measurePts,{color:"#ff8a24",weight:5}).addTo(map);let d=map.distance(measurePts[0],measurePts[1]);measureLayer.clearLayers();showToolStatus("Measured: "+fmt(d));measurePts=[]}}
function fmt(d){return d<1000?Math.round(d)+" m":(d/1000).toFixed(2)+" km"}
function showToolStatus(t){let e=document.getElementById("toolStatus");e.innerText=t;e.classList.add("on");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("on"),3500)}
function toggleMeasureTool(){measureOn=!measureOn;multiMeasureOn=false;measurePts=[];measureLayer.clearLayers();if(measureLine){map.removeLayer(measureLine);measureLine=null}if(multiMeasureLine){map.removeLayer(multiMeasureLine);multiMeasureLine=null}if(measureOn){measureLock=confirm("Lock measure points onto nearby assets?");showToolStatus("2 point measure on.")}else showToolStatus("Measure off"); if(typeof refreshToolActiveStates==='function')refreshToolActiveStates()}
function toggleMultiMeasureTool(){multiMeasureOn=!multiMeasureOn;measureOn=false;measurePts=[];measureLayer.clearLayers();if(measureLine){map.removeLayer(measureLine);measureLine=null}if(multiMeasureLine){map.removeLayer(multiMeasureLine);multiMeasureLine=null}if(multiMeasureOn){measureLock=confirm("Lock measure points onto nearby assets?");showToolStatus("Multi measure on.")}else showToolStatus("Multi measure off"); if(typeof refreshToolActiveStates==='function')refreshToolActiveStates()}
function findNearestLoadedAsset(latlng,maxM){let best=null,dist=Infinity;[assetLayer,crossingLayer,radiusLayer].forEach(layer=>layer.eachLayer(l=>{if(!l.getLatLng)return;let d=map.distance(latlng,l.getLatLng());if(d<dist){dist=d;best=l.getLatLng()}}));return dist<=maxM?best:null}
function setBaseMapLayer(id){
  if(!map||!baseLayers)return;
  const cfg=baseLayers[id];
  if(!cfg||!cfg.layer)return;
  Object.values(baseLayers).forEach(x=>{if(x&&x.layer&&map.hasLayer(x.layer))map.removeLayer(x.layer);});
  cfg.layer.addTo(map);
  currentBaseLayerId=id;
  satelliteOn=id==='satellite'||id==='google_satellite'||id==='google_hybrid';
  try{localStorage.setItem('asset_tracker_v35_base_layer',id);}catch(e){}
  document.querySelectorAll('.map-layer-choice').forEach(btn=>btn.classList.toggle('active',btn.dataset.layer===id));
  showToolStatus((cfg.label||'Map layer')+' layer on');
  setTimeout(()=>{try{map.invalidateSize({pan:false}); cfg.layer.redraw&&cfg.layer.redraw();}catch(e){}},80);
  setTimeout(()=>{try{map.invalidateSize({pan:false});}catch(e){}},450);
}

function toggleSatellite(){
  // Kept for old buttons. It now toggles the quick street/satellite pair only.
  setBaseMapLayer((currentBaseLayerId==='satellite'||currentBaseLayerId==='google_satellite'||currentBaseLayerId==='google_hybrid')?'street':'satellite');
}

function openMapLayerSheet(){
  if(!baseLayers||!Object.keys(baseLayers).length)return toggleSatellite();
  let sheet=document.getElementById('mapLayerSheet');
  if(!sheet){
    sheet=document.createElement('div');
    sheet.id='mapLayerSheet';
    sheet.className='map-layer-sheet';
    document.body.appendChild(sheet);
  }
  const layerPreview=id=>`<span class="layer-preview layer-preview-${String(id).replace(/[^a-z0-9_-]/gi,'_')}" aria-hidden="true"><i></i></span>`;
  const buttons=Object.entries(baseLayers).map(([id,cfg])=>`<button class="map-layer-choice ${id===currentBaseLayerId?'active':''}" data-layer="${id}" onclick="setBaseMapLayer('${id}');closeMapLayerSheet();">${layerPreview(id)}<span class="layer-copy"><b>${cfg.label}</b><span>${cfg.sub||''}</span></span></button>`).join('');
  sheet.innerHTML=`
    <div class="map-layer-card">
      <div class="map-layer-head"><div><b>Map Layers</b><span>Choose a base map or open the current view in Google.</span></div><button onclick="closeMapLayerSheet()">×</button></div>
      <div class="map-layer-section-title">Base map</div>
      <div class="map-layer-grid">${buttons}</div>
      <div class="map-layer-section-title">Open current view in Google</div>
      <div class="map-external-grid">
        <button class="map-external-choice" onclick="openGoogleSatelliteView();closeMapLayerSheet();"><span class="layer-preview layer-preview-google_satellite" aria-hidden="true"><i></i></span><span class="layer-copy"><b>Google Satellite</b><span>Open this view in Google Maps satellite</span></span></button>
        <button class="map-external-choice" onclick="openGoogleStreetView();closeMapLayerSheet();"><span class="layer-preview layer-preview-streetview" aria-hidden="true"><i></i></span><span class="layer-copy"><b>Street View</b><span>Open Street View near this map centre</span></span></button>
        <button class="map-external-choice" onclick="openGoogleEarthView();closeMapLayerSheet();"><span class="layer-preview layer-preview-earth" aria-hidden="true"><i></i></span><span class="layer-copy"><b>Earth</b><span>Open this area in Google Earth</span></span></button>
      </div>
    </div>`;
  sheet.classList.add('show');
  closePlus?.();
}
function closeMapLayerSheet(){document.getElementById('mapLayerSheet')?.classList.remove('show')}

function getExternalMapTarget(){
  if(selected&&hasGPS(selected))return {lat:getLat(selected),lng:getLng(selected),zoom:Math.max(17,Math.round(map?.getZoom?.()||18))};
  if(locMarker&&locMarker._gps)return {lat:locMarker._gps[0],lng:locMarker._gps[1],zoom:Math.max(17,Math.round(map?.getZoom?.()||18))};
  const c=map?.getCenter?.();
  return {lat:c?.lat||-31.9505,lng:c?.lng||115.8605,zoom:Math.round(map?.getZoom?.()||16)};
}
function openGoogleSatelliteView(){
  const t=getExternalMapTarget();
  window.open(`https://www.google.com/maps/@?api=1&map_action=map&center=${t.lat},${t.lng}&zoom=${Math.max(1,Math.min(21,t.zoom))}&basemap=satellite`,'_blank');
  showToolStatus?.('Opening Google Satellite');
}
function openGoogleStreetView(){
  const t=getExternalMapTarget();
  window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${t.lat},${t.lng}`,'_blank');
  showToolStatus?.('Opening Street View');
}
function openGoogleEarthView(){
  const t=getExternalMapTarget();
  window.open(`https://earth.google.com/web/search/${t.lat},${t.lng}`,'_blank');
  showToolStatus?.('Opening Google Earth');
}
function toggleRadiusLines(){radiusOn=!radiusOn;radiusLayer.clearLayers();if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();if(!radiusOn)return showToolStatus("3 km off");let c=selected&&hasGPS(selected)?{lat:getLat(selected),lng:getLng(selected)}:locMarker&&locMarker._gps?{lat:locMarker._gps[0],lng:locMarker._gps[1]}:null;if(!c)return alert("Select an asset or press GPS first.");let hits=allRecords.filter(r=>hasGPS(r)&&distanceMeters(c.lat,c.lng,getLat(r),getLng(r))<=3000);registerMapToggleLayer(L.circle([c.lat,c.lng],{radius:3000,color:"#3a8fca",weight:2,fillOpacity:.06}).addTo(radiusLayer),null,'radius');hits.forEach(r=>{let m=registerMapToggleLayer(L.marker([getLat(r),getLng(r)],{icon:L.divIcon({className:"radius-marker"})}).addTo(radiusLayer),r,'radius');m.bindTooltip(`${getLine(r)} | ${getStructure(r)}`);m.on("click",()=>selectAsset(allRecords.indexOf(r)))});showToolStatus(`3 km: ${hits.length} assets`)}
function getLineCrossingContext(){
  let current='';
  let base=[];
  if(selected && hasGPS(selected)){
    current=getLine(selected);
    base=(typeof routeHitsFromCache==='function'&&current)?routeRecordsOnly(routeHitsFromCache(current)):[];
    if(!base.length)base=(allRecords||[]).filter(r=>hasGPS(r)&&getLine(r)===current);
  }
  if((!current||!base.length) && typeof routeLastSingleName!=='undefined' && routeLastSingleName && Array.isArray(routeLastSingleRows) && routeLastSingleRows.length){
    current=String(routeLastSingleName||'');
    base=routeRecordsOnly(routeLastSingleRows).filter(hasGPS);
  }
  if((!current||!base.length) && Array.isArray(visibleRecords) && visibleRecords.length){
    const gpsRows=routeRecordsOnly(visibleRecords).filter(hasGPS);
    const counts=new Map();
    gpsRows.forEach(r=>{const k=getLine(r); if(k)counts.set(k,(counts.get(k)||0)+1);});
    current=Array.from(counts.entries()).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
    base=gpsRows.filter(r=>getLine(r)===current);
  }
  base=(base||[]).filter(hasGPS);
  return {line:current,base};
}

function lineBelongsToRoute(r,line){
  if(!line)return false;
  try{if((typeof lineCandidates==='function'?lineCandidates(r):[getLine(r)]).some(x=>String(x||'')===String(line)))return true;}catch(e){}
  return String(getLine(r)||'')===String(line);
}

function toggleLineCrossings(){
  crossingsEnabled=!crossingsEnabled;
  crossingLayer.clearLayers();
  if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();
  if(typeof refreshMapControlState==='function')refreshMapControlState();
  if(!crossingsEnabled)return showToolStatus("Line crossings off");

  const ctx=getLineCrossingContext();
  const current=ctx.line;
  const base=ctx.base||[];
  if(!current||!base.length){
    crossingsEnabled=false;
    if(typeof refreshMapControlState==='function')refreshMapControlState();
    alert("Load a line/route or select a GPS asset first, then turn Line Crossings on.");
    return;
  }

  showToolStatus(`Checking crossings for ${current}...`);
  const pad=0.006;
  const lats=base.map(getLat), lngs=base.map(getLng);
  const minLat=Math.min(...lats)-pad, maxLat=Math.max(...lats)+pad, minLng=Math.min(...lngs)-pad, maxLng=Math.max(...lngs)+pad;
  const candidates=(allRecords||[]).filter(r=>{
    if(!hasGPS(r) || lineBelongsToRoute(r,current))return false;
    const lat=getLat(r), lng=getLng(r);
    return lat>=minLat&&lat<=maxLat&&lng>=minLng&&lng<=maxLng;
  });
  const hits=[];
  for(const r of candidates){
    const lat=getLat(r), lng=getLng(r);
    for(const b of base){
      if(distanceMeters(lat,lng,getLat(b),getLng(b))<=500){hits.push(r);break;}
    }
  }
  hits.forEach(r=>{
    const m=registerMapToggleLayer(L.marker([getLat(r),getLng(r)],{icon:L.divIcon({className:"crossing-marker"})}).addTo(crossingLayer),r,'crossing');
    m.bindTooltip(`${getLine(r)} | ${getStructure(r)}`);
    m.on("click",()=>selectAsset((typeof recordIndexOf==='function'?recordIndexOf(r):(allRecords||[]).indexOf(r))));
  });
  applyMapToggleSettings?.();
  showToolStatus(`Line crossings ${current}: ${hits.length.toLocaleString()} nearby asset${hits.length===1?'':'s'}`);
}
function distanceMeters(lat1,lon1,lat2,lon2){let R=6371000,toRad=x=>x*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}

function toggleBreadcrumbs(){
  breadcrumbOn=!breadcrumbOn;
  if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();
  if(breadcrumbOn){
    startBreadcrumbs();
  }else{
    stopBreadcrumbs();
  }
}

function startBreadcrumbs(){
  if(!navigator.geolocation){
    breadcrumbOn=false;
    return alert("GPS unavailable.");
  }
  breadcrumbPoints=[];
  breadcrumbLayer.clearLayers();
  showToolStatus("Breadcrumb trail on.");

  breadcrumbWatchId=navigator.geolocation.watchPosition(p=>{
    const point=[p.coords.latitude,p.coords.longitude];

    if(breadcrumbPoints.length){
      const last=breadcrumbPoints[breadcrumbPoints.length-1];
      if(distanceMeters(last[0],last[1],point[0],point[1])<8)return;
    }

    breadcrumbPoints.push(point);

    registerMapToggleLayer(L.marker(point,{icon:L.divIcon({className:"breadcrumb-dot"})}).addTo(breadcrumbLayer),null,'breadcrumb');

    if(breadcrumbPoints.length>1){
      breadcrumbLayer.eachLayer(l=>{
        if(l instanceof L.Polyline)breadcrumbLayer.removeLayer(l);
      });
      registerMapToggleLayer(L.polyline(breadcrumbPoints,{color:"#e9ad35",weight:4,opacity:.9}).addTo(breadcrumbLayer),null,'breadcrumb');
    }
  }, e=>{
    breadcrumbOn=false;
    showToolStatus("Breadcrumb GPS failed: "+e.message);
  }, {enableHighAccuracy:true,maximumAge:3000,timeout:12000});
}

function stopBreadcrumbs(){
  if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();
  if(breadcrumbWatchId!==null){
    navigator.geolocation.clearWatch(breadcrumbWatchId);
    breadcrumbWatchId=null;
  }
  showToolStatus("Breadcrumb trail off.");
}



/* v3.6.34 POI from GPS marker/current GPS */
let pendingPOIGps=null;
function openPOIAtGPS(){
  if(typeof closeDrawer==='function')closeDrawer();
  if(typeof closeSettings==='function')closeSettings();
  const openPage=(lat,lng,accuracy)=>{
    pendingPOIGps={lat,lng,accuracy:accuracy||null,time:new Date().toISOString()};
    if(locMarker){locMarker.setLatLng([lat,lng]);locMarker._gps=[lat,lng];}
    else {locMarker=registerMapToggleLayer(L.marker([lat,lng],{icon:L.divIcon({className:'loc-marker'})}).addTo(map),null,'location'); locMarker._gps=[lat,lng];}
    map.setView([lat,lng],18);
    const page=document.getElementById('poiPage');
    page?.classList.add('open');
    document.body.classList.add('poi-open');
    const status=document.getElementById('poiGpsStatus');
    if(status)status.textContent=`POI will save at GPS marker: ${lat.toFixed(6)}, ${lng.toFixed(6)}${accuracy?` · ±${Math.round(accuracy)} m`:''}`;
    if(typeof refreshToolActiveStates==='function')refreshToolActiveStates();
  };
  if(navigator.geolocation){
    showToolStatus('Getting current GPS for POI...');
    navigator.geolocation.getCurrentPosition(p=>openPage(p.coords.latitude,p.coords.longitude,p.coords.accuracy),e=>{
      const fallback=locMarker&&locMarker._gps;
      if(fallback){openPage(fallback[0],fallback[1],null);showToolStatus('Using last GPS marker for POI.');return;}
      alert('GPS failed: '+e.message);
    },{enableHighAccuracy:true,timeout:15000,maximumAge:2000});
  }else if(locMarker&&locMarker._gps){
    openPage(locMarker._gps[0],locMarker._gps[1],null);
  }else alert('GPS unavailable. Press My GPS first.');
}
function openPOI(){openPOIAtGPS();}
function savePOI(){
  const gps=pendingPOIGps || (locMarker&&locMarker._gps?{lat:locMarker._gps[0],lng:locMarker._gps[1],time:new Date().toISOString()}:null);
  if(!gps)return alert('No GPS marker available for POI.');
  const item={id:Date.now(),type:document.getElementById('poiType')?.value||'POI',note:document.getElementById('poiNote')?.value||'',lat:gps.lat,lng:gps.lng,accuracy:gps.accuracy||null,createdAt:new Date().toISOString()};
  pois.push(item); localStorage.setItem(POI_KEY,JSON.stringify(pois));
  registerMapToggleLayer(L.marker([item.lat,item.lng],{icon:L.divIcon({className:'poi-marker'})}).addTo(assetLayer),null,'selected').bindTooltip(`${item.type}${item.note?' · '+item.note:''}`);
  document.getElementById('poiNote').value='';
  closePOI();
  showToolStatus('POI saved at GPS marker.');
}


/* v3.6.87 Estimate Review sheet
   Lets the user compare estimate dots against map layers, auto-align from public vector features, and manually correct positions.
*/
function openEstimateReviewSheet(){
  let sheet=document.getElementById('estimateReviewSheet');
  if(!sheet){
    sheet=document.createElement('div');
    sheet.id='estimateReviewSheet';
    sheet.className='estimate-review-sheet';
    document.body.appendChild(sheet);
  }
  sheet.innerHTML=`
    <div class="estimate-review-card">
      <div class="estimate-review-head">
        <div><b>Estimate Review</b><span>Auto-align from public power nodes, towers and power-line vertices. Use Show public power data to confirm what the app can actually read.</span></div>
        <button onclick="closeEstimateReviewSheet()">×</button>
      </div>
      <div class="estimate-review-section-title">Map layer for checking</div>
      <div class="estimate-review-grid">
        <button onclick="setBaseMapLayer('google_hybrid')"><b>Google Hybrid</b><span>Satellite + labels</span></button>
        <button onclick="setBaseMapLayer('google_satellite')"><b>Google Sat</b><span>Clear aerial view</span></button>
        <button onclick="setBaseMapLayer('street')"><b>Street</b><span>Roads / symbols</span></button>
        <button onclick="setBaseMapLayer('humanitarian')"><b>Detailed</b><span>More local features</span></button>
      </div>
      <div class="estimate-review-section-title">Dot visibility</div>
      <div class="estimate-review-toggles">
        <label><input type="checkbox" data-review-toggle="trueGps" ${mapToggleSettings.trueGps!==false?'checked':''}> Blue true GPS dots</label>
        <label><input type="checkbox" data-review-toggle="noGpsEstimates" ${mapToggleSettings.noGpsEstimates!==false?'checked':''}> Yellow no-GPS source estimates</label>
        <label><input type="checkbox" data-review-toggle="gapEstimates" ${mapToggleSettings.gapEstimates!==false?'checked':''}> Orange missing-number estimates</label>
        <label><input type="checkbox" data-review-toggle="lines" ${mapToggleSettings.lines!==false?'checked':''}> Blue route/path lines</label>
      </div>
      <div class="estimate-review-section-title">Automatic correction</div>
      <div class="estimate-review-actions">
        <button class="green" onclick="routeAutoAlignEstimatesFromLayers()">Auto align from map features</button>
        <button class="secondary" onclick="routeShowPublicPowerFeaturesForView()">Show public power data</button>
        <button class="secondary" onclick="routeClearAutoAlignSavedChecks()">Clear saved checks</button>
        <button class="clay" onclick="routeClearPublicPowerDebug()">Clear power overlay</button>
      </div>
      <div id="estimateReviewProgress" class="estimate-review-progress"></div>
      <div class="estimate-review-help">This now uses public power pole/tower nodes and power-line vertices. Tile images themselves still cannot be read; use Show public power data to see readable features.</div>
      <div class="estimate-review-section-title">Correct selected estimate</div>
      <div class="estimate-review-actions">
        <button class="green" onclick="routeEstimateMoveSelectedToCentre()">Move selected to map centre</button>
        <button class="secondary" onclick="routeEstimateArmMoveSelected()">Tap map to move selected</button>
        <button class="clay" onclick="routeEstimateHideSelected()">Hide selected estimate</button>
        <button class="secondary" onclick="routeEstimateResetSelected()">Reset selected</button>
      </div>
      <div class="estimate-review-help">Tap a yellow/orange estimate dot first. The route line now redraws from corrected/hidden estimates, so the old straight line should not remain.</div>
    </div>`;
  sheet.classList.add('show');
  sheet.querySelectorAll('[data-review-toggle]').forEach(el=>{
    el.addEventListener('change',()=>{
      const key=el.dataset.reviewToggle;
      mapToggleSettings[key]=!!el.checked;
      try{persistDisplayAndMapSettings?.();}catch(e){}
      try{applyMapToggleSettings?.();}catch(e){}
      showToolStatus?.((el.checked?'Showing ':'Hiding ')+el.parentElement.textContent.trim());
    });
  });
  closePlus?.();
}
function closeEstimateReviewSheet(){document.getElementById('estimateReviewSheet')?.classList.remove('show')}
