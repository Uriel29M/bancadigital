import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const feature = readFileSync('js/sticker-actions-feature.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

assert.ok(app.includes('import(appAssetUrl("js/sticker-actions-feature.js"))'));
assert.ok(app.includes('async function maybeAwardReadSticker(...args)'));
assert.ok(app.includes('async function maybeAwardCompletedStickers(...args)'));
assert.ok(app.includes('async function requestSticker(...args)'));
assert.ok(!app.includes('async function maybeAwardReadSticker(item)'));
assert.ok(!app.includes('function chooseStickerForTrade(offerable = [])'));
assert.ok(!app.includes('function chooseStickerForDonation(offerable = [])'));
assert.ok(!app.includes('function chooseAdminStickerRarity()'));
assert.ok(!app.includes('function chooseStickerCoverCandidate(group, candidates = [])'));
assert.ok(!app.includes('function askStickerDiscardConfirmation()'));
assert.ok(!app.includes('async function requestSticker(characterId, ownerId, type)'));
assert.equal((app.match(/function stickerRequestsMarkup\\s*\\(/g) || []).length, 1);

assert.ok(feature.includes('export function createStickerActionsFeature(deps)'));
assert.ok(feature.includes('async function maybeAwardReadSticker(item)'));
assert.ok(feature.includes('function chooseStickerForTrade(offerable = [])'));
assert.ok(feature.includes('function chooseStickerForDonation(offerable = [])'));
assert.ok(feature.includes('function chooseAdminStickerRarity()'));
assert.ok(feature.includes('function chooseStickerCoverCandidate(group, candidates = [])'));
assert.ok(feature.includes('function askStickerDiscardConfirmation()'));
assert.ok(feature.includes('async function requestSticker(characterId, ownerId, type)'));

assert.match(index, /js\\/app\\.js\\?v=2\\.2\\.10\\.514-sticker-actions-split/);
assert.match(index, /sw\\.js\\?v=279-sticker-actions-split/);
assert.ok(!sw.includes('sticker-actions-feature.js'));

console.log('PASS sticker actions split');
