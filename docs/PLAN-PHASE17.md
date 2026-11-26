# Phase 17: Honest numbers, a defeat that explains itself

Status: **built, 2026-10-29; second round 2026-11-26** (17A's kill rule, 17C, 17D). Lead: the Claude session (small enough to do
without engineers).

**Why this phase.** A first-session playtest (tools/playtest.mjs, desktop, seed 7) won its third battle by sending 244
troops into a keep that had grown to 98, and the results card read **"3 killed · 0 lost"**. The card's two battle numbers
were wrong in every fight, and the one tip a losing player gets never said what actually beat them.

## 17A. Every casualty counted
- **The bug.** `battle.stats.lost/killed` were only credited when a squad died in a field clash (its troops at the start of
  that tick) or a site was captured (its last garrison). Nothing ground down in an assault was counted, on either side;
  squads that died assaulting a site, tower arrows, Firestorm, scorch and burn, Blood Price, the Dragon's breath, the
  Tide and Broadside were never counted at all.
- **The fix.** `battle/casualties.js` `casualty(battle, owner, amount, by, at?)` is called wherever troops die: the clash
  and assault trades tick by tick (both sides), the few left under the death threshold, arrows, Firestorm, scorch/burn,
  Blood Price, Dragon breath, the Tide (sea and the Throne's borrowed one) and Broadside.
- **Whose kills (second round).** `by` is the owner whose troops, towers or powers did the killing.
  - `killed` counts only `by` = the player. Aggressive, swarm, raider and Usurper factions also storm Free Folk sites in
    the same arena, and the first round counted both sides of those fights as the player's kills: 39 of 330 bot battles
    over-counted, by up to 39.
  - `lost` still counts every troop of the player's, whatever killed it.
- **Bookkeeping only.** No rule reads these numbers. A/B against `main`: byte-identical final battle state apart from
  `stats`, over nine fixture battles ("0 lost · 2 killed" became "82 lost · 54 killed"), over 330 full bot-vs-AI
  battles on four real worlds (aggressive, defensive, swarm and passive rivals), and over 432 on special worlds:
  - 9 Tide Fortress battles
  - 18 Dragon lairs
  - 3 Throne of Ages battles
  - 54 against the Ashen Host, 63 against the Sea Kings, 15 against the Usurper

  None crashed, and no count went negative or non-finite. Broadside, a General's ability, is not exercised: the harness
  fights without Generals.
- **Tests.** battle.casualties.test.js: with zero growth, troops are conserved exactly (a failed assault loses all it
  sent; a capture kills the whole garrison, and lost + new garrison = sent). A faction taking a Free Folk hamlet adds
  nothing to `killed` (this test fails on the first round's rule).
- **The card.** "killed" and "lost" now sit side by side on the victory card whatever else it shows. The clock fills an
  odd row of gains before them, or follows them (checked in a real browser for all 8 combinations of crown bonus, perk
  and the Tide, at 390 and 1440 px).

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

## 17C. More of the loop made visible (extends 16C)
- **The gap.** 16C's green ▲ followed only a War Council purchase. Other choices also make a frontier region easier, and
  nothing on the map said so:
  - a Work, which helps the battles next door
  - a General's skill (the card credits its default commander)
  - a mercenary hired
- **Now.** All of these mark the region ▲ for 20 s, as the council does.
  - **One toast, not two.** A Work's own toast carries the news: "Barracks built in Lowshire · ▲ Corworth is easier now".
  - **Generals.** A skill or a hire posts "▲ Corworth is easier now", which waits until the Generals panel closes.
- **Not covered.** Boon picks: they mostly happen in the post-battle sequence, where the map is busy with the conquest.
- **A check at last.** 16C had none (probes and screenshots only). `node tools/check.mjs --only=marks` (tools/labelMarkChecks.mjs)
  covers desktop and phone. A search finds each stage, so a retune never breaks it:
  - a Work that changes nothing: no ▲ in its toast, no mark
  - a Work that flips a neighbour: one toast with the ▲, and the mark
  - the marks gone 20 s later
  - a council purchase: the ▲ toast once the council closes, and the mark
  - `window.__hd.improvedRegions()` (dev) lists the marked regions.

## 17D. Small fixes
- **Plurals.** The keyboard cursor's "1 troops", the streak chip's screen-reader "1 seconds" and the Chronicle's "Best Daily
  · 1 crowns" now read singular. A scan of ui/, app/, scenes/ and meta/ for a number printed before a common noun (regions,
  troops, crowns, seconds, stars, ...) found no others that can reach 1.
- **tools/playtest.mjs** reached the founding again. After `conquerRegions(999)` the claimed Relics played their moments
  one after another over the HUD, so the Realm press only skipped one claim. It now taps each moment away (Relic, duo
  reveal, Boon draft) like a player. The phone run plays through Found a Dynasty and the first Dynasty II battle, with no
  console errors.
- **tools/firstHourBot.mjs** never attacked on a phone: its on-screen test kept 420 px clear for the desktop region card,
  which is below zero at 390 px wide. It now uses the phone's own margins (the card is a bottom sheet there).

## QA
- `npm test`
- `node tools/checkpure.js`
- `node tools/modulepreload.mjs --check`
- a real-browser retreat at 1440×900 and 390×844 (the line fits in four lines on a phone)
- the victory card's rows in a real browser (17A)
- `node tools/check.mjs --only=marks` (17C)
- the full `node tools/check.mjs`
