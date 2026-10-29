// Casualty accounting (PLAN-PHASE17). Every troop that dies in a battle is counted once, at the moment it dies: in a
// clash, in an assault (both sides, tick by tick), under a tower's arrows, in a Firestorm, a Dragon's breath, a Tide.
// Before this, only a squad's last troops and a captured garrison's last troops were counted, so a ground-down keep
// read "3 killed, 0 lost" on the results card.
//
// The player's losses against a site (assaulting it, or under its arrows) are also kept per site in
// `battle.stats.fellAt` ({ [siteId]: troops }), so a defeat can name the settlement that broke the attack.
//
// Bookkeeping only: nothing in the sim reads these numbers, so counting them changes no fight. Pure, plain JSON.
import { PLAYER_OWNER } from './owner.js';

/**
 * Counts `amount` troops of `owner` as dead.
 * @param {object} battle
 * @param {number} owner
 * @param {number} amount  troops (fractions are fine: fights trade strength continuously)
 * @param {number} [at]    the arena site id the player's troops fell against (assault or arrows); omit for the field
 */
export function casualty(battle, owner, amount, at) {
  if (!(amount > 0)) return;
  const st = battle.stats;
  if (owner !== PLAYER_OWNER) {
    st.killed += amount;
    return;
  }
  st.lost += amount;
  if (at == null) return;
  if (!st.fellAt || typeof st.fellAt !== 'object') st.fellAt = {};
  st.fellAt[at] = (st.fellAt[at] || 0) + amount;
}

/**
 * The site the player lost the most troops against, if one stands out: at least `minLost` troops there and at least
 * `minShare` of everything the player lost this battle. Null otherwise (losses spread out, or too few to matter).
 * @param {object} battle
 * @param {{minLost: number, minShare: number}} rule  BATTLE.afterAction
 * @returns {{site: object, lost: number, share: number}|null}
 */
export function costliestSite(battle, rule) {
  const fell = battle.stats && battle.stats.fellAt;
  const total = battle.stats ? battle.stats.lost : 0;
  if (!fell || !(total > 0)) return null;
  let best = null;
  for (const [id, lost] of Object.entries(fell)) {
    const site = battle.sites[Number(id)];
    if (!site || !(lost > 0)) continue;
    if (!best || lost > best.lost || (lost === best.lost && site.id < best.site.id)) best = { site, lost };
  }
  if (!best || best.lost < rule.minLost || best.lost / total < rule.minShare) return null;
  return { ...best, share: best.lost / total };
}
