(() => {
  "use strict";
  const labels={principal:"Principal",atual:"Atual",minimalista:"Minimalista"};
  const desc={
    principal:"Melhor equilíbrio entre descoberta, leitura, identidade e densidade.",
    atual:"Experiência atual preservada para comparação e retorno seguro.",
    minimalista:"Minimalismo extremo: somente o essencial."
  };
  let settings=null, observer=null, busy=false;

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=v=>String(v||"").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"bloco";
  const params=()=>new URLSearchParams(location.search);
  const pageKey=()=>{
    const p=params(), page=p.get("pagina")||(p.get("ler")?"leitor":"home");
    if(page==="entidade") return "entidade-"+norm(p.get("tipo")||"geral");
    if(page==="faccoes") return "faccoes";
    return norm(page);
  };
  const root=()=>document.querySelector("#main");
  const isAdmin=()=>["admin","banca"].includes(String(window.__BANCA_PROFILE__?.plan||"").toLowerCase());

  async function sb(){
    if(window.BancaSupabaseClient)return window.BancaSupabaseClient;
    if(!window.supabase?.createClient||!window.BANCA_SUPABASE_URL||!window.BANCA_SUPABASE_KEY)return null;
    if(!sb.instance)sb.instance=window.supabase.createClient(window.BANCA_SUPABASE_URL,window.BANCA_SUPABASE_KEY);
    return sb.instance;
  }
  async function load(){
    const c=await sb(); if(!c)return;
    const r=await c.from("site_layout_settings").select("id,active_version,presets,overrides,updated_at").eq("id",true).maybeSingle();
    if(!r.error&&r.data)settings=r.data;
  }
  const PAGE_LABELS = {
    home:"Início", comic:"Quadrinhos", manga:"Mangás", search:"Pesquisa", series:"Série",
    entity:"Entidade", ranking:"Ranking", factions:"Facções", collections:"Coleções",
    collection:"Coleção", downloads:"Downloads", "local-box":"Minha caixa", album:"Álbum",
    "public-profile":"Perfil público", messages:"Mensagens", notifications:"Notificações",
    "community-activity":"Atividade", login:"Login", signup:"Cadastro", leitor:"Leitor",
    "password-reset":"Redefinir senha"
  };

  function blockLabel(el){
    const h=el.querySelector(":scope > h1,:scope > h2,:scope > h3,:scope > .section-title,:scope > .section-head strong");
    return String(h?.textContent||el.getAttribute("aria-label")||el.dataset.section||"Seção").replace(/\\s+/g," ").trim()||"Seção";
  }

  function blocks(){
    const r=root(); if(!r)return[];
    const result=[], seen=new Set();
    const add=(el,parent,index,parentKey="")=>{
      if(!el||seen.has(el)||el.matches(".layout-admin-panel,.site-layout-manager"))return;
      seen.add(el);
      const label=blockLabel(el), base=norm(label);
      const key=el.dataset.layoutKey||(parentKey?parentKey+"/"+base:base)+(result.some(x=>x.key===(parentKey?parentKey+"/"+base:base))?"-"+index:"");
      el.dataset.layoutKey=key; el.dataset.layoutLabel=label;
      result.push({el,parent,key,label,index,parentKey});
    };
    [...r.children].forEach((child,index)=>{
      if(child.matches(".layout-admin-panel,.site-layout-manager"))return;
      const nested=[...child.children].filter(el=>el.matches(".section,section,.profile-section,.shelf-section,.reader-section,[data-layout-section]"));
      if(nested.length>=2) nested.forEach((el,i)=>add(el,child,i,child.dataset.layoutKey||norm(blockLabel(child))));
      else add(child,r,index);
    });
    return result;
  }

  const rules=(version,page)=>(settings?.overrides?.[version]?.[page]||{});
  function minimalHidden(b,i,total){
    if((settings?.active_version||"principal")!=="minimalista")return false;
    const s=(b.label+" "+b.key).toLocaleLowerCase("pt-BR");
    return /dica|curiosidade|aleatori|atividade|estatíst|relacionad|fanart|notíci|wiki rápida|informações extras|detalhes/.test(s)
      || (total>7&&i>=5);
  }

  function apply(){
    if(busy)return; const r=root(); if(!r)return; busy=true;
    const version=settings?.active_version||"principal", page=pageKey(), rs=rules(version,page), bs=blocks();
    const principalOrder=/^(hero|destaque|continue|novidade|resultado|serie|série|ediç|estante|salvo|coleç|personagem|autor|editora|selo|mural|lista|álbum|figurinha|coment|atividade|notíci|relacionad|wiki|filtro)/i;
    document.documentElement.dataset.siteLayoutVersion=version; r.dataset.layoutPage=page;
    bs.forEach((b,i)=>{
      const x=rs[b.key]||{}, hidden=x.hidden===true||minimalHidden(b,i,bs.length);
      b.el.hidden=hidden; b.el.dataset.layoutHidden=hidden?"true":"false";
      const h=b.el.querySelector("h1,h2,h3,.section-title");
      if(h&&x.label)h.textContent=x.label;
      const autoOrder=version==="principal"?(principalOrder.test(b.label)?b.label.toLocaleLowerCase("pt-BR").includes("hero")||b.label.toLocaleLowerCase("pt-BR").includes("destaque")?5:20:80):i;
      b.el.style.order=Number.isFinite(Number(x.order))?String(x.order):String(autoOrder);
    });
    bs.slice().sort((a,b)=>{
      const ao=Number(rs[a.key]?.order),bo=Number(rs[b.key]?.order);
      return(Number.isFinite(ao)?ao:a.index)-(Number.isFinite(bo)?bo:b.index);
    }).forEach(b=>r.appendChild(b.el));
    r.classList.toggle("site-layout-minimal",version==="minimalista");
    r.classList.toggle("site-layout-principal",version==="principal");
    r.classList.toggle("site-layout-atual",version==="atual");
    busy=false;
  }

  function manager(){
    if(!isAdmin())return;
    const ov=document.createElement("div");ov.className="modal-backdrop";
    ov.innerHTML='<div class="modal site-layout-manager"><div class="section-head"><div><div class="eyebrow">Arquitetura visual</div><h2>Gerenciar versões do site</h2><div class="section-subtitle">Escolha a versão ativa e configure cada página bloco por bloco.</div></div><button class="small-btn" data-close>Fechar</button></div><div class="layout-version-grid">'+Object.keys(labels).map(v=>'<button type="button" class="layout-version-card" data-version="'+v+'"><strong>'+labels[v]+'</strong><span>'+desc[v]+'</span></button>').join("")+'</div><div class="layout-manager-toolbar"><label class="field"><span>Página</span><select data-page></select></label><button type="button" class="small-btn" data-refresh>Atualizar</button><button type="button" class="small-btn" data-reset>Restaurar página</button></div><div class="layout-manager-list" data-list></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="button" class="btn btn-danger" data-save>Salvar</button></div></div>';
    document.querySelector("#modal-root")?.appendChild(ov);
    let version=settings?.active_version||"principal", page=pageKey(), draft=structuredClone(settings?.overrides||{});
    const select=ov.querySelector("[data-page]"),list=ov.querySelector("[data-list]");
    const PAGE_LABELS={home:"Início",comic:"Quadrinhos",manga:"Mangás",search:"Pesquisa",series:"Série",entity:"Entidades",ranking:"Ranking",factions:"Facções",collections:"Coleções",collection:"Coleção",downloads:"Downloads","local-box":"Minha caixa",album:"Álbum","public-profile":"Perfil público",messages:"Mensagens",notifications:"Notificações","community-activity":"Atividade",login:"Login",signup:"Cadastro",leitor:"Leitor","password-reset":"Redefinir senha"};
    const pages=()=>[...new Set([...Object.keys(PAGE_LABELS),pageKey(),...Object.values(draft).flatMap(x=>Object.keys(x||{}))])].sort((a,b)=>(PAGE_LABELS[a]||a).localeCompare(PAGE_LABELS[b]||b,"pt-BR"));
    const renderList=()=>{
      select.innerHTML=pages().map(p=>'<option value="'+esc(p)+'">'+esc(p)+'</option>').join("");select.value=page;
      const rs=draft?.[version]?.[page]||{},bs=blocks();
      if(page!==pageKey()){list.innerHTML='<div class="empty">Abra esta página no site para descobrir e editar os blocos reais dela. A configuração desta página pode ser salva quando ela estiver aberta.</div>';return;}
      list.innerHTML=bs.map(b=>{const x=rs[b.key]||{};return '<article class="layout-manager-row" data-key="'+esc(b.key)+'"><div><strong>'+esc(b.label)+'</strong><small>'+esc(b.key)+'</small></div><input type="text" maxlength="80" value="'+esc(x.label||"")+'" placeholder="Nome opcional"><label><input type="checkbox" '+(x.hidden?"checked":"")+'> Ocultar</label><div class="layout-order"><button type="button" data-move="-1">↑</button><button type="button" data-move="1">↓</button></div></article>';}).join("")||'<div class="empty">Nenhum bloco encontrado.</div>';
      const pageRules=draft[version]||(draft[version]={});const current=pageRules[page]||(pageRules[page]={});
      list.querySelectorAll("[data-key]").forEach(row=>{
        const key=row.dataset.key, input=row.querySelector("input[type=text]"),check=row.querySelector("input[type=checkbox]");
        input.oninput=()=>{const x=current[key]||(current[key]={});if(input.value.trim())x.label=input.value.trim();else delete x.label;};
        check.onchange=()=>{const x=current[key]||(current[key]={});x.hidden=check.checked;};
        row.querySelectorAll("[data-move]").forEach(btn=>btn.onclick=()=>{
          const order=bs.map((b,i)=>({key:b.key,order:Number.isFinite(Number(current[b.key]?.order))?Number(current[b.key].order):i}));
          const pos=order.findIndex(x=>x.key===key),to=pos+Number(btn.dataset.move);if(to<0||to>=order.length)return;
          const a=order[pos],b=order[to];(current[a.key]||(current[a.key]={})).order=b.order;(current[b.key]||(current[b.key]={})).order=a.order;renderList();
        });
      });
    };
    ov.querySelectorAll("[data-version]").forEach(b=>b.onclick=()=>{version=b.dataset.version;ov.querySelectorAll("[data-version]").forEach(x=>x.classList.toggle("is-active",x.dataset.version===version));renderList();});
    select.onchange=()=>{page=select.value;renderList();};
    ov.querySelector("[data-refresh]").onclick=renderList;
    ov.querySelector("[data-reset]").onclick=()=>{if(draft[version])delete draft[version][page];renderList();};
    ov.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>ov.remove());
    ov.querySelector("[data-save]").onclick=async()=>{
      const c=await sb();if(!c)return alert("Supabase não está disponível.");
      const r=await c.from("site_layout_settings").update({active_version:version,overrides:draft,updated_at:new Date().toISOString()}).eq("id",true);
      if(r.error)return alert(r.error.message);
      settings={...settings,active_version:version,overrides:draft};apply();ov.remove();window.dispatchEvent(new CustomEvent("banca-layout-updated"));
    };
    ov.addEventListener("click",e=>{if(e.target===ov)ov.remove()});
    renderList();
  }

  async function init(){
    await load();apply();
    const r=root();if(r){observer?.disconnect();observer=new MutationObserver(()=>requestAnimationFrame(apply));observer.observe(r,{childList:true});}
    window.BancaSiteLayout={openManager:manager,reload:async()=>{await load();apply();}};
    if(isAdmin())document.querySelectorAll('[data-action="open-admin"]').forEach(b=>{if(b.dataset.layoutBound)return;b.dataset.layoutBound="true";b.addEventListener("dblclick",manager);});
  }
  setTimeout(init,0);
})();