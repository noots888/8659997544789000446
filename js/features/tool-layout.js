/* v3.8.7 custom Map Controls / Map Tools button layout */
const TOOL_LAYOUT_KEY='asset_tracker_v385_tool_layout_controls';
const TOOL_LAYOUT_DEFAULT=['viewArea','clear','filter','corrections','crossings','displayAll'];
const TOOL_LAYOUT_MAX=6;

const TOOL_ACTIONS=[
  {id:'viewArea',label:'View Area',short:'View Area',sub:'Assets in window',style:'primary',toolClass:'green',icon:'▣'},
  {id:'clear',label:'Clear',short:'Clear',sub:'Remove markers',style:'amber',toolClass:'sun',icon:'⌫'},
  {id:'filter',label:'Filter',short:'Filter',sub:'Layer toggles',style:'teal',toolClass:'teal',icon:'◉'},
  {id:'corrections',label:'Corrections',short:'Corrections',sub:'Edit assets',style:'primary',toolClass:'green',icon:'✎'},
  {id:'crossings',label:'Crossings',short:'Crossings',sub:'Line check',style:'amber',toolClass:'sun',icon:'✕'},
  {id:'displayAll',label:'Display All',short:'Display All',sub:'Asset groups',style:'danger',toolClass:'redbtn',icon:'☷'},
  {id:'measure',label:'Measure',short:'Measure',sub:'Two point measure',style:'brown',toolClass:'brown',icon:'↔'},
  {id:'multi',label:'Multi Measure',short:'Multi',sub:'Measure a path',style:'brown',toolClass:'brown',icon:'⌁'},
  {id:'radius',label:'3 km Radius',short:'3 km',sub:'Nearby assets',style:'primary',toolClass:'green',icon:'◎'},
  {id:'poi',label:'POI',short:'POI',sub:'Save current GPS',style:'amber',toolClass:'sun',icon:'◆'},
  {id:'breadcrumb',label:'Breadcrumb',short:'Breadcrumb',sub:'GPS trail',style:'teal',toolClass:'teal',icon:'⋯'},
  {id:'patrol',label:'Patrol',short:'Patrol',sub:'GPS overlay',style:'primary',toolClass:'purple',icon:'⌖'}
];

