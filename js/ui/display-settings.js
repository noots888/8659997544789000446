function saveDisplaySettings(){
  displaySettings={
    stats:document.getElementById("showStats")?.checked??false,
    dots:true,
    sideButtons:document.getElementById("showSideButtons")?.checked??true,
    compass:document.getElementById("showCompass")?.checked??true,
    fab:document.getElementById("showFab")?.checked??true
  };
  mapToggleSettings={
    poles:document.getElementById("mapShowPoles")?.checked??true,
    towers:document.getElementById("mapShowTowers")?.checked??true,
    substations:document.getElementById("mapShowSubs")?.checked??true,
    depots:document.getElementById("mapShowDepots")?.checked??true,
    dots:document.getElementById("mapShowDots")?.checked??true,
    lines:document.getElementById("mapShowLines")?.checked??true,
    trueGps:document.getElementById("mapShowTrueGps")?.checked??true,
    noGpsEstimates:document.getElementById("mapShowNoGpsEstimates")?.checked??true,
    gapEstimates:document.getElementById("mapShowGapEstimates")?.checked??true,
    selected:document.getElementById("mapShowSelected")?.checked??true,
    crossings:document.getElementById("mapShowCrossings")?.checked??true,
    radius:document.getElementById("mapShowRadius")?.checked??true,
    breadcrumb:document.getElementById("mapShowBreadcrumb")?.checked??true,
    tools:document.getElementById("mapShowTools")?.checked??true,
    location:document.getElementById("mapShowLocation")?.checked??true
  };
  persistDisplayAndMapSettings();
  applyDisplaySettings();
  showToolStatus("Display updated.");
}
function persistDisplayAndMapSettings(){
  localStorage.setItem(DISPLAY_KEY,JSON.stringify(displaySettings));
  localStorage.setItem(MAP_TOGGLE_KEY,JSON.stringify(mapToggleSettings));
}
function setMapToggle(key,on){
  mapToggleSettings[key]=!!on;
  persistDisplayAndMapSettings();
  applyMapToggleSettings();
  showToolStatus((on?'Showing ':'Hiding ')+String(key).replace(/_/g,' '));
}
function setDisplayToggle(key,on){
  displaySettings[key]=!!on;
  persistDisplayAndMapSettings();
  applyDisplaySettings();
  showToolStatus((on?'Showing ':'Hiding ')+String(key).replace(/_/g,' '));
}
function resetDisplaySettings(){
  displaySettings={stats:false,dots:true,sideButtons:true,compass:true,fab:true};
  mapToggleSettings={poles:true,towers:true,substations:true,depots:true,dots:true,lines:true,trueGps:true,noGpsEstimates:true,gapEstimates:true,selected:true,crossings:true,radius:true,breadcrumb:true,tools:true,location:true};
  persistDisplayAndMapSettings();
  applyDisplaySettings();
  applyMapToggleSettings();
  renderFilter();
}
function applyDisplaySettings(){
  document.querySelector(".stats-strip")?.classList.toggle("hidden-ui",!displaySettings.stats);
  document.querySelector(".side-tools")?.classList.toggle("hidden-ui",!displaySettings.sideButtons);
  document.querySelector(".compass")?.classList.toggle("hidden-ui",!displaySettings.compass);
  document.querySelector(".fab")?.classList.toggle("hidden-ui",!displaySettings.fab);
  applyMapToggleSettings?.();
}
function toggleAllMapLayers(on){
  mapToggleSettings={poles:on,towers:on,substations:on,depots:on,dots:on,lines:on,trueGps:on,noGpsEstimates:on,gapEstimates:on,selected:on,crossings:on,radius:on,breadcrumb:on,tools:on,location:on};
  persistDisplayAndMapSettings();
  applyMapToggleSettings();
  renderFilter();
}
function toggleAssetLayersOnly(){
  mapToggleSettings={...mapToggleSettings,poles:true,towers:true,substations:true,depots:true,dots:true,lines:true,trueGps:true,noGpsEstimates:true,gapEstimates:true,selected:true,crossings:false,radius:false,breadcrumb:false,tools:false};
  persistDisplayAndMapSettings();
  applyMapToggleSettings();
  renderFilter();
}
function toggleOverlayLayersOnly(){
  mapToggleSettings={...mapToggleSettings,poles:false,towers:false,substations:false,depots:false,dots:false,lines:false,trueGps:false,noGpsEstimates:false,gapEstimates:false,selected:true,crossings:true,radius:true,breadcrumb:true,tools:true};
  persistDisplayAndMapSettings();
  applyMapToggleSettings();
  renderFilter();
}
function registerMapToggleLayer(layer,record,role){
  if(!layer)return layer;
  layer._tlRole=role||"dot";
  layer._tlKind=record?(record.__kind||getType(record)||""):"";
  try{setTimeout(()=>applyMapToggleSettings(),0)}catch(e){}
  return layer;
}
function layerKindAllowed(kind){
  kind=String(kind||'').toLowerCase();
  if(kind.includes('tower'))return !!mapToggleSettings.towers;
  if(kind.includes('pole'))return !!mapToggleSettings.poles;
  if(kind.includes('substation')||kind.includes('terminal'))return !!mapToggleSettings.substations;
  if(kind.includes('depot'))return !!mapToggleSettings.depots;
  return true;
}
function layerAllowed(layer){
  const role=layer?layer._tlRole:'';
  if(role==='line')return !!mapToggleSettings.lines;
  if(role==='selected')return !!mapToggleSettings.selected;
  if(role==='crossing')return !!mapToggleSettings.crossings;
  if(role==='radius')return !!mapToggleSettings.radius;
  if(role==='breadcrumb')return !!mapToggleSettings.breadcrumb;
  if(role==='tool'||role==='measure')return mapToggleSettings.tools!==false;
  if(role==='location')return mapToggleSettings.location!==false;
  if(role==='estimateHit'){
    if(!mapToggleSettings.dots)return false;
    const est=layer&&layer._tlEstimateType;
    if(est==='gap')return mapToggleSettings.gapEstimates!==false;
    if(est==='estimate')return mapToggleSettings.noGpsEstimates!==false;
    return true;
  }
  if(role==='dot'){
    if(!mapToggleSettings.dots)return false;
    const est=layer&&layer._tlEstimateType;
    if(est==='gap')return mapToggleSettings.gapEstimates!==false;
    if(est==='estimate')return mapToggleSettings.noGpsEstimates!==false;
    if(est==='trueGps')return mapToggleSettings.trueGps!==false && layerKindAllowed(layer._tlKind);
    return layerKindAllowed(layer._tlKind);
  }
  return true;
}
function setLayerVisible(layer,visible){
  if(!layer)return;
  layer._tlVisible=visible;
  if(layer.setStyle){
    if(!layer._tlBaseStyle){
      layer._tlBaseStyle={
        opacity:layer.options?.opacity??1,
        fillOpacity:layer.options?.fillOpacity??0.9,
        weight:layer.options?.weight
      };
    }
    layer.setStyle({opacity:visible?layer._tlBaseStyle.opacity:0,fillOpacity:visible?layer._tlBaseStyle.fillOpacity:0,interactive:visible});
  }
  if(layer.getElement){
    const el=layer.getElement();
    if(el)el.style.display=visible?'':'none';
  }
  if(layer.getTooltip && layer.getTooltip()){
    const t=layer.getTooltip().getElement?.();
    if(t)t.style.display=visible?'':'none';
  }
}
function applyMapToggleSettings(){
  const groups=[assetLayer,crossingLayer,radiusLayer,breadcrumbLayer,measureLayer];
  groups.forEach(g=>{try{g&&g.eachLayer&&g.eachLayer(l=>setLayerVisible(l,layerAllowed(l)))}catch(e){}});
  try{ if(locMarker) setLayerVisible(locMarker,mapToggleSettings.location!==false); }catch(e){}
}

function forceMapAssetsVisibleForRoute(){
  // Route/detail views should never silently hide imported GPS assets because an old map filter was left off.
  mapToggleSettings={
    ...mapToggleSettings,
    dots:true,
    poles:true,
    towers:true,
    substations:true,
    depots:true,
    lines:true,
    trueGps:true,
    noGpsEstimates:true,
    gapEstimates:true,
    selected:true
  };
  try{persistDisplayAndMapSettings();}catch(e){}
  try{renderFilter?.();}catch(e){}
  try{applyMapToggleSettings?.();}catch(e){}
}
