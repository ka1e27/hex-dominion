// Real-browser checks for the "▲ easier now" marks (PLAN-PHASE16 §16C, PLAN-PHASE17), run by tools/check.mjs (`--only=marks`), desktop 1440x900
// and a 390x844 phone, seed 7. Dev hooks only set the stage (conquests, Army levels, gold) and read state; every purchase is a real press.
// The stage is FOUND, not assumed: a search in the page clones the save and tries every Work (or War Council upgrade) at rising Army levels
// until one flips a frontier label (or, for step 1, flips none), conquering one more region when this realm has none, so a retune of the
// numbers moves the stage, never the check.
//   1. a Work that makes nothing easier: its toast carries no "▲", and nothing is marked
//   2. a Work built next to a frontier region it makes easier: ONE toast, "<Work> built in <region> · ▲ <neighbour> is easier now", and the mark
//   3. the marks are gone 20 s later
//   4. a War Council purchase that makes a label easier: once the council closes, "▲ <region> is easier now", and the mark
//   5. a Boon picked in its draft (opened with a real press on the HUD's Boon chip) that makes a label easier: the same, once the draft closes
//   6. no console errors
import { makeOpen } from './robustChecks.mjs';

const INIT = 'window.__HD_TEST_NO_BOON_MOMENTS = true; window.__HD_TEST_NO_PACING = true;';
const ARMY = ['recruitment', 'steel', 'armour'];

/** In the page: the frontier labels as the map reads them (the card's default commander credited), and a search for a change that flips one. */
const SEARCH = async (mode) => {
  const hd = window.__hd;
  const imp = (p) => import(new URL(p, document.baseURI).href);
  const { difficulty, frontier } = await imp('game/meta/progression.js');
  const { buildWork, canBuild, workName } = await imp('game/meta/works.js');
  const { WORK_TYPES } = await imp('game/config/works.js');
  const { buy, UPGRADES } = await imp('game/meta/upgrades.js');
  const { bestFreeGeneral } = await imp('game/meta/generals.js');
  const { ensureBoons2 } = await imp('game/meta/boonsState.js');
  const { BOON_LIST } = await imp('game/config/boons.js');
  const { commanderFor } = await imp('game/meta/edicts.js');
  const RANK = { Easy: 0, Fair: 1, Hard: 2, Deadly: 3 };
  const ranks = (st) => new Map(frontier(st, hd.world).map((id) => {
    const g = bestFreeGeneral(st, hd.world, id, 'attack', Date.now());
    return [id, RANK[difficulty(st, hd.world, id, { commander: commanderFor(st, g ? g.id : null) }).label]];
  }));
  const easier = (a, b) => [...b].filter(([id, rk]) => a.has(id) && rk < a.get(id)).map(([id]) => id);
  for (let lv = 0; lv <= 40; lv += 1) {
    const base = structuredClone(hd.state);
    for (const u of ['recruitment', 'steel', 'armour']) base.upgrades[u] = Math.max(base.upgrades[u] || 0, lv);
    base.gold = 1e9;
    const before = ranks(base);
    if (mode === 'council') {
      for (const id of ['recruitment', 'steel', 'armour']) {
        const st = structuredClone(base);
        if (!buy(st, id)) continue;
        const flipped = easier(before, ranks(st));
        if (flipped.length) return { lv, id, name: UPGRADES[id].name, flipped };
      }
      continue;
    }
    if (mode === 'boon') {
      const owned = ensureBoons2(base).owned;
      const free = BOON_LIST.filter((b) => !owned.includes(b.id));
      for (const b of free) {
        const st = structuredClone(base);
        ensureBoons2(st).owned.push(b.id);
        const flipped = easier(before, ranks(st));
        if (flipped.length) return { lv, id: b.id, name: b.name, flipped, others: free.filter((x) => x.id !== b.id).slice(0, 2).map((x) => x.id) };
      }
      continue;
    }
    for (const r of hd.world.regions.filter((x) => base.owner[x.id] === 0)) {
      for (const type of WORK_TYPES) {
        const st = structuredClone(base);
        if (!canBuild(st, hd.world, r.id, type) || !buildWork(st, hd.world, r.id, type)) continue;
        const flipped = easier(before, ranks(st));
        if ((mode === 'flip') === (flipped.length > 0)) return { lv, region: r.id, regionName: r.name, type, work: workName(type), flipped };
      }
    }
  }
  return null;
};

