/*
  Map state helpers - STAGE 1
  ---------------------------
  Thin helper layer for map module actions.
  Existing globals remain in js/core/state.js for this stage to avoid breaking the app.
*/
function clearMapToolLayers(){
  if(assetLayer)assetLayer.clearLayers();
  if(crossingLayer)crossingLayer.clearLayers();
  if(radiusLayer)radiusLayer.clearLayers();
  if(measureLayer)measureLayer.clearLayers();
}

function getSelectedLatLng(){
  if(selected && hasGPS(selected)) return [getLat(selected),getLng(selected)];
  return null;
}
