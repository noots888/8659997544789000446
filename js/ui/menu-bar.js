/* Bottom menu-bar actions only. */
function openSearch(){
  if(typeof openAssetIndex==='function') openAssetIndex();
  else openDrawer("search","tabSearch",renderSearch);
}
function openFilter(){openDrawer("filter","tabMap",renderFilter)}
function openMapMenu(){openDrawer("map","tabMap",renderMapMenu)}
function toggleSettings(){closePlus();closeDrawer();closeAssetIndex?.();closePOI();let p=document.getElementById("settingsPage"),open=p.classList.contains("open");p.classList.toggle("open",!open);document.body.classList.toggle('settings-open',!open);if(open){if(typeof showSettingsHome==="function")showSettingsHome();document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));}else{setActive('tabSettings');if(typeof showSettingsHome==="function")showSettingsHome();renderSettingsStats()}}
function goHome(){
  closeAll();
  document.body.classList.remove('search-keyboard-active','search-keyboard-collapsed','asset-index-open');
  document.getElementById('searchKeyboardDock')?.remove();
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active','home-flash','tap-press'));
  const home=document.getElementById('tabHome');
  if(home){
    home.classList.add('home-flash');
    setTimeout(()=>home.classList.remove('home-flash','active','tap-press'),220);
  }
  setTimeout(()=>document.getElementById('tabHome')?.classList.remove('active','home-flash','tap-press'),320);
}
