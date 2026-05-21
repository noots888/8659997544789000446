/* v3.6.34 Tools menu active highlighting */
function setToolButtonActive(tool,on){
  const btn=document.querySelector(`#plusSheet [data-tool="${tool}"]`);
  if(btn)btn.classList.toggle('tool-active',!!on);
}
function refreshToolActiveStates(){
  setToolButtonActive('measure',!!measureOn);
  setToolButtonActive('multi',!!multiMeasureOn);
  setToolButtonActive('radius',!!radiusOn);
  setToolButtonActive('breadcrumb',!!breadcrumbOn);
  setToolButtonActive('crossings',!!crossingsEnabled);
  setToolButtonActive('patrol',document.getElementById('heliPage')?.classList.contains('open'));
  const anyActive=!!(measureOn||multiMeasureOn||radiusOn||breadcrumbOn||crossingsEnabled||document.getElementById('heliPage')?.classList.contains('open'));
  document.querySelector('.fab')?.classList.toggle('has-active-tool',anyActive);
}
function togglePlus(){
  const p=document.getElementById("plusSheet");
  const f=document.querySelector(".fab");
  if(!p||!f)return;
  if(typeof closeDrawer==='function')closeDrawer();
  if(typeof closeSettings==='function')closeSettings();
  if(typeof closePOI==='function')closePOI();
  const open=p.classList.contains("open");
  p.classList.toggle("open",!open);
  document.body.classList.toggle("plus-open",!open);
  f.classList.toggle("active",!open);
  refreshToolActiveStates();
}
function closePlus(){
  const p=document.getElementById("plusSheet");
  const f=document.querySelector(".fab");
  if(p)p.classList.remove("open");
  document.body.classList.remove('plus-open');
  if(f)f.classList.remove("active");
  refreshToolActiveStates();
}
