export function createReaderAdsFeature({ $, $$, sb, state, escapeHTML, toast, isAdminProfile }) {
  let adsCache = null;
  let adsCacheAt = 0;
  const AD_CACHE_MS = 60000;
  const bucket = "reader-ads";
  const normalize = value => String(value || "").trim().toLocaleLowerCase("pt-BR");
  const nowIso = () => new Date().toISOString();

  const viewerKey = () => {
    const key = "bancaReaderAdViewerKey";
    try {
      let value = localStorage.getItem(key);
      if (!value) { value = crypto.randomUUID(); localStorage.setItem(key, value); }
      return value;
    } catch { return crypto.randomUUID(); }
  };

  async function loadAds(force = false) {
    if (!sb) return [];
    if (!force && adsCache && Date.now() - adsCacheAt < AD_CACHE_MS) return adsCache;
    const result = await sb.from("reader_ads")
      .select("id,name,image_url,image_path,link_url,scope_type,scope_value,position_type,after_page,starts_at,ends_at,is_active,view_count,click_count,created_by,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (result.error) {
      console.warn("Não foi possível carregar propagandas do leitor:", result.error.message);
      return adsCache || [];
    }
    adsCache = result.data || [];
    adsCacheAt = Date.now();
    return adsCache;
  }

  function matchesScope(ad, item) {
    if (!ad || !item) return false;
    if (ad.scope_type === "all") return true;
    if (ad.scope_type === "edition") return String(ad.scope_value) === String(item.id);
    if (ad.scope_type === "series") return String(ad.scope_value) === String(item.seriesId || "");
    if (ad.scope_type === "imprint") return normalize(ad.scope_value) === normalize(item.imprint);
    if (ad.scope_type === "publisher") return normalize(ad.scope_value) === normalize(item.publisher);
    return false;
  }

  function currentlyActive(ad) {
    const now = Date.now();
    return ad?.is_active !== false
      && (!ad.starts_at || new Date(ad.starts_at).getTime() <= now)
      && (!ad.ends_at || new Date(ad.ends_at).getTime() > now);
  }

  async function recordEvent(ad, type, item) {
    if (!sb || !ad?.id) return;
    const result = await sb.from("reader_ad_events").insert({
      ad_id: ad.id,
      event_type: type,
      viewer_key: viewerKey(),
      item_id: String(item?.id || "")
    });
    if (result.error && result.error.code !== "23505") console.warn("Não foi possível registrar métrica da propaganda:", result.error.message);
  }

  function adPage(ad, item, dismiss) {
    const page = document.createElement("div");
    page.className = "reader-ad-page";
    page.dataset.readerAdId = ad.id;
    const media = ad.link_url
      ? `<a class="reader-ad-link" href="${escapeHTML(ad.link_url)}" target="_blank" rel="noopener noreferrer" data-reader-ad-click><img src="${escapeHTML(ad.image_url)}" alt="${escapeHTML(ad.name || "Publicidade")}"></a>`
      : `<img src="${escapeHTML(ad.image_url)}" alt="${escapeHTML(ad.name || "Publicidade")}">`;
    page.innerHTML = `<div class="reader-ad-badge">Publicidade</div><div class="reader-ad-media">${media}</div><div class="reader-ad-footer"><span>${escapeHTML(ad.name || "Publicidade")}</span><button type="button" class="small-btn" data-reader-ad-continue>Continuar leitura</button></div>`;
    $("[data-reader-ad-click]", page)?.addEventListener("click", () => { void recordEvent(ad, "click", item); });
    $("[data-reader-ad-continue]", page)?.addEventListener("click", dismiss);
    return page;
  }

  async function createReaderController(item, body) {
    const ads = (await loadAds()).filter(ad => currentlyActive(ad) && matchesScope(ad, item));
    const seen = new Set();
    const queue = [];
    let showing = false;
    let receivedFirstPage = false;

    const enqueue = ad => {
      if (!ad || seen.has(ad.id) || queue.some(entry => entry.id === ad.id)) return;
      queue.push(ad);
      pump();
    };

    const pump = () => {
      if (showing || !queue.length || !body?.isConnected) return;
      const ad = queue.shift();
      seen.add(ad.id);
      showing = true;
      const page = adPage(ad, item, () => {
        page.remove();
        showing = false;
        pump();
      });
      body.appendChild(page);
      void recordEvent(ad, "view", item);
    };

    return {
      onPageChange(page, total) {
        const currentPage = Number(page) || 0;
        const totalPages = Number(total) || 0;
        if (!receivedFirstPage && currentPage > 0) {
          receivedFirstPage = true;
          ads.filter(ad => ad.position_type === "first").forEach(enqueue);
        }
        ads.forEach(ad => {
          if (ad.position_type === "between" && currentPage > Number(ad.after_page || 0)) enqueue(ad);
          if (ad.position_type === "last" && totalPages > 0 && currentPage >= Math.max(1, totalPages - 1)) enqueue(ad);
        });
      },
      destroy() {
        queue.length = 0;
        showing = false;
        $(".reader-ad-page", body)?.remove();
      }
    };
  }

  function scopeOptions(type) {
    const items = state.db?.library || [];
    const uniq = values => [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    if (type === "publisher") return uniq(items.map(item => item.publisher)).map(value => ({ value, label:value }));
    if (type === "imprint") return uniq(items.map(item => item.imprint)).map(value => ({ value, label:value }));
    if (type === "series") {
      const map = new Map();
      items.forEach(item => { if (item.seriesId) map.set(String(item.seriesId), item.seriesTitle || item.title || item.seriesId); });
      return [...map].map(([value,label]) => ({ value, label:`${label} · ${value}` })).sort((a,b)=>a.label.localeCompare(b.label,"pt-BR"));
    }
    if (type === "edition") {
      return items.map(item => ({
        value:String(item.id),
        label:`${item.seriesTitle || item.title}${item.issue ? ` #${item.issue}` : ""} · ${item.id}`
      })).sort((a,b)=>a.label.localeCompare(b.label,"pt-BR"));
    }
    return [];
  }

  function targetFieldMarkup(type, value = "") {
    if (type === "all") return '<input type="hidden" name="scopeValue" value="">';
    return `<label class="field"><span>Alvo</span><select name="scopeValue" required><option value="">Selecione</option>${scopeOptions(type).map(option => `<option value="${escapeHTML(option.value)}" ${String(value)===option.value?"selected":""}>${escapeHTML(option.label)}</option>`).join("")}</select></label>`;
  }

  async function uploadImage(file) {
    if (!file?.size) throw new Error("Selecione uma imagem.");
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Use JPG, PNG ou WebP.");
    if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
    const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase()||"jpg";
    const path=`${state.session.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const upload=await sb.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});
    if(upload.error) throw upload.error;
    return { path, url:sb.storage.from(bucket).getPublicUrl(path).data.publicUrl };
  }

  function localDateTimeValue(value) {
    if(!value) return "";
    const date=new Date(value);
    return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }

  function openAdForm(existing=null,onDone=null) {
    if(!isAdminProfile()||!sb||!state.session?.user?.id) return;
    const ad=existing||{name:"",scope_type:"all",scope_value:"",position_type:"between",after_page:1,starts_at:nowIso(),ends_at:null,link_url:"",image_url:"",image_path:"",is_active:true};
    const overlay=document.createElement("div");
    overlay.className="modal-backdrop";
    overlay.innerHTML=`<div class="modal reader-ad-admin-modal"><div class="section-head"><div><h2>${existing?"Editar propaganda":"Nova propaganda"}</h2><div class="section-subtitle">Página publicitária inserida no leitor.</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><form id="reader-ad-form"><div class="form-grid">
      <label class="field full"><span>Nome interno</span><input name="name" maxlength="120" required value="${escapeHTML(ad.name||"")}"></label>
      <label class="field full"><span>Imagem</span><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" ${existing?"":"required"}><small class="format-hint">JPG, PNG ou WebP, até 5 MB.</small></label>
      ${ad.image_url?`<div class="field full reader-ad-current-image"><img src="${escapeHTML(ad.image_url)}" alt="Imagem atual"><small>Imagem atual</small></div>`:""}
      <label class="field full"><span>Link ao clicar (opcional)</span><input name="linkUrl" type="url" value="${escapeHTML(ad.link_url||"")}" placeholder="https://..."></label>
      <label class="field"><span>Mostrar em</span><select name="scopeType"><option value="all" ${ad.scope_type==="all"?"selected":""}>Todos os quadrinhos</option><option value="publisher" ${ad.scope_type==="publisher"?"selected":""}>Uma editora</option><option value="imprint" ${ad.scope_type==="imprint"?"selected":""}>Um selo</option><option value="series" ${ad.scope_type==="series"?"selected":""}>Uma série</option><option value="edition" ${ad.scope_type==="edition"?"selected":""}>Uma edição</option></select></label>
      <div data-reader-ad-target>${targetFieldMarkup(ad.scope_type,ad.scope_value)}</div>
      <label class="field"><span>Posição</span><select name="positionType"><option value="first" ${ad.position_type==="first"?"selected":""}>Primeira página</option><option value="between" ${ad.position_type==="between"?"selected":""}>Entre páginas</option><option value="last" ${ad.position_type==="last"?"selected":""}>Última página</option></select></label>
      <label class="field" data-reader-ad-after-page ${ad.position_type==="between"?"":"hidden"}><span>Depois da página</span><input name="afterPage" type="number" min="1" step="1" value="${escapeHTML(ad.after_page||1)}"><small class="format-hint">5 = entre as páginas 5 e 6.</small></label>
      <label class="field"><span>Começa em</span><input name="startsAt" type="datetime-local" required value="${escapeHTML(localDateTimeValue(ad.starts_at||nowIso()))}"></label>
      <label class="field"><span>Duração em dias</span><input name="durationDays" type="number" min="1" step="1" value="${ad.ends_at?Math.max(1,Math.ceil((new Date(ad.ends_at)-new Date(ad.starts_at))/86400000)):""}" placeholder="Sem prazo"><small class="format-hint">Vazio = sem expiração automática.</small></label>
      <label class="field full checkbox-inline"><input name="isActive" type="checkbox" ${ad.is_active!==false?"checked":""}> Campanha ativa</label>
    </div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger" type="submit">Salvar propaganda</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$("[data-close]",overlay).forEach(button=>button.onclick=()=>overlay.remove());
    const form=$("#reader-ad-form",overlay);
    const scopeType=$("[name=scopeType]",form), target=$("[data-reader-ad-target]",form);
    scopeType.onchange=()=>{target.innerHTML=targetFieldMarkup(scopeType.value);};
    const positionType=$("[name=positionType]",form), afterPage=$("[data-reader-ad-after-page]",form);
    positionType.onchange=()=>{afterPage.hidden=positionType.value!=="between";};
    form.onsubmit=async event=>{
      event.preventDefault();
      const submit=form.querySelector('button[type="submit"]');
      submit.disabled=true; submit.textContent="Salvando...";
      let uploaded=null;
      try{
        const fd=new FormData(form);
        const startsAt=new Date(String(fd.get("startsAt"))).toISOString();
        const durationDays=Number(fd.get("durationDays")||0);
        const endsAt=durationDays>0?new Date(new Date(startsAt).getTime()+durationDays*86400000).toISOString():null;
        const imageFile=fd.get("imageFile");
        if(imageFile?.size) uploaded=await uploadImage(imageFile);
        const payload={
          name:String(fd.get("name")||"").trim(),
          image_url:uploaded?.url||ad.image_url,
          image_path:uploaded?.path||ad.image_path||null,
          link_url:String(fd.get("linkUrl")||"").trim()||null,
          scope_type:String(fd.get("scopeType")||"all"),
          scope_value:String(fd.get("scopeType"))==="all"?null:String(fd.get("scopeValue")||"").trim(),
          position_type:String(fd.get("positionType")||"between"),
          after_page:String(fd.get("positionType"))==="between"?Math.max(1,Number(fd.get("afterPage")||1)):null,
          starts_at:startsAt, ends_at:endsAt, is_active:fd.get("isActive")==="on",
          created_by:existing?.created_by||state.session.user.id, updated_at:nowIso()
        };
        if(!payload.image_url) throw new Error("Selecione uma imagem.");
        const result=existing
          ? await sb.from("reader_ads").update(payload).eq("id",existing.id).select().single()
          : await sb.from("reader_ads").insert(payload).select().single();
        if(result.error) throw result.error;
        if(uploaded&&existing?.image_path&&existing.image_path!==uploaded.path) await sb.storage.from(bucket).remove([existing.image_path]);
        adsCache=null; overlay.remove(); toast("Propaganda salva."); onDone?.();
      }catch(error){
        if(uploaded?.path) await sb.storage.from(bucket).remove([uploaded.path]);
        toast(error.message||"Não foi possível salvar a propaganda.");
      }finally{submit.disabled=false;submit.textContent="Salvar propaganda";}
    };
  }

  async function deleteAd(ad,refresh){
    if(!ad||!confirm(`Excluir a propaganda "${ad.name}"?`)) return;
    const result=await sb.from("reader_ads").delete().eq("id",ad.id);
    if(result.error) return toast(result.error.message);
    if(ad.image_path) await sb.storage.from(bucket).remove([ad.image_path]);
    adsCache=null; toast("Propaganda excluída."); refresh?.();
  }

  async function openAdmin(){
    if(!isAdminProfile()||!sb) return toast("Apenas administradores podem gerenciar propagandas.");
    const overlay=document.createElement("div");
    overlay.className="modal-backdrop";
    overlay.innerHTML='<div class="modal admin-modal reader-ad-admin"><div class="section-head"><div><h2>Propagandas do leitor</h2><div class="section-subtitle">Páginas adicionais segmentadas, com prazo e métricas de leitores únicos.</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><div class="reader-ad-admin-body"><div class="empty">Carregando...</div></div></div>';
    $("#modal-root").appendChild(overlay);
    $("[data-close]",overlay).onclick=()=>overlay.remove();
    const renderList=async()=>{
      const ads=await loadAds(true);
      const rows=ads.map(ad=>{
        const ctr=Number(ad.view_count)>0?(Number(ad.click_count)/Number(ad.view_count)*100).toFixed(1):"0.0";
        const scope=ad.scope_type==="all"?"Todos":`${ad.scope_type}: ${ad.scope_value}`;
        const position=ad.position_type==="first"?"Primeira":ad.position_type==="last"?"Última":`Após p. ${ad.after_page}`;
        const expires=ad.ends_at?new Date(ad.ends_at).toLocaleString("pt-BR"):"Sem prazo";
        return `<tr><td><img class="reader-ad-admin-thumb" src="${escapeHTML(ad.image_url)}" alt=""></td><td><b>${escapeHTML(ad.name)}</b><br><small>${escapeHTML(scope)} · ${escapeHTML(position)}</small></td><td>${Number(ad.view_count||0).toLocaleString("pt-BR")}</td><td>${Number(ad.click_count||0).toLocaleString("pt-BR")}<br><small>CTR ${ctr}%</small></td><td>${escapeHTML(expires)}</td><td>${ad.is_active?"Ativa":"Pausada"}</td><td><div class="admin-actions"><button type="button" class="small-btn" data-edit-ad="${ad.id}">Editar</button><button type="button" class="small-btn danger" data-delete-ad="${ad.id}">Excluir</button></div></td></tr>`;
      }).join("");
      const root=$(".reader-ad-admin-body",overlay);
      root.innerHTML=`<div class="admin-actions" style="margin-bottom:15px"><button type="button" class="btn btn-danger" data-new-ad>+ Nova propaganda</button></div><table class="admin-table reader-ad-admin-table"><thead><tr><th>Imagem</th><th>Campanha</th><th>Leitores</th><th>Cliques únicos</th><th>Até</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows||'<tr><td colspan="7">Nenhuma propaganda cadastrada.</td></tr>'}</tbody></table>`;
      $("[data-new-ad]",root).onclick=()=>openAdForm(null,renderList);
      $$("[data-edit-ad]",root).forEach(button=>button.onclick=()=>openAdForm(ads.find(ad=>ad.id===button.dataset.editAd),renderList));
      $$("[data-delete-ad]",root).forEach(button=>button.onclick=()=>deleteAd(ads.find(ad=>ad.id===button.dataset.deleteAd),renderList));
    };
    await renderList();
  }

  return { loadAds, createReaderController, openAdmin };
}
