/* Core app state, storage keys, and field constants. */
let map, streetLayer, satelliteLayer, googleSatelliteLayer, googleHybridLayer, topoLayer, lightLayer, darkLayer, humanitarianLayer, assetLayer, crossingLayer, radiusLayer, measureLayer, locMarker, selectedMarker;
let selected=null, currentMenu=null, searchMode="assets", searchDisplayMode="line", searchFilters={line:true,poles:false,substations:false,depots:false}, timer=null, satelliteOn=false, baseLayers={}, currentBaseLayerId="street";
let crossingsEnabled=false, radiusOn=false, breadcrumbOn=false, breadcrumbWatchId=null, breadcrumbLayer=null, breadcrumbPoints=[], measureOn=false, multiMeasureOn=false, measureLock=true, measurePts=[], measureLine=null, multiMeasureLine=null;
let allRecords=[], searchIndex=[], lineSearchCache=[], searchIndexBuilding=false, searchIndexReady=false, circuitGroups=[], visibleRecords=[], pois=[], heliMarks=[], heliPhotoTarget=null, heliPhotos={fault:[],defect:[]};
let assetInfoFields=["line","structure","conductor","type","material","height","drawing","gps"];
let displaySettings={stats:false,dots:true,sideButtons:true,compass:true,fab:true};
let mapToggleSettings={poles:true,towers:true,substations:true,depots:true,dots:true,lines:true,trueGps:true,noGpsEstimates:true,gapEstimates:true,selected:true,crossings:true,radius:true,breadcrumb:true,tools:true,location:true};
const KEY="asset_tracker_v35_assets", POI_KEY="asset_tracker_v35_pois", INFO_KEY="asset_tracker_v35_info", DISPLAY_KEY="asset_tracker_v35_display_v272", MAP_TOGGLE_KEY="asset_tracker_v35_map_toggles_v3_7_safe_lines", HELI_KEY="asset_tracker_v35_heli";
const SEARCH_STATE_KEY="asset_tracker_v35_search_state_v1", IMPORT_AUTO_INDEX_KEY="asset_tracker_v35_auto_index_v1", PERF_KEY="asset_tracker_v35_perf_v1", DB_NAME="asset_tracker_v35_db", DB_VERSION=1;
try{localStorage.removeItem(PERF_KEY);localStorage.setItem("asset_tracker_v386_perf_cleanup","1");}catch(e){}
function loadImportAutoIndexDefault(){try{const raw=localStorage.getItem(IMPORT_AUTO_INDEX_KEY);return raw==null?true:JSON.parse(raw)===true;}catch(e){return false;}}
function loadPerformanceSettingsDefault(){
  try{
    const raw=localStorage.getItem(PERF_KEY);
    if(raw){return {...{lowPower:false,crossings:true,maxDots:null,maxPatrolDots:null},...JSON.parse(raw),lowPower:false};}
  }catch(e){}
  return {lowPower:false,crossings:true,maxDots:null,maxPatrolDots:null};
}
let importAutoIndex=loadImportAutoIndexDefault();
let performanceSettings=loadPerformanceSettingsDefault();
const CONDUCTOR_FIELDS=["CONDUCTOR_ID_DESC","STRUNG_SECTION_TYP_ID_DESC","CONDUCTOR","CONDUCTOR_TYPE","CONDUCTOR_DESC","CONDUCTOR_NAME","WIRE_TYPE","WIRE_DESC","CABLE_TYPE","CABLE_DESC","PHASE_CONDUCTOR","PHASE_COND","EARTHWIRE","EARTH_WIRE","EARTHWIRE_DESC"];
const KNOWN=["bear","panther","triton","tritone","neptune","venus","mink","dog","goat","wolf","lynx","rabbit","raccoon","skunk","squirrel","tiger","lion","leopard","fox","ferret","otter","weasel","hare","gopher","beaver","kangaroo","wallaby","moose","zebra","dingo","wasp","fly","gnat","beetle","bee","cricket","locust","butterfly","coyote","pelican","osprey","falcon","hawk","eagle","acsr","aac","aaac","abc","copper","cu","aluminium","aluminum"];