async function scenario(open, BASE, ok, sleep, allErrors, { width, height, mobile, name }) {
  const t = await open(`${BASE}/index.html?dev=1&seed=7`, { width, height, mobile, init: INIT });
  const q = (fn, ...a) => t.page.eval(fn, ...a);
  const tag = (s) => `marks ${name}: ${s}`;
  const press = async (x, y) => {
    if (mobile) {
      await t.page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await sleep(70);
      await t.page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await t.page.mouse('mouseMoved', x, y, 'none', 0);
      await t.page.mouse('mousePressed', x, y, 'left', 1);
      await sleep(80);
      await t.page.mouse('mouseReleased', x, y, 'left', 0);
    }
  };
  const escape = async () => {
    for (const type of ['keyDown', 'keyUp']) await t.page.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(200);
  };
  const names = (ids) => q((list) => list.map((id) => window.__hd.world.regions[id].name), ids);
  // a stage for `mode` in this realm, or after one more conquest (a new owned region brings new Work slots), up to four
  const findStage = async (mode) => {
    for (let k = 0; k <= 4; k++) {
      const found = await q(SEARCH, mode);
      if (found) return found;
      await q(() => window.__hd.conquerRegions(1));
      await sleep(600);
    }
    return null;
  };
  const marked = () => q(() => window.__hd.improvedRegions());
  const toasts = () => q(() => [...document.querySelectorAll('.toasts > .toast')].filter((n) => !n.classList.contains('is-out')).map((n) => n.dataset.message || n.textContent.trim()));
  /** Opens the owned region's card with a real press on the map and builds `work` in its first empty slot through the chooser. */
  const build = async (regionId, work) => {
    await q((id) => window.__hd.flyToRegion(id, undefined, 300), regionId);
    await sleep(1300);
    const pos = await q((id) => window.__hd.regionScreenPos(id), regionId);
    await press(pos.x, pos.y);
    ok(await t.waitFor(() => { const w = document.querySelector('.works-panel:not(.is-forts) .works-build'); return !!w && w.getClientRects().length > 0; }, 5000), tag(`the card of the owned region has Build... (${work})`));
    ok(await t.clickSel('.works-panel:not(.is-forts) .works-build'), tag('a press on Build...'));
    ok(await t.waitFor(() => document.querySelectorAll('.works-panel:not(.is-forts) .works-choice').length >= 5, 3000), tag('the chooser opens'));
    ok(await t.clickSel('.works-panel:not(.is-forts) .works-choice', work), tag(`a press on ${work}`));
    await sleep(700);
  };
  try {
    ok(await t.atTitle(), tag('boots'));
    ok(await t.clickText('button', 'New Realm'), tag('New Realm'));
    ok(await t.waitFor(() => window.__hd.scene === 'world', 40000), tag('the world is up'));
    await q(() => { const hd = window.__hd; hd.hideDev(true); hd.state.settings.hints = false; hd.grantGold(1e6); });
    await sleep(2500);

    // 1. a Work that makes nothing easier
    const none = await findStage('none');
    ok(!!none, tag(`a Work that flips no label exists (${none && `${none.work} in ${none.regionName}`})`));
    if (none) {
      await q((lv, ups) => { for (const u of ups) window.__hd.state.upgrades[u] = Math.max(window.__hd.state.upgrades[u] || 0, lv); }, none.lv, ARMY);
      await build(none.region, none.work);
      const ts = await toasts();
      ok(ts.some((m) => m.startsWith(`${none.work} built in ${none.regionName}`)), tag(`its toast: ${JSON.stringify(ts)}`));
      ok(!ts.some((m) => m.includes('▲')), tag('no "▲" in any toast'));
      ok((await marked()).length === 0, tag('nothing is marked on the map'));
      await escape();
      await sleep(4800); // that toast runs out
    }

    // 2. a Work that makes a neighbour easier: one toast says both
    const flip = await findStage('flip');
    ok(!!flip, tag(`a Work that makes a frontier region easier exists (${flip && `${flip.work} in ${flip.regionName}`})`));
    if (flip) {
      await q((lv, ups) => { for (const u of ups) window.__hd.state.upgrades[u] = Math.max(window.__hd.state.upgrades[u] || 0, lv); }, flip.lv, ARMY);
      const want = await names(flip.flipped);
      await build(flip.region, flip.work);
      const ts = await toasts();
      const words = want.length === 1 ? `▲ ${want[0]} is easier now` : `▲ ${want[0]} and ${want.length - 1} more`;
      ok(ts.some((m) => m.startsWith(`${flip.work} built in ${flip.regionName} · ${words}`)), tag(`ONE toast says it: ${JSON.stringify(ts)}`));
      ok(ts.filter((m) => m.includes('▲')).length === 1, tag('the news is not a second toast'));
      const m = await marked();
      ok(flip.flipped.every((id) => m.includes(id)), tag(`the map marks ${want.join(', ')} (${JSON.stringify(m)})`));
      await escape();
      // 3. gone 20 s later
      ok(await t.waitFor(() => window.__hd.improvedRegions().length === 0, 26000), tag('the marks are gone 20 s later'));
    }

    // 4. a War Council purchase (Phase 16C): the toast once the council closes, and the mark
    const buyIt = await findStage('council');
    ok(!!buyIt, tag(`a War Council level that makes a frontier region easier exists (${buyIt && `${buyIt.name} at level ${buyIt.lv}`})`));
    if (buyIt) {
      await q((lv, ups) => { for (const u of ups) window.__hd.state.upgrades[u] = Math.max(window.__hd.state.upgrades[u] || 0, lv); }, buyIt.lv, ARMY);
      await q(() => window.__hd.grantGold(1e9)); // a high level costs more than the stage's first grant
      const want = await names(buyIt.flipped);
      await q(() => window.__hd.openCouncil());
      ok(await t.waitFor(() => { const c = document.querySelector('.council'); return !!c && !c.hidden; }, 4000), tag('the council is open'));
      const pos = await q((nm) => {
        const card = [...document.querySelectorAll('.upgrade-card')].find((c) => c.querySelector('.upgrade-card-name')?.textContent.trim() === nm);
        const b = card && card.querySelector('.upgrade-card-buy');
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, buyIt.name);
      ok(!!pos, tag(`the ${buyIt.name} card has a Buy button`));
      if (pos) await press(pos.x, pos.y);
      await sleep(500);
      ok((await toasts()).length === 0, tag('no toast over the open council'));
      ok(await t.clickSel('.council-close'), tag('a press on Close'));
      ok(await t.waitFor((w) => [...document.querySelectorAll('.toasts > .toast')].some((n) => (n.dataset.message || n.textContent).includes(w)), 4000, `▲ ${want[0]}`), tag(`once it closes: "▲ ${want[0]} ..." (${JSON.stringify(await toasts())})`));
      const m = await marked();
      ok(buyIt.flipped.every((id) => m.includes(id)), tag(`the map marks ${want.join(', ')}`));
      ok(await t.waitFor(() => window.__hd.improvedRegions().length === 0, 26000), tag('those marks are gone 20 s later too'));
    }

    // 5. a Boon picked in its draft (PLAN-PHASE17): the same news once the draft closes
    const boon = await findStage('boon');
    ok(!!boon, tag(`a Boon that makes a frontier region easier exists (${boon && `${boon.name} at Army level ${boon.lv}`})`));
    if (boon) {
      await q((lv, ups) => { for (const u of ups) window.__hd.state.upgrades[u] = Math.max(window.__hd.state.upgrades[u] || 0, lv); }, boon.lv, ARMY);
      const want = await names(boon.flipped);
      await q((ids) => window.__hd.offerBoons(ids, 'battle'), [boon.id, ...boon.others]);
      ok(await t.waitFor(() => { const c = document.querySelector('.hud-boon-chip'); return !!c && !c.hidden && c.getClientRects().length > 0; }, 4000), tag('the HUD shows the Boon chip'));
      ok(await t.clickSel('.hud-boon-chip'), tag('a press on the Boon chip'));
      ok(await t.waitFor(() => { const d = document.querySelector('.boon-draft'); return !!d && !d.hidden && d.getClientRects().length > 0; }, 4000), tag('the draft opens'));
      await sleep(600);
      ok(await t.clickSel('.boon-card', boon.name), tag(`a press on ${boon.name}`));
      ok(await t.waitFor((id) => window.__hd.state.boons2.owned.includes(id), 4000, boon.id), tag(`${boon.name} is owned`));
      ok(await t.waitFor(() => { const d = document.querySelector('.boon-draft'); return !d || d.hidden; }, 8000), tag('the draft closes'));
      ok(await t.waitFor((w) => [...document.querySelectorAll('.toasts > .toast')].some((n) => (n.dataset.message || n.textContent).includes(w)), 4000, `▲ ${want[0]}`), tag(`then: "▲ ${want[0]} ..." (${JSON.stringify(await toasts())})`));
      const m = await marked();
      ok(boon.flipped.every((id) => m.includes(id)), tag(`the map marks ${want.join(', ')}`));
    }
  } catch (e) {
    ok(false, tag(`unexpected error: ${e && e.stack}`));
  } finally {
    const errs = t.unexpected();
    ok(errs.length === 0, tag(`no console errors${errs.length ? `: ${errs[0]}` : ''}`));
    allErrors.push(...errs.map((e) => `[marks ${name}] ${e}`));
    await t.page.close();
  }
}

export async function labelMarkChecks({ launch, BASE, ok, sleep, allErrors }) {
  console.log('\n== marks: "▲ easier now" after a Work, a War Council purchase and a Boon, one toast, gone 20 s later ==');
  const open = makeOpen(launch, sleep);
  await scenario(open, BASE, ok, sleep, allErrors, { width: 1440, height: 900, mobile: false, name: 'desktop' });
  await scenario(open, BASE, ok, sleep, allErrors, { width: 390, height: 844, mobile: true, name: 'phone' });
}
