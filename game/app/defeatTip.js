// The defeat card's tip (PLAYFEEL §3, PLAN-PHASE17): when one settlement broke the attack, name it, say how many of your
// troops fell there, and give the advice for that kind of site. Otherwise fall back to advice from the battle's shape.
// A tip never names a power the player cannot use here (`usable`): "soften them with Firestorm" reads as a cruel joke
// under Iron Will or on Holy Ground.
import { SITE_TYPES, AFTER_ACTION } from '../config/battle.js';
import { FEATURES } from '../config/features.js';
import { costliestSite } from '../battle/casualties.js';

const mult = (type) => `${SITE_TYPES[type].def}×`;

/** "the fort at Ashby", "the keep of Lowshire", "the Bandit Camp", "a watchtower", "your War Camp". */
export function siteLabel(site, battle, world) {
  const settlement = battle.arena.sites[site.id]?.settlement ?? -1; // battle sites keep no settlement id; their arena's do
  const name = settlement >= 0 ? world.settlements[settlement]?.name : '';
  const feature = FEATURES.copy.siteNames[site.feature] || FEATURES.copy.siteNames[site.type];
  if (site.type === 'camp') return 'your War Camp'; // taken from you mid-fight, and the retake failed
  if (feature) return `the ${feature}`;
  if (!name) return site.type === 'tower' ? 'a watchtower' : `the ${site.type}`;
  if (site.type === 'keep') return `the keep of ${name}`;
  if (site.type === 'fort' || site.type === 'tower') return `the ${site.type} at ${name}`;
  return `the ${site.type} of ${name}`;
}

/** What to do about the site that broke you, by its kind. */
function adviceFor(site, usable) {
  switch (site.type) {
    case 'keep':
      return `A keep defends at ${mult('keep')} and regrows while you wait: take the settlements around it, then hit it from several at once${usable('rally') ? ' with Rally' : ''}.`;
    case 'fort':
      return `Forts defend at ${mult('fort')}: ${usable('firestorm') ? 'soften it with Firestorm, then hit it' : 'take the settlements around it first, then hit it'} with one big send.`;
    case 'tower':
      return 'A tower shoots every squad in range: march around it, or take it early with one big send.';
    case 'camp':
      return 'Leave troops at home when you send: an empty War Camp invites a counterattack, and retaking it costs more than holding it.';
    case 'gate':
      return `The Gate defends at ${mult('gate')}: gather everything you hold before you send, then send it all at once.`;
    default:
      return `Squads that arrive one at a time just feed a garrison: send from several settlements at once${usable('rally') ? ', or use Rally' : ''}.`;
  }
}

/**
 * The after-action line, when one settlement broke the attack: where, how many, and what to do about it. Null otherwise.
 * Used on the defeat card and the retreat card (most failed attacks end in a retreat: a battle is only lost with nothing left).
 * @param {object} battle  the finished BattleState
 * @param {import('../world/generate.js').World} world
 * @param {(power: string) => boolean} usable  the player can use this power in this battle
 * @returns {string|null}
 */
export function afterActionLine(battle, world, usable) {
  const worst = costliestSite(battle, AFTER_ACTION);
  if (!worst) return null;
  const n = Math.round(worst.lost);
  const all = Math.round(battle.stats.lost);
  const where = siteLabel(worst.site, battle, world);
  const fell = { tower: `fell to the arrows of ${where}`, camp: `fell retaking ${where}` }[worst.site.type] || `fell at ${where}`;
  const lead = n >= all ? `Your troops ${fell}: all ${n} of them.` : `${n} of the ${all} troops you lost ${fell}.`;
  return `${lead} ${adviceFor(worst.site, usable)}`;
}

/**
 * The defeat card's tip: the after-action line, or advice from the battle's shape.
 * @param {object} battle  the finished BattleState
 * @param {import('../world/generate.js').World} world
 * @param {number} regionId
 * @param {(power: string) => boolean} usable
 * @returns {string|undefined}
 */
export function defeatTip(battle, world, regionId, usable) {
  const line = afterActionLine(battle, world, usable);
  if (line) return line;
  const region = world.regions[regionId];
  if (region.settlements.some((id) => world.settlements[id].type === 'fort')) {
    return `Forts defend at ${mult('fort')}: ${usable('firestorm') ? 'soften them with Firestorm first.' : 'take the settlements around one first, then hit it with one big send.'}`;
  }
  if (battle.stats.sent > 0 && battle.stats.captured === 0) {
    return usable('rally') ? 'Try sending from more than one settlement at once, or use Rally to hit all at once.' : 'Try sending from more than one settlement at once: a squad that arrives alone just feeds the garrison.';
  }
  if (battle.stats.sent === 0) return 'Drag from your War Camp to a settlement to send troops: the fight will not start itself.';
  // even a won fight usually loses more than it kills (every garrison defends at 1× or more): only a lopsided trade earns this line
  if (battle.stats.lost > battle.stats.killed * AFTER_ACTION.badTrade) return 'Upgrade Muster or Steel in the War Council: you are trading troops badly.';
  return undefined;
}
