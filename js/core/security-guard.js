/* Runtime privacy/network guard.
   Purpose: keep imported local files and saved app data on-device.
   Allowed external activity is limited to map tile image loads, explicit Google Maps/Earth buttons,
   and GET-only public Overpass map-feature lookups for Estimate Review auto-align.
*/
(function(){
  'use strict';
  const EXTERNAL_LINKS_KEY='field_map_external_map_links_enabled_v1';
  const allowedExternalOpenHosts=new Set(['www.google.com','google.com','maps.google.com','earth.google.com']);
  const allowedExternalFetchHosts=new Set(['overpass-api.de','lz4.overpass-api.de','z.overpass-api.de','overpass.kumi.systems','overpass.osm.ch','overpass.openstreetmap.ru']);
  const originalFetch=window.fetch ? window.fetch.bind(window) : null;
  const originalOpen=window.open ? window.open.bind(window) : null;
  const originalBeacon=navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
  function parseURL(input){
    try{
      if(input instanceof Request) return new URL(input.url, location.href);
      return new URL(String(input||''), location.href);
    }catch(e){return null;}
  }
  function isSameOrigin(u){return !!u && u.origin===location.origin;}
  function externalLinksEnabled(){
    try{return localStorage.getItem(EXTERNAL_LINKS_KEY)!=='false';}catch(e){return true;}
  }
  function setExternalLinksEnabled(v){
    try{localStorage.setItem(EXTERNAL_LINKS_KEY, v?'true':'false');}catch(e){}
  }
  function blocked(label,url){
    const msg=`Blocked ${label||'network request'}: ${url||'unknown destination'}`;
    try{console.warn('[Privacy Guard]',msg);}catch(e){}
    if(window.showToolStatus) window.showToolStatus(msg);
  }

  function isAllowedMapFeatureFetch(u,method){
    return !!u && u.protocol==='https:' && allowedExternalFetchHosts.has(u.hostname) &&
      (method==='GET'||method==='HEAD') && /\/api\/interpreter$/.test(u.pathname||'');
  }

  if(originalFetch){
    window.fetch=function(input,init){
      const u=parseURL(input);
      const method=String((init&&init.method)||(input instanceof Request&&input.method)||'GET').toUpperCase();
      if(u && !isSameOrigin(u)){
        // Imported data is never posted. Only GET-only public map-feature lookups are allowed for estimate snapping.
        if(isAllowedMapFeatureFetch(u,method))return originalFetch(input,init);
        blocked('external fetch',u.href);
        return Promise.reject(new Error('Privacy Guard blocked external fetch'));
      }
      return originalFetch(input,init);
    };
  }

  if(window.XMLHttpRequest){
    const NativeXHR=window.XMLHttpRequest;
    window.XMLHttpRequest=function(){
      const xhr=new NativeXHR();
      let target=null;
      const open=xhr.open;
      xhr.open=function(method,url){
        target=parseURL(url);
        xhr.__privacyMethod=String(method||'GET').toUpperCase();
        return open.apply(xhr,arguments);
      };
      const send=xhr.send;
      xhr.send=function(){
        if(target && !isSameOrigin(target)){
          blocked('external XHR',target.href);
          throw new Error('Privacy Guard blocked external XHR');
        }
        return send.apply(xhr,arguments);
      };
      return xhr;
    };
  }

  if(originalBeacon){
    navigator.sendBeacon=function(url,data){
      const u=parseURL(url);
      if(u && !isSameOrigin(u)){
        blocked('external beacon',u.href);
        return false;
      }
      return originalBeacon(url,data);
    };
  }

  if(originalOpen){
    window.open=function(url,target,features){
      const u=parseURL(url);
      if(u && !isSameOrigin(u)){
        if(!allowedExternalOpenHosts.has(u.hostname)){
          blocked('external open',u.href);
          return null;
        }
        if(!externalLinksEnabled()){
          alert('External map links are turned off in Settings → Security.');
          return null;
        }
      }
      const safeFeatures=features || 'noopener,noreferrer';
      const win=originalOpen(url,target||'_blank',safeFeatures);
      try{ if(win) win.opener=null; }catch(e){}
      return win;
    };
  }

  document.addEventListener('submit',function(ev){
    const form=ev.target;
    if(!form || !form.action) return;
    const u=parseURL(form.action);
    if(u && !isSameOrigin(u)){
      ev.preventDefault();
      blocked('external form submit',u.href);
    }
  },true);

  window.addEventListener('securitypolicyviolation',function(ev){
    try{console.warn('[CSP blocked]', ev.violatedDirective, ev.blockedURI);}catch(e){}
  });

  window.SecurityGuard={
    version:'3.8.7',
    externalLinksEnabled,
    setExternalLinksEnabled,
    status(){return {
      fetchGuard:!!originalFetch,
      xhrGuard:!!window.XMLHttpRequest,
      beaconGuard:!!originalBeacon,
      externalMapLinks:externalLinksEnabled(),
      allowedExternalOpenHosts:Array.from(allowedExternalOpenHosts),
      allowedExternalFetchHosts:Array.from(allowedExternalFetchHosts),
      localDataStores:['IndexedDB','localStorage','chosen save folder only']
    };}
  };
})();
