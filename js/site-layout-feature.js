(() => {
  "use strict";
  const labels={principal:"Principal",atual:"Atual",minimalista:"Minimalista"};
  const desc={
    principal:"Melhor equilíbrio entre descoberta, leitura, identidade e densidade.",
    atual:"Experiência atual preservada para comparação e retorno seguro.",
    minimalista:"Minimalismo extremo: somente o essencial."
  };
  let settings=null, observer=null, busy=false, previewVersion=null, previewPage=null, previewDraft=null;

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
    entity:"Entidades", ranking:"Ranking", factions:"Facções", collections:"Coleções",
    collection:"Coleção", downloads:"Downloads", "local-box":"Minha caixa", album:"Álbum",
    "public-profile":"Perfil público", messages:"Mensagens", notifications:"Notificações",
    "community-activity":"Atividade", login:"Login", signup:"Cadastro", leitor:"Leitor",
    "password-reset":"Redefinir senha"
  };

  const PAGE_BLOCKS = {
    home:[["hero","Destaque principal"],["continue","Continuar lendo"],["recently-opened","Lidos recentemente"],["personalized-recommendations","Dicas para você"],["recently-added","Adicionados recentemente"],["recently-added-series","Séries novas"],["most-clicked","Mais lidos"],["featured-collections-rail","Coleções em destaque"],["imprints","Selos"],["publishers","Editoras"],["characters","Personagens"],["random","Descobrir algo novo"],["activity","Atividade da comunidade"],["news","Notícias e curiosidades"]],
    comic:[["catalog-series","Séries"],["catalog-issues","Edições avulsas"],["imprints","Selos"],["publishers","Editoras"],["authors","Autores"],["characters","Personagens"]],
    manga:[["catalog-series","Séries"],["catalog-issues","Edições avulsas"],["publishers","Editoras"],["authors","Autores"],["characters","Personagens"]],
    search:[["search-controls","Busca e filtros"],["search-results","Resultados"],["search-users","Usuários"],["search-imprints","Selos"],["search-publishers","Editoras"]],
    series:[["series-header","Identidade da série"],["series-editions","Edições"],["series-related","Relacionados"],["series-comments","Comentários"]],
    entity:[["entity-header","Identidade"],["entity-catalog","Edições relacionadas"],["entity-wiki","Informações"],["entity-related","Relacionados"],["entity-news","Notícias e curiosidades"]],
    ranking:[["ranking-header","Ranking"],["ranking-leaderboard","Classificação"],["ranking-benefits","Benefícios"],["ranking-factions","Facções"]],
    factions:[["faction-header","Facção"],["faction-members","Membros"],["faction-ranking","Classificação"],["faction-activity","Atividade"]],
    collections:[["collections-header","Coleções"],["collections-list","Lista de coleções"],["collections-featured","Coleções em destaque"]],
    collection:[["collection-header","Identidade da coleção"],["collection-items","Edições da coleção"]],
    downloads:[["downloads-pending","Baixando"],["downloads-completed","Disponíveis offline"]],
    "local-box":[["local-box-header","Minha caixa"],["local-box-files","Arquivos locais"]],
    album:[["album-header","Álbum"],["album-stickers","Figurinhas"],["album-progress","Progresso"]],
    "public-profile":[["profile-header","Cabeçalho do perfil"],["profile-stats","Estatísticas"],["profile-shelf","Estante"],["profile-achievements","Conquistas"],["profile-album","Álbum"],["profile-activity","Atividade"],["profile-wall","Mural"]],
    messages:[["messages-header","Mensagens"],["messages-list","Conversas"],["messages-compose","Nova mensagem"]],
    notifications:[["notifications-header","Notificações"],["notifications-list","Notificações"]],
    "community-activity":[["community-header","Atividade da comunidade"],["community-list","Atividades"]],
    login:[["login-form","Entrar"],["login-help","Ajuda"]],
    signup:[["signup-form","Criar conta"],["signup-faction","Facção"],["signup-help","Ajuda"]],
    leitor:[["reader-header","Cabeçalho do leitor"],["reader-content","Leitura"],["reader-controls","Controles de leitura"],["reader-metadata","Informações da edição"],["reader-comments","Comentários"],["reader-navigation","Navegação"]],
    "password-reset":[["password-reset-form","Redefinir senha"],["password-reset-help","Ajuda"]]
  };

  const catalogBlocks=page=>(PAGE_BLOCKS[page]||[]).map(([key,label],index)=>({key,label,index,catalog:true}));


  const HOME_CLASS_KEYS={
    "global-recommendations-section":"recommendations",
    "character-banner-home-section":"character-banner",
    "publisher-pinned-section":"pinned-publishers",
    "imprint-pinned-section":"pinned-imprints",
    "character-pinned-section":"pinned-characters",
    "featured-collections-rail":"featured-collections",
    "random-choice-section":"random",
    "personalized-recommendations":"tips",
    "read-artist-recommendations":"artist",
    "best-series-section":"best-series",
    "most-read-cover-section":"most-read-covers",
    "bucho-hidden-section":"bucho-hidden",
    "homepage-banner-section":"editorial-banner",
    "recently-added-series":"new-series"
  };

  const HOME_TITLE_KEYS={
    "escolhas da banca":"recommendations",
    "personagem em destaque":"character-banner",
    "continue de onde parou":"continue",
    "adicionados recentemente":"recent",
    "séries novas":"new-series",
    "mais lidos do mês":"monthly",
    "editoras fixadas":"pinned-publishers",
    "selos fixados":"pinned-imprints",
    "personagens em destaque":"pinned-characters",
    "melhores séries":"best-series",
    "coleções de quadrinhos em destaque":"featured-collections",
    "escolha aleatória":"random",
    "dicas para você":"tips",
    "mais baixados":"downloads",
    "mais lidos":"most-read-covers",
    "edições comidas pelo bucho":"bucho-hidden",
    "em destaque":"editorial-banner"
  };

  function blockLabel(el){
    if(el?.classList?.contains("hero"))return "Destaque da banca";
    const h=el?.querySelector("h1,h2,h3,.section-title");
    const raw=h?.textContent||el?.getAttribute("aria-label")||el?.getAttribute("title")||el?.dataset.section||el?.id||"";
    const cleaned=String(raw).replace(/\s+/g," ").trim();
    if(cleaned&&!/^secao(?:[-\/_]\w+)?$/i.test(cleaned))return cleaned;
    return [...(el?.classList||[])].find(x=>x!=="section"&&x!=="content")||"Seção";
  }

  function stableBlockKey(el,label,page,parentKey){
    const d=String(el?.dataset?.layoutKey||"").trim();
    if(d&&!/^secao(?:[-\/_]\w+)?$/i.test(d)&&d!=="section")return d;
    if(el?.classList?.contains("hero"))return "hero";
    if(page==="home"){
      for(const cls of el.classList)if(HOME_CLASS_KEYS[cls])return HOME_CLASS_KEYS[cls];
      const t=String(label||"").toLocaleLowerCase("pt-BR").trim();
      if(HOME_TITLE_KEYS[t])return HOME_TITLE_KEYS[t];
    }
    const catalog=PAGE_BLOCKS[page]||[];
    for(const cls of el.classList){
      const m=catalog.find(x=>x[0]===cls);
      if(m)return m[0];
    }
    const t=String(label||"").toLocaleLowerCase("pt-BR").trim();
    const m=catalog.find(x=>x[1].toLocaleLowerCase("pt-BR")===t);
    if(m)return m[0];
    const id=String(el?.id||"").trim();
    if(id&&!/^secao(?:[-\/_]\w+)?$/i.test(id))return norm(id);
    const useful=[...(el?.classList||[])].find(x=>x.length>2&&x!=="section"&&x!=="content");
    return useful?norm(useful):norm(label);
  }

  function blocks(){
    const r=root();if(!r)return[];
    const result=[],seen=new Set(),counts=new Map(),page=pageKey(),candidates=[];
    [...r.children].forEach(child=>{
      if(child.matches(".layout-admin-panel,.site-layout-manager"))return;
      if(child.matches(".hero"))candidates.push({el:child,fixed:true});
      else if(child.classList.contains("content"))[...child.children].forEach(el=>{
        if(el.matches(".section,section,[data-layout-section]"))candidates.push({el,fixed:false});
      });
      else if(child.matches(".section,section,[data-layout-section]"))candidates.push({el:child,fixed:false});
    });
    candidates.forEach((item)=>{
      if(seen.has(item.el))return;
      seen.add(item.el);
      const label=blockLabel(item.el),raw=stableBlockKey(item.el,label,page,"");
      const n=(counts.get(raw)||0)+1;counts.set(raw,n);
      const key=n===1?raw:raw+"-"+n;
      item.el.dataset.layoutKey=key;item.el.dataset.layoutLabel=label;
      result.push({el:item.el,key,label,fixed:item.fixed,index:result.length});
    });
    return result;
  }

  const rules=(version,page)=>(settings?.overrides?.[version]?.[page]||{});
  function minimalHidden(version,b,i,total){
    if(version!=="minimalista")return false;
    const s=(b.label+" "+b.key).toLocaleLowerCase("pt-BR");
    return /dica|curiosidade|aleatori|atividade|estatíst|relacionad|fanart|notíci|wiki rápida|informações extras|detalhes/.test(s)
      || (total>7&&i>=5);
  }

  function apply(sourceSettings=settings,forcedVersion=null,forcedPage=null){
    if(busy)return;
    const r=root();if(!r)return;
    busy=true;
    observer?.disconnect();
    try{
      const source=sourceSettings||{};
      const version=forcedVersion||previewVersion||source.active_version||"principal";
      const page=forcedPage||pageKey();
      const rs=source?.overrides?.[version]?.[page]||{};
      const bs=blocks();
      document.documentElement.dataset.siteLayoutVersion=version;
      r.dataset.layoutPage=page;
      const ruleFor=b=>rs[b.key]||rs[norm(b.label)]||{};
      bs.forEach((b,i)=>{
        const x=ruleFor(b);
        const hidden=x.hidden===true||minimalHidden(version,b,i,bs.length);
        b.el.hidden=hidden;
        b.el.dataset.layoutHidden=hidden?"true":"false";
        const h=b.el.querySelector("h1,h2,h3,.section-title");
        if(h&&x.label)h.textContent=x.label;
        if(Number.isFinite(Number(x.order))&&!b.fixed)b.el.style.order=String(x.order);
        else b.el.style.removeProperty("order");
      });
      const movable=bs.filter(b=>!b.fixed);
      const ordered=movable.map((b,i)=>({b,i,o:Number(ruleFor(b).order)})).sort((a,b)=>{
        const ao=Number.isFinite(a.o)?a.o:a.i,bo=Number.isFinite(b.o)?b.o:b.i;return ao-bo;
      });
      if(ordered.some(x=>Number.isFinite(x.o))){
        const parent=ordered[0]?.b.el.parentElement;
        if(parent)ordered.forEach(x=>parent.appendChild(x.b.el));
      }
    }finally{
      busy=false;
      const current=root();
      if(current&&observer)observer.observe(current,{childList:true});
    }
  }

  function manager(){
    const ov=document.createElement("div");ov.className="modal-backdrop";
    ov.innerHTML='<div class="modal site-layout-manager"><div class="section-head"><div><div class="eyebrow">Arquitetura visual</div><h2>Gerenciar versões do site</h2><div class="section-subtitle">Escolha a versão ativa e configure cada página bloco por bloco.</div></div><button class="small-btn" data-close>Fechar</button></div><div class="layout-version-grid">'+Object.keys(labels).map(v=>'<button type="button" class="layout-version-card" data-version="'+v+'"><strong>'+labels[v]+'</strong><span>'+desc[v]+'</span></button>').join("")+'</div><div class="layout-manager-toolbar"><label class="field"><span>Página</span><select data-page></select></label><button type="button" class="small-btn" data-refresh>Atualizar</button><button type="button" class="small-btn" data-reset>Restaurar página</button></div><div class="layout-manager-list" data-list></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="button" class="btn btn-danger" data-save>Salvar</button></div></div>';
    document.querySelector("#modal-root")?.appendChild(ov);
    let version=settings?.active_version||"principal", page=pageKey(), draft=structuredClone(settings?.overrides||{}); previewVersion=version;
    const select=ov.querySelector("[data-page]"),list=ov.querySelector("[data-list]");
    const PAGE_LABELS={home:"Início",comic:"Quadrinhos",manga:"Mangás",search:"Pesquisa",series:"Série",entity:"Entidades",ranking:"Ranking",factions:"Facções",collections:"Coleções",collection:"Coleção",downloads:"Downloads","local-box":"Minha caixa",album:"Álbum","public-profile":"Perfil público",messages:"Mensagens",notifications:"Notificações","community-activity":"Atividade",login:"Login",signup:"Cadastro",leitor:"Leitor","password-reset":"Redefinir senha"};
    const pages=()=>[...new Set([...Object.keys(PAGE_LABELS),pageKey(),...Object.values(draft).flatMap(x=>Object.keys(x||{}))])].sort((a,b)=>(PAGE_LABELS[a]||a).localeCompare(PAGE_LABELS[b]||b,"pt-BR"));
    const renderList=()=>{
      select.innerHTML=pages().map(p=>'<option value="'+esc(p)+'">'+esc(p)+'</option>').join("");select.value=page;
      const rs=draft?.[version]?.[page]||{};
      const livePage=page===pageKey(), bs=livePage?blocks():catalogBlocks(page);
      const sourceNote=livePage?"":'<div class="layout-catalog-note">Estrutura cadastrada para esta página. Ao abrir a página, os blocos reais serão associados automaticamente.</div>';
      list.innerHTML=sourceNote+bs.map(b=>{const x=rs[b.key]||{};return '<article class="layout-manager-row" data-key="'+esc(b.key)+'"><div><strong>'+esc(b.label)+'</strong><small>'+esc(b.key)+'</small></div><input type="text" maxlength="80" value="'+esc(x.label||"")+'" placeholder="Nome opcional"><label><input type="checkbox" '+(x.hidden?"checked":"")+'> Ocultar</label><div class="layout-order"><button type="button" data-move="-1">↑</button><button type="button" data-move="1">↓</button></div></article>';}).join("")||'<div class="empty">Nenhum bloco encontrado.</div>';
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
    ov.querySelectorAll("[data-version]").forEach(b=>b.onclick=()=>{
      version=b.dataset.version; previewVersion=version;
      ov.querySelectorAll("[data-version]").forEach(x=>x.classList.toggle("is-active",x.dataset.version===version));
      apply(); renderList();
    });
    select.onchange=()=>{page=select.value;previewVersion=version;apply();renderList();};
    ov.querySelector("[data-refresh]").onclick=renderList;
    ov.querySelector("[data-reset]").onclick=()=>{if(draft[version])delete draft[version][page];renderList();};
    ov.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{previewVersion=null;apply();ov.remove();});
    ov.querySelector("[data-save]").onclick=async()=>{
      const c=await sb();if(!c)return alert("Supabase não está disponível.");
      const r=await c.from("site_layout_settings").update({active_version:version,overrides:draft,updated_at:new Date().toISOString()}).eq("id",true);
      if(r.error)return alert(r.error.message);
      settings={...settings,active_version:version,overrides:draft};previewVersion=null;apply();ov.remove();window.dispatchEvent(new CustomEvent("banca-layout-updated"));
    };
    ov.addEventListener("click",e=>{if(e.target===ov){previewVersion=null;apply();ov.remove()}});
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