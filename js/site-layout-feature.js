(() => {
  "use strict";
  const labels={principal:"Principal",atual:"Atual",minimalista:"Minimalista"};
  const desc={
    principal:"Melhor equilíbrio entre descoberta, leitura, identidade e densidade.",
    atual:"Experiência atual preservada para comparação e retorno seguro.",
    minimalista:"Minimalismo extremo: somente o essencial."
  };
  let settings=null, observer=null, busy=false, previewVersion=null;

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

  function blockLabel(el){
    const h=el.querySelector(":scope > h1,:scope > h2,:scope > h3,:scope > .section-title,:scope > .section-head strong");
    const raw=h?.textContent||el.getAttribute("aria-label")||el.getAttribute("title")||el.dataset.section||el.id||"";
    const cleaned=String(raw).replace(/\s+/g," ").trim();
    if(cleaned && !/^secao(?:[-_/]\w+)?$/i.test(cleaned))return cleaned;
    const cls=[...el.classList].find(x=>/section|shelf|profile|reader|hero|search|result|filter|comment|activity|collection|entity|series|comic|manga/i.test(x));
    const inferred=String(cls||"").replace(/[-_]+/g," ").replace(/\b\w/g,m=>m.toUpperCase()).trim();
    return inferred||"Seção";
  }

  function blocks(){
    const r=root(); if(!r)return[];
    const result=[], seen=new Set();
    const add=(el,parent,index,parentKey="")=>{
      if(!el||seen.has(el)||el.matches(".layout-admin-panel,.site-layout-manager"))return;
      seen.add(el);
      const label=blockLabel(el), base=norm(label);
      const catalog=PAGE_BLOCKS[pageKey()]||[];
      const exact=catalog.find(([k,l])=>norm(l)===base);
      const classMatch=catalog.find(([k])=>el.classList?.contains(k));
      const stable=el.dataset.layoutKey||exact?.[0]||classMatch?.[0]||(parentKey?parentKey+"/"+base:base);
      const key=result.some(x=>x.key===stable)?stable+"-"+index:stable;
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
  function minimalHidden(version,b,i,total){
    if(version!=="minimalista")return false;
    const s=(b.label+" "+b.key).toLocaleLowerCase("pt-BR");
    return /dica|curiosidade|aleatori|atividade|estatíst|relacionad|fanart|notíci|wiki rápida|informações extras|detalhes/.test(s)
      || (total>7&&i>=5);
  }

  function apply(){
    if(busy)return; const r=root(); if(!r)return; busy=true;
    const version=previewVersion||settings?.active_version||"principal", page=pageKey(), rs=rules(version,page), bs=blocks();
    const catalogOrder=new Map((PAGE_BLOCKS[page]||[]).map(([key],i)=>[key,i]));
    const ruleFor=b=>rs[b.key]||rs[norm(b.label)]||{};
    const presetRule=(b,i)=>{
      if(version==="atual")return {};
      if(version==="minimalista")return {hidden: !/^(hero|continue|catalog|search-controls|search-results|series-header|entity-header|ranking-header|faction-header|collection-header|downloads-completed|local-box-files|album-stickers|profile-header|profile-shelf|messages-header|notifications-header|community-header|login-form|signup-form|reader-content|reader-controls|password-reset-form)/i.test(b.key)};
      return {order:catalogOrder.has(b.key)?catalogOrder.get(b.key):i};
    };
    const principalOrder=/^(hero|destaque|continue|novidade|resultado|serie|série|ediç|estante|salvo|coleç|personagem|autor|editora|selo|mural|lista|álbum|figurinha|coment|atividade|notíci|relacionad|wiki|filtro)/i;
    document.documentElement.dataset.siteLayoutVersion=version; r.dataset.layoutPage=page;
    bs.forEach((b,i)=>{
      const x={...presetRule(b,i),...ruleFor(b)}, hidden=x.hidden===true||minimalHidden(version,b,i,bs.length);
      b.el.hidden=hidden; b.el.dataset.layoutHidden=hidden?"true":"false";
      const h=b.el.querySelector("h1,h2,h3,.section-title");
      if(h&&x.label)h.textContent=x.label;
      const autoOrder=version==="principal"?(principalOrder.test(b.label)?b.label.toLocaleLowerCase("pt-BR").includes("hero")||b.label.toLocaleLowerCase("pt-BR").includes("destaque")?5:20:80):i;
      b.el.style.order=Number.isFinite(Number(x.order))?String(x.order):String(autoOrder);
    });
    const groups=new Map();
    bs.forEach(b=>{const parent=b.parent||r;if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(b);});
    groups.forEach(items=>items.slice().sort((a,b)=>{
      const ao=Number(rs[a.key]?.order),bo=Number(rs[b.key]?.order);
      return(Number.isFinite(ao)?ao:a.index)-(Number.isFinite(bo)?bo:b.index);
    }).forEach(b=>b.parent.appendChild(b.el)));
    r.classList.toggle("site-layout-minimal",version==="minimalista");
    r.classList.toggle("site-layout-principal",version==="principal");
    r.classList.toggle("site-layout-atual",version==="atual");
    busy=false;
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