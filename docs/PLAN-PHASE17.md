# Phase 17: Honest numbers, a defeat that explains itself

Status: **built, 2026-10-29.** Lead: the Claude session (small enough to do without engineers).

**Why this phase.** A first-session playtest (tools/playtest.mjs, desktop, seed 7) won its third battle by sending 244
troops into a keep that had grown to 98, and the results card read **"3 killed · 0 lost"**. The card's two battle numbers
were wrong in every fight, and the one tip a losing player gets never said what actually beat them.

## 17A. Every casualty counted
- **The bug.** `battle.stats.lost/killed` were only credited when a squad died in a field clash (its troops at the start of
  that tick) or a site was captured (its last garrison). Nothing ground down in an assault was counted, on either side;
  squads that died assaulting a site, tower arrows, Firestorm, scorch and burn, Blood Price, the Dragon's breath, the
  Tide and Broadside were never counted at all.
- **The fix.** `battle/casualties.js` `casualty(battle, owner, amount, at?)` is called wherever troops die: the clash and
  assault trades tick by tick (both sides), the few left under the death threshold, arrows, Firestorm, scorch/burn, Blood
  Price, Dragon breath, the Tide (sea and the Throne's borrowed one) and Broadside.
- **Bookkeeping only.** No rule reads these numbers. An A/B over nine bot battles (HEAD vs this tree) gave byte-identical
  final battle state apart from `stats`: "0 lost · 2 killed" became "82 lost · 54 killed".
- **Tests.** battle.casualties.test.js: with zero growth, troops are conserved exactly (a failed assault loses all it
  sent; a capture kills the whole garrison, and lost + new garrison = sent).

## 17B. The defeat names the settlement that broke you (BACKLOG "small polish")
- **What gets recorded.** `stats.fellAt { [siteId]: troops }` holds the player's losses against each site (assaulting it,
  or under its arrows).
- **When a site is named.** `costliestSite` names one when it holds at least `AFTER_ACTION.minLost` (10) troops and
  `minShare` (40 %) of everything lost.
- **What the card says.** app/defeatTip.js turns that into the tip: where, how many, and the advice for its kind.
  - keep: regrows, so take the settlements around it and hit it at once (with Rally)
  - fort: soften it with Firestorm, or take its neighbours first
  - tower: arrows, so march around it or take it early
  - Gate
  - your War Camp: retaken after the enemy took it
  - anything else: squads arriving one at a time feed a garrison

  Example: "64 of the 98 troops you lost fell at the hamlet of Kilwick. Squads that arrive one at a time just feed a
  garrison: send from several settlements at once, or use Rally."
- **Powers.** A tip never names a power the player can't use (Iron Will, Holy Ground, not unlocked).
- **The Retreat card too.** A battle is only lost when you hold nothing, so most failed attacks end in a Retreat. That
  card now reads "No harm done." and then the same line.
- **On the map.** A red ring pulses on the named settlement behind the card (`DEFEAT.markPulseMs`; none under Reduce
  Motion).
- **Fallbacks.** With no site standing out, the old situational tips stay. "You are trading troops badly" was tuned on
  the broken counts and would have fired on most defeats: it now needs lost > 2 × killed (`AFTER_ACTION.badTrade`).
  Measured over 126 bot defeats and 77 wins: wins run 1.22 at the median, defeats 0.85, the worst tenth of defeats 1.9.
- **How often a site is named.** 39 of 126 bot defeats name a site; the rest lost troops all over the field.

## QA
- `npm test`
- `node tools/checkpure.js`
- a real-browser retreat at 1440×900 and 390×844 (the line fits in four lines on a phone)
- the full `node tools/check.mjs`