function toolActionById(id){return TOOL_ACTIONS.find(x=>x.id===id);}
function cleanToolLayout(arr){
  const ids=new Set(TOOL_ACTIONS.map(x=>x.id));
  const out=[];
  (Array.isArray(arr)?arr:[]).forEach(id=>{if(ids.has(id)&&!out.includes(id)&&out.length<TOOL_LAYOUT_MAX)out.push(id);});
  if(!out.length)return TOOL_LAYOUT_DEFAULT.slice();
  return out;
}
function getToolLayoutControls(){
  try{return cleanToolLayout(JSON.parse(localStorage.getItem(TOOL_LAYOUT_KEY)||'null'));}
  catch(e){return TOOL_LAYOUT_DEFAULT.slice();}
}
function saveToolLayoutControls(ids){
  const clean=cleanToolLayout(ids);
  try{localStorage.setItem(TOOL_LAYOUT_KEY,JSON.stringify(clean));}catch(e){}
  renderToolLayoutSettings();
  if(document.getElementById('drawer')?.classList.contains('open') && document.getElementById('dTitle')?.textContent==='Map') renderMapMenu();
  renderCustomPlusGrid();
  refreshCustomToolActiveStates();
}
function resetToolLayoutControls(){saveToolLayoutControls(TOOL_LAYOUT_DEFAULT.slice()); showToolStatus?.('Button layout reset');}
function toggleToolLayoutButton(id){
  const cur=getToolLayoutControls();
  if(cur.includes(id)){
    saveToolLayoutControls(cur.filter(x=>x!==id));
    return;
  }
  if(cur.length>=TOOL_LAYOUT_MAX){
    alert('Map Controls can hold 6 buttons. Move one back to Map Tools first.');
    return;
  }
  saveToolLayoutControls([...cur,id]);
}
function moveToolLayoutButton(id,dir){
  const cur=getToolLayoutControls();
  const i=cur.indexOf(id);
  if(i<0)return;
  const j=i+dir;
  if(j<0||j>=cur.length)return;
  [cur[i],cur[j]]=[cur[j],cur[i]];
  saveToolLayoutControls(cur);
}
function runToolAction(id,ev){
  try{
    if(id==='viewArea')return viewCurrentMapArea();
    if(id==='clear')return clearSelected();
    if(id==='filter')return openFilter();
    if(id==='corrections')return openDataCorrections();
    if(id==='crossings'){toggleLineCrossings(); refreshMapControlState?.(); return;}
    if(id==='displayAll')return openDisplayAllMenu();
    if(id==='measure')return toggleMeasureTool();
    if(id==='multi')return toggleMultiMeasureTool();
    if(id==='radius')return toggleRadiusLines();
    if(id==='poi')return openPOIAtGPS();
    if(id==='breadcrumb')return toggleBreadcrumbs();
    if(id==='patrol')return togglePatrolOverlayFromMenu(ev||window.event);
  }catch(e){alert('Tool failed: '+(e.message||e));}
}
function mapToolButtonHTML(a){
  const subId=a.id==='crossings'?' id="lineCrossingsSub"':'';
  const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${a.id}"`:'';
  return `<button class="premium-action-card ${a.style}"${dataTool} onclick="runToolAction('${a.id}',event)"><i>${a.icon}</i><b>${a.label}</b><span${subId}>${a.sub}</span></button>`;
}
function plusToolButtonHTML(a){
  const dataTool=['measure','multi','radius','breadcrumb','crossings','patrol'].includes(a.id)?` data-tool="${a.id}"`:'';
  return `<button class="${a.toolClass||'green'} tool-btn"${dataTool} onclick="runToolAction('${a.id}',event);closePlus()"><span class="tool-emoji">${a.icon}</span>${a.short}</button>`;
}
function renderMapMenu(){
  const controls=getToolLayoutControls();
  const buttons=controls.map(id=>toolActionById(id)).filter(Boolean).map(mapToolButtonHTML).join('');
  head('Map','Controls');
  body().innerHTML=`
    <div class="premium-map-menu compact-map-controls custom-map-controls">
      <div class="compact-control-title"><b>Map controls</b><span>${controls.length}/${TOOL_LAYOUT_MAX} quick buttons selected</span></div>
      <div class="compact-control-grid custom-control-grid">${buttons}</div>
      <button class="layout-link-btn" onclick="openSettingsSectionFromMapTools()">Change button layout</button>
    </div>`;
  refreshCustomToolActiveStates();
}
function openSettingsSectionFromMapTools(){
  closeDrawer?.();
  if(typeof toggleSettings==='function' && !document.getElementById('settingsPage')?.classList.contains('open')) toggleSettings();
  setTimeout(()=>openSettingsSection('toolLayout'),80);
}
function renderCustomPlusGrid(){
  const grid=document.querySelector('#plusSheet .plus-grid');
  if(!grid)return;
  const controls=getToolLayoutControls();
  const tools=TOOL_ACTIONS.filter(a=>!controls.includes(a.id));
  grid.innerHTML=tools.map(plusToolButtonHTML).join('') || '<div class="tool-layout-empty">All quick buttons are in Map Controls.</div>';
  const title=document.querySelector('#plusSheet .plus-title');
  if(title)title.textContent='+ Map Tools';
  refreshCustomToolActiveStates();
}
function isCustomToolActive(id){
  try{
    if(id==='measure')return !!measureOn;
    if(id==='multi')return !!multiMeasureOn;
    if(id==='radius')return !!radiusOn;
    if(id==='breadcrumb')return !!breadcrumbOn;
    if(id==='crossings')return !!crossingsEnabled;
    if(id==='patrol')return document.getElementById('heliPage')?.classList.contains('open');
  }catch(e){}
  return false;
}
function refreshCustomToolActiveStates(){
  document.querySelectorAll('[data-tool]').forEach(btn=>btn.classList.toggle('tool-active',isCustomToolActive(btn.dataset.tool)));
  const sub=document.getElementById('lineCrossingsSub');
  if(sub)sub.textContent=crossingsEnabled?'Shown on map':'Line check';
  const any=['measure','multi','radius','breadcrumb','crossings','patrol'].some(isCustomToolActive);
  document.querySelector('.fab')?.classList.toggle('has-active-tool',any);
}
function refreshMapControlState(){refreshCustomToolActiveStates();}
function renderToolLayoutSettings(){
  const box=document.getElementById('toolLayoutSettings');
  if(!box)return;
  const controls=getToolLayoutControls();
  const count=controls.length;
  box.innerHTML=`
    <div class="tool-layout-panel">
      <div class="tool-layout-summary"><b>${count}/${TOOL_LAYOUT_MAX} in Map Controls</b><span>Tap a button to move it between Map Controls and Map Tools. Map Controls is limited to 6.</span></div>
      <div class="tool-layout-list">
        ${TOOL_ACTIONS.map(a=>{
          const inControls=controls.includes(a.id);
          const idx=controls.indexOf(a.id);
          return `<div class="tool-layout-row ${inControls?'in-controls':'in-tools'}">
            <div class="tool-layout-icon">${a.icon}</div>
            <div class="tool-layout-name"><b>${a.label}</b><span>${inControls?'Map Controls':'Map Tools'} · ${a.sub}</span></div>
            <div class="tool-layout-actions">
              ${inControls?`<button onclick="moveToolLayoutButton('${a.id}',-1)" ${idx<=0?'disabled':''}>↑</button><button onclick="moveToolLayoutButton('${a.id}',1)" ${idx<0||idx>=count-1?'disabled':''}>↓</button>`:''}
              <button class="${inControls?'secondary':'green'}" onclick="toggleToolLayoutButton('${a.id}')">${inControls?'Move to Tools':'Move to Controls'}</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="actions"><button class="secondary" onclick="resetToolLayoutControls()">Reset default</button></div>
    </div>`;
}

(function(){
  const oldTogglePlus=window.togglePlus;
  window.togglePlus=function(){renderCustomPlusGrid(); return oldTogglePlus.apply(this,arguments);};
  const oldClosePlus=window.closePlus;
  window.closePlus=function(){const r=oldClosePlus.apply(this,arguments); refreshCustomToolActiveStates(); return r;};
  const oldOpenSettings=window.openSettingsSection;
  window.openSettingsSection=function(section){const r=oldOpenSettings.apply(this,arguments); if(section==='toolLayout')renderToolLayoutSettings(); return r;};
  const oldRefresh=window.refreshToolActiveStates;
  window.refreshToolActiveStates=function(){try{oldRefresh&&oldRefresh();}catch(e){} refreshCustomToolActiveStates();};
  document.addEventListener('DOMContentLoaded',()=>{renderCustomPlusGrid(); refreshCustomToolActiveStates();});
})();
