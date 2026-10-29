// PLAN-PHASE17: every casualty is counted where it falls (battle/casualties.js). Zero growth on both sides, so troops are
// conserved exactly: what the player sent either sits in a garrison at the end or was lost, and what the enemy held
// either still stands or was killed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, step, issue } from '../battle/sim.js';
import { casualty, costliestSite } from '../battle/casualties.js';
import { AFTER_ACTION } from '../config/battle.js';
import { buildArena } from '../battle/arena.js';
import { buildTestWorld, TARGET_REGION, DEFAULT_OWNERS } from './fixtures/battle-world.js';

const PLAYER = Object.freeze({
  atk: 1, def: 1, growth: 0, speed: 1, campTroops: 30, garrisonShare: 0.35, capBonus: 0,
  cooldownMult: 1, powers: { rally: 1, firestorm: 1, bulwark: 1, march: 1, levy: 1 },
});
const ENEMY = Object.freeze({
  atk: 1, def: 1, growth: 0, speed: 1, troopMult: 1, thinkSec: 2, personality: 'passive', factionId: 2,
});

function tinyArena({ campTroops, enemyType = 'village', enemyTroops }) {
  const tiles = [
    { i: 0, q: 0, r: 0, x: 0, y: 0, cost: 1, terrain: 'grass', region: 0 },
    { i: 1, q: 1, r: 0, x: Math.sqrt(3), y: 0, cost: 1, terrain: 'grass', region: 0 },
  ];
  const sites = [
    { id: 0, settlement: -1, tile: 0, type: 'camp', owner: 0, troops: campTroops },
    { id: 1, settlement: 0, tile: 1, type: enemyType, owner: 2, troops: enemyTroops },
  ];
  return { regionId: 0, enemyFaction: 2, tiles, sites, focus: { minX: 0, maxX: Math.sqrt(3), minY: 0, maxY: 0 } };
}

function sendAllAndSettle(battle) {
  issue(battle, { type: 'send', owner: 0, from: [0], to: 1, fraction: 1.0 });
  let steps = 0;
  do { step(battle, 0.05); steps++; } while (!battle.result && battle.squads.length > 0 && steps < 20000);
}

test('a failed assault counts every troop sent as lost, against the site that held, and the garrison it wore down as killed', () => {
  const battle = createBattle(tinyArena({ campTroops: 30, enemyTroops: 60 }), PLAYER, ENEMY, { seed: 1 });
  sendAllAndSettle(battle);
  const sent = battle.stats.sent;
  const village = battle.sites[1];
  assert.equal(village.owner, 2, 'the village held');
  assert.ok(sent > 20, `sent ${sent}`);
  assert.ok(Math.abs(battle.stats.lost - sent) < 1e-6, `lost ${battle.stats.lost} = sent ${sent}`);
  assert.ok(Math.abs(battle.stats.fellAt[1] - sent) < 1e-6, 'all of it fell against site 1');
  assert.ok(Math.abs(battle.stats.killed - (60 - village.troops)) < 1e-6, `killed ${battle.stats.killed} = 60 - ${village.troops}`);
  assert.ok(battle.stats.killed > 5, 'the assault did wear the garrison down (before PLAN-PHASE17 this read 0)');
});

test('a capture: the garrison killed is the whole garrison, and lost + what now holds the site = what was sent', () => {
  const battle = createBattle(tinyArena({ campTroops: 60, enemyTroops: 15 }), PLAYER, ENEMY, { seed: 1 });
  sendAllAndSettle(battle);
  const village = battle.sites[1];
  assert.equal(village.owner, 0, 'captured');
  assert.ok(Math.abs(battle.stats.killed - 15) < 1e-6, `killed ${battle.stats.killed}`);
  assert.ok(Math.abs(battle.stats.lost + village.troops - battle.stats.sent) < 1e-6, `lost ${battle.stats.lost} + held ${village.troops} = sent ${battle.stats.sent}`);
  assert.ok(battle.stats.lost > 1, 'taking it cost troops');
});

test('a real arena: the counts survive a JSON round trip and stay finite and non-negative', () => {
  const world = buildTestWorld();
  const arena = buildArena(world, DEFAULT_OWNERS, TARGET_REGION, { ...PLAYER, growth: 1 }, { ...ENEMY, growth: 1, personality: 'aggressive' });
  const battle = createBattle(arena, { ...PLAYER, growth: 1 }, { ...ENEMY, growth: 1, personality: 'aggressive' }, { seed: 3 });
  const keep = battle.sites.find((s) => s.type === 'keep' && s.owner !== 0);
  for (let i = 0; i < 1200 && !battle.result; i++) {
    if (i % 100 === 0) issue(battle, { type: 'send', owner: 0, from: battle.sites.filter((s) => s.owner === 0).map((s) => s.id), to: keep.id, fraction: 0.5 });
    step(battle, 0.05);
  }
  const copy = JSON.parse(JSON.stringify(battle.stats));
  assert.deepEqual(copy, battle.stats);
  for (const k of ['lost', 'killed']) assert.ok(Number.isFinite(battle.stats[k]) && battle.stats[k] >= 0, k);
  assert.ok(battle.stats.lost > 0 && battle.stats.killed > 0, `lost ${battle.stats.lost} killed ${battle.stats.killed}`);
  const fell = Object.values(battle.stats.fellAt || {}).reduce((a, b) => a + b, 0);
  assert.ok(fell <= battle.stats.lost + 1e-6, 'losses against sites are a part of all losses');
});

test('costliestSite names a site only when it stands out', () => {
  const battle = { sites: [{ id: 0, type: 'camp' }, { id: 1, type: 'fort' }, { id: 2, type: 'village' }], stats: { lost: 0, killed: 0 } };
  assert.equal(costliestSite(battle, AFTER_ACTION), null, 'nothing lost');
  casualty(battle, 0, 30, 1);
  casualty(battle, 0, 8, 2);
  casualty(battle, 0, 12); // the field
  casualty(battle, 2, 40, 1); // enemy losses are never kept per site
  assert.equal(battle.stats.lost, 50);
  assert.equal(battle.stats.killed, 40);
  const worst = costliestSite(battle, AFTER_ACTION);
  assert.equal(worst.site.id, 1);
  assert.equal(worst.lost, 30);
  assert.ok(Math.abs(worst.share - 0.6) < 1e-9);
  // spread out: no single site holds minShare of the losses
  casualty(battle, 0, 40);
  assert.equal(costliestSite(battle, AFTER_ACTION), null, `30 of 90 is under ${AFTER_ACTION.minShare}`);
  // too few to name
  const small = { sites: [{ id: 0 }, { id: 1 }], stats: { lost: 0, killed: 0 } };
  casualty(small, 0, AFTER_ACTION.minLost - 1, 1);
  assert.equal(costliestSite(small, AFTER_ACTION), null);
});
