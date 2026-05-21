/* Safe export helper for Chrome/PWA/Spck/HTML editor WebViews. v3.8.7 */
(function(){
  let currentUrl=null;
  let currentText='';
  let currentName='export.json';
  let currentMime='application/json';

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function revokeCurrent(){try{if(currentUrl)URL.revokeObjectURL(currentUrl);}catch(e){} currentUrl=null;}
  function blobFor(text,mime){return new Blob([text],{type:mime||'application/octet-stream'});}
  function looksLikeEmbeddedEditor(){
    const ua=String(navigator.userAgent||'');
    return /; wv\)|Version\/\d+\.\d+ Chrome\/|Spck|Code Editor|HTML Viewer|WebView/i.test(ua) || !!window.__forceSafeExportPanel;
  }
  function tryAnchorDownload(name,text,mime){
    try{
      const blob=blobFor(text,mime);
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=name;
      a.rel='noopener';
      a.style.position='fixed';
      a.style.left='-9999px';
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{try{URL.revokeObjectURL(url);a.remove();}catch(e){}},1600);
      return true;
    }catch(e){return false;}
  }
  function ensureSheet(){
    let sheet=document.getElementById('safeExportSheet');
    if(sheet)return sheet;
    sheet=document.createElement('div');
    sheet.id='safeExportSheet';
    sheet.className='safe-export-sheet';
    sheet.innerHTML=`
      <div class="safe-export-card">
        <div class="safe-export-head">
          <div><b id="safeExportTitle">Export ready</b><span id="safeExportSub">Use download, open, or copy if your editor blocks file saving.</span></div>
          <button type="button" onclick="closeSafeExportSheet()">×</button>
        </div>
        <div class="safe-export-body">
          <div class="safe-export-file" id="safeExportFileName"></div>
          <div class="safe-export-actions">
            <a id="safeExportDownload" class="safe-export-link" href="#" download>Download file</a>
            <a id="safeExportOpen" class="safe-export-link secondary" href="#" target="_blank" rel="noopener">Open text</a>
            <button type="button" class="secondary" onclick="copySafeExportText()">Copy JSON</button>
            <button type="button" class="secondary" onclick="toggleSafeExportText()">Show text</button>
          </div>
          <div class="safe-export-help">Spck / HTML editor WebViews can block normal downloads. If the file does not appear, press <b>Copy JSON</b>, create a new .json file in Spck, then paste and save.</div>
          <textarea id="safeExportTextarea" readonly spellcheck="false" style="display:none"></textarea>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    return sheet;
  }
  function showSheet(name,text,mime,opts){
    revokeCurrent();
    currentName=name||'export.json';
    currentText=String(text??'');
    currentMime=mime||'application/json';
    currentUrl=URL.createObjectURL(blobFor(currentText,currentMime));
    const sheet=ensureSheet();
    const title=document.getElementById('safeExportTitle');
    const sub=document.getElementById('safeExportSub');
    const fn=document.getElementById('safeExportFileName');
    const dl=document.getElementById('safeExportDownload');
    const op=document.getElementById('safeExportOpen');
    const ta=document.getElementById('safeExportTextarea');
    if(title)title.textContent=(opts&&opts.title)||'Export ready';
    if(sub)sub.textContent=(opts&&opts.sub)||'Download attempted. Use copy/open if Spck or the HTML editor blocks it.';
    if(fn)fn.innerHTML=`<b>${esc(currentName)}</b><span>${(currentText.length/1024).toFixed(currentText.length>1024*1024?1:0)} KB</span>`;
    if(dl){dl.href=currentUrl;dl.download=currentName;}
    if(op){op.href=currentUrl;}
    if(ta){ta.value='';ta.style.display='none';}
    sheet.classList.add('show');
  }
  async function copyText(text){
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.position='fixed';
    ta.style.top='0';
    ta.style.left='-9999px';
    document.body.appendChild(ta);
    ta.focus();ta.select();
    const ok=document.execCommand('copy');
    ta.remove();
    return ok;
  }
  window.safeExportText=function safeExportText(name,text,mime,opts){
    const s=String(text??'');
    const m=mime||'application/json';
    const n=name||'export.json';
    const attempted=tryAnchorDownload(n,s,m);
    // Always show a manual-save panel on embedded editors. Also show for corrected/export JSON because Android WebViews often lie about downloads.
    if(looksLikeEmbeddedEditor() || (opts&&opts.forcePanel!==false)) showSheet(n,s,m,opts||{});
    return attempted||true;
  };
  window.safeExportJSON=function safeExportJSON(name,data,opts){
    return window.safeExportText(name,JSON.stringify(data,null,2),'application/json',opts||{});
  };
  window.closeSafeExportSheet=function closeSafeExportSheet(){
    const sheet=document.getElementById('safeExportSheet');
    const ta=document.getElementById('safeExportTextarea');
    if(sheet)sheet.classList.remove('show');
    if(ta){ta.value='';ta.style.display='none';}
    currentText='';
    setTimeout(revokeCurrent,250);
  };
  window.copySafeExportText=async function copySafeExportText(){
    try{
      const ok=await copyText(currentText||'');
      if(ok)showToolStatus?.('Export JSON copied. Paste it into a .json file in Spck.');
      else alert('Copy failed. Use Show text, select all, then copy.');
    }catch(e){alert('Copy failed. Use Show text, select all, then copy.');}
  };
  window.toggleSafeExportText=function toggleSafeExportText(){
    const ta=document.getElementById('safeExportTextarea');
    if(!ta)return;
    const willShow=ta.style.display==='none'||!ta.style.display;
    if(willShow){ta.value=currentText||'';ta.style.display='block';setTimeout(()=>{try{ta.focus();ta.select();}catch(e){}},50);}
    else{ta.style.display='none';ta.value='';}
  };
})();
