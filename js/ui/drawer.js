/* Shared drawer/page open-close helpers. */
function setActive(id){document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.remove("active"));document.getElementById(id)?.classList.add("active")}
function drawer(){return document.getElementById("drawer")}
function body(){return document.getElementById("body")}
function openDrawer(menu,tabId,renderFn){closePlus();closeSettings();closePOI();if(typeof closeAssetIndex==='function')closeAssetIndex();document.body.classList.add('drawer-open');document.body.classList.remove('settings-open','poi-open');if(menu!=="search" && typeof removeSearchKeyboard==="function")removeSearchKeyboard();if(currentMenu===menu&&drawer().classList.contains("open")){closeDrawer();document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));return}currentMenu=menu;setActive(tabId);drawer().classList.remove("keyboard-open","search-drawer");drawer().classList.add("open");renderFn()}
function closeDrawer(){drawer().classList.remove("open","keyboard-open","search-drawer");document.body.classList.remove('drawer-open');if(typeof removeSearchKeyboard==="function")removeSearchKeyboard();currentMenu=null}
function closeSettings(){if(typeof showSettingsHome==="function")showSettingsHome();document.getElementById("settingsPage")?.classList.remove("open");document.body.classList.remove('settings-open')}
function closePlus(){document.getElementById("plusSheet").classList.remove("open");document.body.classList.remove('plus-open');document.querySelector(".fab")?.classList.remove("active")}
function closePOI(){document.getElementById("poiPage").classList.remove("open");document.body.classList.remove('poi-open')}
function closeAll(){closePlus();closeSettings();closePOI();if(typeof closeAssetIndex==='function')closeAssetIndex();closeHeliPatrol();if(typeof closeGroundPatrol==='function')closeGroundPatrol();closeDrawer()}
function head(t,s){document.getElementById("dTitle").innerText=t;document.getElementById("dSub").innerText=s}
