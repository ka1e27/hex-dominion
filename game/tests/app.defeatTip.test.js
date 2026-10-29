// PLAN-PHASE17: the defeat card names the settlement that broke the attack (app/defeatTip.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { defeatTip, afterActionLine, siteLabel } from '../app/defeatTip.js';
import { casualty } from '../battle/casualties.js';
import { SITE_TYPES } from '../config/battle.js';

const world = {
  settlements: [{ name: 'Lowshire', type: 'keep' }, { name: 'Ashby', type: 'fort' }, { name: 'Oakmere', type: 'village' }, { name: 'Brindle', type: 'hamlet' }],
  regions: [{ settlements: [0, 2, 3] }, { settlements: [0, 1, 2] }],
};

function battleWith(types, settlements) {
  const sites = types.map((type, id) => ({ id, type, owner: id === 0 ? 0 : 2, ...(type === 'gate' ? { feature: 'gate' } : {}) }));
  return {
    sites,
    arena: { sites: sites.map((s, i) => ({ id: s.id, settlement: settlements[i] })) },
    stats: { sent: 100, lost: 0, killed: 0, captured: 1 },
  };
}
const all = () => true;
const none = () => false;

test('siteLabel reads a site the way the map names it', () => {
  const b = battleWith(['camp', 'keep', 'fort', 'village', 'tower', 'gate', 'tower'], [-1, 0, 1, 2, -1, -1, 1]);
  assert.equal(siteLabel(b.sites[0], b, world), 'your War Camp');
  assert.equal(siteLabel(b.sites[1], b, world), 'the keep of Lowshire');
  assert.equal(siteLabel(b.sites[2], b, world), 'the fort at Ashby');
  assert.equal(siteLabel(b.sites[3], b, world), 'the village of Oakmere');
  assert.equal(siteLabel(b.sites[4], b, world), 'a watchtower');
  assert.equal(siteLabel(b.sites[5], b, world), 'the Gate');
  assert.equal(siteLabel(b.sites[6], b, world), 'the tower at Ashby');
});

test('the site that broke the attack is named, with the count and advice for its kind', () => {
  const b = battleWith(['camp', 'keep', 'village'], [-1, 0, 2]);
  casualty(b, 0, 64, 1);
  casualty(b, 0, 20, 2);
  casualty(b, 0, 16);
  const tip = defeatTip(b, world, 0, all);
  assert.match(tip, /^64 of the 100 troops you lost fell at the keep of Lowshire\./);
  assert.match(tip, new RegExp(`defends at ${SITE_TYPES.keep.def}×`));
  assert.match(tip, /with Rally/);
  assert.doesNotMatch(defeatTip(b, world, 0, none), /Rally/, 'never a power the player cannot use');
});

test('every loss at one site reads "all N of them"; a fort names Firestorm only when it can be cast', () => {
  const b = battleWith(['camp', 'fort'], [-1, 1]);
  casualty(b, 0, 42, 1);
  assert.match(defeatTip(b, world, 1, all), /^Your troops fell at the fort at Ashby: all 42 of them\. .*Firestorm/);
  assert.doesNotMatch(defeatTip(b, world, 1, none), /Firestorm/);
});

test('a tower is arrows; a lost War Camp is a retake', () => {
  const t = battleWith(['camp', 'tower'], [-1, -1]);
  casualty(t, 0, 30, 1);
  assert.match(defeatTip(t, world, 0, all), /fell to the arrows of a watchtower/);
  const c = battleWith(['camp', 'keep'], [-1, 0]);
  casualty(c, 0, 30, 0);
  assert.match(defeatTip(c, world, 0, all), /^Your troops fell retaking your War Camp: all 30 of them\. Leave troops at home/);
});

test('with no site standing out, the tip falls back to the battle\'s shape', () => {
  const spread = battleWith(['camp', 'keep', 'village', 'hamlet'], [-1, 0, 2, 3]);
  for (const id of [1, 2, 3]) casualty(spread, 0, 20, id);
  casualty(spread, 0, 40);
  casualty(spread, 2, 90); // an even trade
  assert.equal(defeatTip(spread, world, 0, all), undefined, 'a plain region, a capture made, an even trade: the card picks a general tip');
  assert.match(defeatTip(spread, world, 1, all), /^Forts defend/, 'a region with a fort');
  const idle = battleWith(['camp', 'keep'], [-1, 0]);
  idle.stats.sent = 0;
  assert.match(defeatTip(idle, world, 0, all), /^Drag from your War Camp/);
  const lopsided = battleWith(['camp', 'keep'], [-1, 0]);
  casualty(lopsided, 0, 9);
  casualty(lopsided, 2, 2);
  assert.match(defeatTip(lopsided, world, 0, all), /trading troops badly/);
});

test('afterActionLine (the retreat card uses it too) is the named-site line alone, or null', () => {
  const b = battleWith(['camp', 'keep', 'village'], [-1, 0, 2]);
  assert.equal(afterActionLine(b, world, all), null, 'nothing lost');
  casualty(b, 0, 50, 2);
  assert.equal(afterActionLine(b, world, all), defeatTip(b, world, 0, all));
  assert.match(afterActionLine(b, world, all), /^Your troops fell at the village of Oakmere: all 50 of them\./);
});
