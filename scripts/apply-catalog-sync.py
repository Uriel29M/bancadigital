from pathlib import Path
import re

app_path = Path('js/app.js')
source = app_path.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    source = source.replace(old, new, 1)

def replace_function(name, new):
    global source
    matches = list(re.finditer(r'^  (?:async )?function ' + re.escape(name) + r'\(', source, re.M))
    if len(matches) != 1:
        raise RuntimeError(f'{name}: expected one function, found {len(matches)}')
    start = matches[0].start()
    end = source.find('\n  }', start)
    if end < 0:
        raise RuntimeError(f'{name}: function end missing')
    source = source[:start] + new.rstrip() + source[end + 4:]

replace_function('publishCatalog', '''  async function publishCatalog() {
    if (!sb || state.profile?.plan !== "admin") return { skipped: true };
    // Never let a stale browser snapshot overwrite canonical edition sources.
    await refreshSharedCatalog({ renderPage: false });
    const library = BancaCatalogSync.merge(state.db.library);
    const result = await sb.functions.invoke("github-catalog", {
      body: { library: compactSeriesItems(library), series: window.DEFAULT_SERIES || [], collections: state.db.collections },
    });
    if (result.error) {
      let detail = result.error.message || "Não foi possível publicar o catálogo.";
      try {
        const response = result.error.context;
        if (response?.clone) {
          const body = await response.clone().json();
          if (body?.error) detail = body.error;
        }
      } catch {}
      throw new Error(detail);
    }
    if (result.data?.error) throw new Error(result.data.error);
    return result.data;
  }''')

replace_function('saveCatalog', '''  async function saveCatalog(message = "Catálogo salvo.", edition = null) {
    let sharedPublished = false;
    try {
      if (edition) {
        if (!sb || state.profile?.plan !== "admin" || !state.session?.user?.id) throw new Error("É necessária uma sessão de administrador para publicar a edição.");
        const record = await BancaCatalogSync.publish(sb, edition, state.session.user.id);
        const canonical = { ...record.edition, catalogEditedAt: record.updated_at };
        BancaCatalogSync.rows.set(String(canonical.id), { ...record, edition: canonical });
        const index = state.db.library.findIndex(item => String(item.id) === String(canonical.id));
        if (index >= 0) state.db.library[index] = canonical;
        else state.db.library.push(canonical);
        sharedPublished = true;
        clearGeneratedCoverCache();
      }
      save();
      const result = await publishCatalog();
      if (result?.skipped) {
        if (!sharedPublished) {
          toast("Alteração salva somente neste navegador. A publicação exige conexão com o Supabase e uma conta de administrador.");
          return false;
        }
        toast(`${message} Alteração compartilhada com todos os usuários.`);
        return true;
      }
      toast(`${message} Alteração compartilhada com todos os usuários. O catálogo estático também foi atualizado.`);
      return true;
    } catch (error) {
      console.error("[CATALOG] Falha ao publicar:", error);
      if (sharedPublished) {
        toast(`${message} Alteração compartilhada com todos os usuários. A cópia estática do GitHub não foi atualizada: ${error.message || "erro desconhecido"}`);
        return true;
      }
      toast(`Não foi possível publicar a alteração para os demais usuários: ${error.message || "erro desconhecido"}`);
      return false;
    }
  }''')

# The editor must not mutate the local catalog before the shared write succeeds.
old = '''      const index = state.db.library.findIndex(i => i.id === item.id);
      if (index >= 0) state.db.library[index] = item; else state.db.library.push(item);
      const submit = form.querySelector('button.btn');'''
new = '''      const submit = form.querySelector('button.btn');'''
replace_once(old, new, 'edition editor mutation')
replace_once('const published = await saveCatalog("Edição salva.");', 'const published = await saveCatalog("Edição salva.", item);', 'edition publication')
replace_once('A edição ficou salva somente neste navegador. A publicação falhou; tente salvar novamente para disponibilizá-la aos demais usuários.', 'A publicação falhou. A edição permanece neste formulário; tente salvar novamente. Nenhuma alteração não confirmada foi publicada.', 'editor failure message')

# Remote rows are loaded independently of the login process and take precedence
# over old localStorage snapshots and historical hardcoded catalog migrations.
helper = '''  let sharedCatalogRefresh = null;
  async function refreshSharedCatalog(options = {}) {
    if (!sb || navigator.onLine === false) return false;
    if (sharedCatalogRefresh) return sharedCatalogRefresh;
    sharedCatalogRefresh = (async () => {
      await BancaCatalogSync.read(sb);
      const merged = BancaCatalogSync.merge(state.db.library);
      const changed = JSON.stringify(merged) !== JSON.stringify(state.db.library);
      if (changed) {
        state.db.library = merged;
        DataStore.save(state.db);
        clearGeneratedCoverCache();
        if (options.renderPage !== false && state.section !== "reader" && !readerIsOpen) render();
      }
      return changed;
    })();
    try { return await sharedCatalogRefresh; }
    finally { sharedCatalogRefresh = null; }
  }

'''
replace_once('  async function publishCatalog() {', helper + '  async function publishCatalog() {', 'shared catalog refresh')
# All catalog materialization paths must honor authoritative source fields.
replace_once('''      return merged;
    });
  }

  function compactSeriesItems''', '''      return window.BancaCatalogSync?.merge([merged])?.[0] || merged;
    });
  }

  function compactSeriesItems''', 'materialization precedence')
# Do not append all remote editions during a per-item materialization call.
source = source.replace('return window.BancaCatalogSync?.merge([merged])?.[0] || merged;', 'return window.BancaCatalogSync?.applyEdition(merged, window.BancaCatalogSync.rows.get(String(merged.id))?.edition) || merged;')

replace_once('''  const accountBootstrap = initialPublicUsername''', '''  refreshSharedCatalog()
    .then(() => BancaCatalogSync.start(sb, refreshSharedCatalog))
    .catch(error => console.warn("Catálogo compartilhado indisponível; usando cópia local:", error));
  const accountBootstrap = initialPublicUsername''', 'shared catalog bootstrap')

app_path.write_text(source, encoding='utf-8')

html_path = Path('index.html')
html = html_path.read_text(encoding='utf-8')
old = '  <script src="js/supabase.js"></script>'
assert html.count(old) == 1
html = html.replace(old, old + '\n  <script src="js/catalog-sync.js?v=1"></script>', 1)
html, count = re.subn(r'js/app\.js\?v=[^" ]+', 'js/app.js?v=2.2.10.447', html)
assert count == 1
html_path.write_text(html, encoding='utf-8')
print('Shared edition editor, published snapshot reconciliation, and online refresh integrated.')
