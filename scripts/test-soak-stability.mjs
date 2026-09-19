import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("js/app.js", "utf8");
const factionEditors = readFileSync("js/faction-editors-feature.js", "utf8");

assert.equal((app.match(/ensure_faction_leadership/g) || []).length, 0,
  "frontend não deve reparar liderança em toda carga; isso pertence às RPCs de mutação");
assert.equal((factionEditors.match(/ensure_faction_leadership/g) || []).length, 0,
  "escolher facção não deve repetir a manutenção já feita por choose_faction");

assert.equal((app.match(/sb\.rpc\("get_faction_achievements"/g) || []).length, 1,
  "conquistas devem ser carregadas apenas para a facção em detalhe");
assert.equal((app.match(/sb\.rpc\("get_faction_mandatory_reads"/g) || []).length, 2,
  "leituras obrigatórias devem existir apenas no detalhe e na atualização após concluir leitura");

assert.ok(app.includes('const detailsFactionId = state.section === "factions"'),
  "dados pesados de facção só devem carregar na seção de facções");

assert.equal((app.match(/await sb\.rpc\("touch_profile"\)/g) || []).length, 1,
  "presença não deve duplicar touch_profile antes do heartbeat");

console.log("PASS soak stability regressions");
