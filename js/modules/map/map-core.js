/*
  Map core module - STAGE 1
  -------------------------
  Owns Leaflet map creation and base layer setup only.
  App boot calls initMapCore() from js/core/app-init.js.

  Keep this module separate from Search, Keyboard, Settings and Import.
*/
function initMapCore(){
  map=L.map("map",{
    zoomControl:false,
    preferCanvas:true,
    worldCopyJump:true,
    updateWhenIdle:true,
    updateWhenZooming:false
  }).setView([-25.2744,133.7751],5);

  // Keep tile loading light and recover from blank/failed tiles. Do not use a blank errorTileUrl,
  // because it makes the map look like it has stopped loading when a provider has a bad tile.
  const commonTileOpts={
    crossOrigin:false,
    detectRetina:false,
    keepBuffer:3,
    updateWhenIdle:true,
    updateWhenZooming:false,
    reuseTiles:true
  };

  function retryTile(tile){
    if(!tile || tile.__assetRetryDone)return;
    tile.__assetRetryDone=true;
    const src=tile.src;
    if(!src)return;
    setTimeout(()=>{
      try{tile.src=src+(src.indexOf('?')>-1?'&':'?')+'r='+Date.now();}catch(e){}
    },280);
  }

  function makeStableTileLayer(id,url,opts){
    const layer=L.tileLayer(url,{...commonTileOpts,...opts});
    layer._baseLayerId=id;
    layer._tileErrorCount=0;
    layer.on('tileerror',(ev)=>{
      retryTile(ev&&ev.tile);
      layer._tileErrorCount=(layer._tileErrorCount||0)+1;
      if(currentBaseLayerId===id && layer._tileErrorCount===8){
        showToolStatus?.('Map tiles struggling. Refreshing layer.');
        setTimeout(()=>{try{layer.redraw(); map.invalidateSize({pan:false});}catch(e){}},350);
      }
      if(currentBaseLayerId===id && layer._tileErrorCount===18){
        showToolStatus?.('Tile provider failed. Switching to Street temporarily.');
        if(id!=='street') setBaseMapLayer?.('street');
      }
    });
    layer.on('load',()=>{layer._tileErrorCount=0;});
    return layer;
  }

  streetLayer=makeStableTileLayer('street','https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:22,
    maxNativeZoom:19,
    attribution:'© OpenStreetMap'
  });

  satelliteLayer=makeStableTileLayer('satellite','https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:22,
    maxNativeZoom:19,
    attribution:'Tiles © Esri'
  });

  googleSatelliteLayer=makeStableTileLayer('google_satellite','https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
    subdomains:['0','1','2','3'],
    maxZoom:22,
    maxNativeZoom:21,
    attribution:'Google Satellite'
  });

  googleHybridLayer=makeStableTileLayer('google_hybrid','https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',{
    subdomains:['0','1','2','3'],
    maxZoom:22,
    maxNativeZoom:21,
    attribution:'Google Hybrid'
  });

  topoLayer=makeStableTileLayer('topo','https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{
    maxZoom:22,
    maxNativeZoom:17,
    attribution:'© OpenStreetMap, © OpenTopoMap'
  });

  humanitarianLayer=makeStableTileLayer('humanitarian','https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',{
    maxZoom:22,
    maxNativeZoom:20,
    attribution:'© OpenStreetMap, HOT'
  });

  baseLayers={
    street:{label:'Street',sub:'General roads + places',layer:streetLayer},
    satellite:{label:'Satellite',sub:'Stable aerial imagery',layer:satelliteLayer},
    google_satellite:{label:'Google Satellite',sub:'High-detail satellite layer',layer:googleSatelliteLayer},
    google_hybrid:{label:'Google Hybrid',sub:'Satellite + labels',layer:googleHybridLayer},
    topo:{label:'Topo',sub:'Terrain + contours',layer:topoLayer},
    humanitarian:{label:'Detailed',sub:'More local detail',layer:humanitarianLayer}
  };
  currentBaseLayerId=localStorage.getItem('asset_tracker_v35_base_layer')||'street';
  if(currentBaseLayerId==='light'||currentBaseLayerId==='dark')currentBaseLayerId='street';
  if(!baseLayers[currentBaseLayerId])currentBaseLayerId='street';
  baseLayers[currentBaseLayerId].layer.addTo(map);
  satelliteOn=currentBaseLayerId==='satellite'||currentBaseLayerId==='google_satellite'||currentBaseLayerId==='google_hybrid';

  assetLayer=L.layerGroup().addTo(map);
  crossingLayer=L.layerGroup().addTo(map);
  radiusLayer=L.layerGroup().addTo(map);
  measureLayer=L.layerGroup().addTo(map);
  breadcrumbLayer=L.layerGroup().addTo(map);

  map.on('click',mapClick);
}

function refreshMapTilesSoft(){
  try{
    if(!map)return;
    map.invalidateSize({pan:false});
    const cfg=baseLayers&&baseLayers[currentBaseLayerId];
    if(cfg&&cfg.layer&&cfg.layer.redraw)cfg.layer.redraw();
  }catch(e){}
}

function isMapReady(){
  return !!(map && assetLayer && crossingLayer && radiusLayer && measureLayer);
}
