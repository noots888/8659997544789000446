/* Filter panel template. */
function renderFilter(){
  head("Filter","Instant display and map layer controls");
  body().innerHTML=`
  <div class="filter-back-row"><button class="secondary" onclick="openMapMenu()">← Map Controls</button></div>
  <div class="card filter-section-card">
    <div class="filter-section-heading">Map Toggles</div>
    <div class="filter-grid-actions">
      <button class="secondary" onclick="toggleAllMapLayers(true)">All On</button>
      <button class="secondary" onclick="toggleAllMapLayers(false)">All Off</button>
      <button class="secondary" onclick="toggleAssetLayersOnly()">Assets Only</button>
      <button class="secondary" onclick="toggleOverlayLayersOnly()">Overlays Only</button>
    </div>
    <div class="compact-filter map-toggle-list">
      <label class="check-item"><input type="checkbox" id="mapShowPoles" data-map-toggle="poles" ${mapToggleSettings.poles?"checked":""}> Points</label>
      <label class="check-item"><input type="checkbox" id="mapShowTowers" data-map-toggle="towers" ${mapToggleSettings.towers?"checked":""}> Structures</label>
      <label class="check-item"><input type="checkbox" id="mapShowSubs" data-map-toggle="substations" ${mapToggleSettings.substations?"checked":""}> Sites</label>
      <label class="check-item"><input type="checkbox" id="mapShowDepots" data-map-toggle="depots" ${mapToggleSettings.depots?"checked":""}> Bases</label>
      <label class="check-item"><input type="checkbox" id="mapShowDots" data-map-toggle="dots" ${mapToggleSettings.dots?"checked":""}> Asset dots / markers</label>
      <label class="check-item"><input type="checkbox" id="mapShowLines" data-map-toggle="lines" ${mapToggleSettings.lines?"checked":""}> Route paths</label>
      <label class="check-item"><input type="checkbox" id="mapShowTrueGps" data-map-toggle="trueGps" ${mapToggleSettings.trueGps!==false?"checked":""}> True GPS dots</label>
      <label class="check-item"><input type="checkbox" id="mapShowNoGpsEstimates" data-map-toggle="noGpsEstimates" ${mapToggleSettings.noGpsEstimates!==false?"checked":""}> Yellow no-GPS estimates</label>
      <label class="check-item"><input type="checkbox" id="mapShowGapEstimates" data-map-toggle="gapEstimates" ${mapToggleSettings.gapEstimates!==false?"checked":""}> Orange inferred missing-number estimates</label>
    </div>
    <div class="help">Changes apply instantly. Orange inferred missing-number estimates are OFF by default because they are not source data and can make lines look wrong.</div>
  </div>

  <div class="card filter-section-card">
    <div class="filter-section-heading">Map Overlays</div>
    <div class="compact-filter map-toggle-list">
      <label class="check-item"><input type="checkbox" id="mapShowSelected" data-map-toggle="selected" ${mapToggleSettings.selected?"checked":""}> Selected marker</label>
      <label class="check-item"><input type="checkbox" id="mapShowRadius" data-map-toggle="radius" ${mapToggleSettings.radius?"checked":""}> 3 km radius results</label>
      <label class="check-item"><input type="checkbox" id="mapShowBreadcrumb" data-map-toggle="breadcrumb" ${mapToggleSettings.breadcrumb?"checked":""}> Breadcrumb trail</label>
      <label class="check-item"><input type="checkbox" id="mapShowTools" data-map-toggle="tools" ${mapToggleSettings.tools!==false?"checked":""}> Measure / tool markers</label>
      <label class="check-item"><input type="checkbox" id="mapShowLocation" data-map-toggle="location" ${mapToggleSettings.location!==false?"checked":""}> My GPS marker</label>
    </div>
  </div>

  <div class="card filter-section-card">
    <div class="filter-section-heading">Interface</div>
    <div class="compact-filter">
      <label class="check-item"><input type="checkbox" id="showStats" data-display-toggle="stats" ${displaySettings.stats?"checked":""}> Status strip</label>
      <label class="check-item"><input type="checkbox" id="showCompass" data-display-toggle="compass" ${displaySettings.compass?"checked":""}> Compass</label>
      <label class="check-item"><input type="checkbox" id="showSideButtons" data-display-toggle="sideButtons" ${displaySettings.sideButtons?"checked":""}> Side buttons</label>
      <label class="check-item"><input type="checkbox" id="showFab" data-display-toggle="fab" ${displaySettings.fab?"checked":""}> Orange + button</label>
    </div>
    <div class="actions">
      <button class="secondary" onclick="resetDisplaySettings()">Reset</button>
    </div>
  </div>`;
  bindInstantFilterToggles();
}

function bindInstantFilterToggles(){
  document.querySelectorAll('[data-map-toggle]').forEach(el=>{
    el.addEventListener('change',()=>setMapToggle(el.dataset.mapToggle,el.checked));
  });
  document.querySelectorAll('[data-display-toggle]').forEach(el=>{
    el.addEventListener('change',()=>setDisplayToggle(el.dataset.displayToggle,el.checked));
  });
}
