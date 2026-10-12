# Mathematical contract

All game probabilities are exhaustive counts, computed from `src/engine.js` by `npm run build` and stored in `public/spots.json`. Exact targets are never approximated. Estimate mode also displays a separately labeled quick-math value from `src/rules.js`; each shortcut has an engine-measured error report below. Every result has `method: "exact"` and `error: 0`, meaning **zero sampling error**. Ratios use IEEE-754 arithmetic; displayed percentages round to two decimals (maximum rounding error 0.005 percentage points). Scenario pot/bet/payout amounts and grading thresholds are declared inputs, not empirical estimates.

## Hand ranking

Cards use 52 unique integer IDs. The evaluator chooses the best five-card hand out of five to seven cards, with ace-low straights, full tie-breaking kickers, and no requirement to use either hole card. It counts ranks and suit masks and returns a category plus descending tie breakers. A royal flush belongs to the straight-flush category.

The tests cover all categories, all **2,598,960** five-card hands, and 2,000 deterministic seven-card samples against an independent, sorting-based five-card subset oracle. Expected category counts, from high card upward:

| Category | Count |
| --- | ---: |
| High card | 1,302,540 |
| One pair | 1,098,240 |
| Two pair | 123,552 |
| Three of a kind | 54,912 |
| Straight | 10,200 |
| Flush | 5,108 |
| Full house | 3,744 |
| Four of a kind | 624 |
| Straight flush | 40 |

These are the standard five-card category totals; see [Cactus Kev’s evaluator explanation](https://suffecool.net/poker/evaluator.html). The implementation does not copy its lookup-table algorithm.

## Equity and win probability

Given two hole cards per player and a board, remove all known cards, enumerate every legal unordered completion to a five-card board, and compare the best hands. Enumerating unordered runouts is exact for showdown because all orderings of a given completion have equal probability.

- Outright win chance = wins / total.
- Tie chance = ties / total.
- Heads-up equity (pot share) = (wins + ties / 2) / total.

**Classic** asks for outright win chance. **Estimate**, the new default, asks for pot-share equity so that preflop 55/45, 70/30 and 80/20 rules use the same target as the engine. This distinction is explicit above the input. Pot odds always use **equity**, including ties.

A range is expanded into actual two-card combinations. Known hero/board blockers are removed, duplicates are deduplicated, and every remaining combination has equal weight. Each combo has the same number of runouts. Supported authored notation: `AA`, `AKs`, `AKo`, `AK`, and explicit `AsKh`, separated by commas/spaces. No implicit weighted, plus, or dash notation.

### Fixed references

- `As Ah` versus `Kc Kd`, preflop: **1,388,072 wins, 6,538 ties, 317,694 losses**, over **1,712,304** boards. Win probability **81.06457731804633%**; equity **81.25548967940273%**. A suit-isomorphic example `Ah Ad` vs `Kc Ks` has the same published **81.25549%** exact equity on [Acalculator’s equity reference](https://www.acalculator.org/game/poker-equity-calculator).
- `9s 8s` versus `Ah Kd`, on `Kh 2s 7s`: **389 wins, 0 ties, 601 losses**, over **990** runouts; equity **39.292929292929294%**. This reference is regenerated independently in the test with a five-card subset oracle, not copied from the engine under test. Some wins are runner-runner improvements; the flush-completion rate alone is not showdown equity.

Input cards are validated for rank, suit, duplicates, overlap and permitted board length. Impossible/empty ranges are rejected.

## Outs and hit odds

Opponent cards are unknown. There are 47 unseen cards on the flop and 46 on the turn. An out is an immediate next card that completes the stated straight, flush, or either target. Combination draws use a union, so overlapping outs count once.

The question is explicitly **hitting at least one current out by the river**, not all possible runner-runner paths and not winning at showdown. Enumerate all remaining one- or two-card runouts and count those containing a listed out. As an independent formula:

- Flop, `o` outs: `1 − ((47 − o)/47) × ((46 − o)/46)`.
- Turn, `o` outs: `o/46`.

For a nine-out flop flush draw this is `378/1081 = 34.96762257169288%`. The rule of 4 says 36%, **1.0323774283071216 percentage points high**. On the turn it is `9/46 = 19.565217391304348%`; the rule of 2 says 18%, **1.5652173913043477 points low**. Estimate mode shows additional measured shortcuts below. Every reveal compares guess, quick math and exact value, including each absolute error. At 15 outs on the flop, 4 × 15 = 60% versus 54.1165587419% exact: 5.8834412581 points high. Algebraically, 4 × outs overstates the flop hit rate from 7 outs onward; at 4 outs it is 0.4662349676 points low.

## Pot odds and implied odds

Let `P` be the pot **before** the opponent bets, `B` the opponent’s bet and our call cost, `e` our exact pot-share equity, and `w` our exact outright win probability. Final pot on a call is `F = P + 2B`.

With no future betting, no rake, and full equity realization:

- Required equity = `B/F`.
- Call EV = `eF − B`.
- Fold EV = 0. Earlier contributions are sunk costs.
- Grade call for nonnegative EV (within numerical tolerance `1e-10`), otherwise fold.

Implied-odds spots explicitly posit an additional **net** payout `X` on outright wins only, no extra losses/costs, and full equity realization. They are conditional arithmetic exercises, not predictions of opponent behavior:

- Model call EV = `eF − B + wX`.
- Minimum extra net payout per win = `max(0, (B − eF)/w)` if `w > 0`.
- If direct EV is already nonnegative, no extra is needed. If it is negative and `w = 0`, no finite win-only payout can rescue the call.

The app compares direct required equity with actual equity, then explains the extra-payout contribution where relevant. It does not treat an assumption as a guaranteed payoff or claim this is a complete poker strategy. Pot-odds drills retain their heads-up betting model. Equity drills also include multiway pots. Side pots, rake, tournament utility, and later decision trees are not modeled.

## Range reading

After removing board blockers, classify every legal combo exactly once:

1. **Made:** best hand is one pair or better. Includes a pair on the board and takes priority over draw potential.
2. **Draw:** otherwise unpaired, and at least one legal next card makes a straight or flush. This includes gutshots and four-flushes, including a possible shared board flush. No draws exist on the river.
3. **Air:** everything else, including backdoor-only possibilities.

This is a declared drill convention, not a universally agreed strategic definition. UI labels and explanations disclose the convention. Full combo lists are available in the result’s math disclosure.

## Estimate mode and grading

Estimate mode asks one number per spot:

| Drill | Target | Score scale |
| --- | --- | --- |
| Equity | Exact pot-share equity, including the actual fraction of each split pot | 100 percentage points |
| Outs & odds | Hit at least one current out by river | 100 percentage points |
| Pot odds, direct | Bet / (pot before bet + 2 × bet) | 100 percentage points |
| Pot odds, implied | Minimum additional net payout per outright win | The call cost in dollars |
| Range reading | Made, draw or air share (specified by the spot); for the eight combo lessons, available combinations | 100 percentage points or 16 combos |

`absoluteError = abs(guess − exact)` in the displayed unit. `score = max(0, 100 − 100 × absoluteError / scale)`. Raw error, guess, quick math, exact target, rule ID, score, time and timeout status are saved. Equity estimates within an inclusive ±5 percentage points override the score to 100. Other estimates retain continuous scoring. A normalized error no larger than 5 gets a positive reveal. Every third consecutive close estimate celebrates. Classic has its own correct-answer streak. Streaks are captured when an answer is graded, so returning to an earlier result preserves the streak earned there. Empty/nonfinite/out-of-range drafts on expiry earn 0, with no invented numeric guess or error. Valid drafts on expiry receive the same closeness score as an early submission. No speed bonus or penalty changes the arithmetic.

The default is Untimed. A chosen 10-, 20-, or 30-second clock starts **after** the 1.5-second deal (180 ms with Reduce Motion). Change the duration or choose Untimed before or during a question. Saved time preferences remain in effect. Changing drills, theme or browser visibility does not reset the absolute wall-clock deadline. Returning to an expired spot grades its draft immediately. Changing the shared time setting intentionally starts a fresh budget for every open, unanswered Estimate spot; Untimed removes all those deadlines. A browser reload abandons the unsaved spot. No timer applies to Classic.

Per-drill and per-rule estimation accuracy is the average 0–100 score, with chronological charts of up to five attempts per dot (latest twelve groups). Rule views also show mean raw error in that rule's unit. Missing guesses count as zero scores but are omitted from mean raw error. Weakest-rule practice chooses the lowest mean score among rules with at least three attempts (ties prefer more attempts). Scaled dollar/combo scores are teaching conventions that allow a single progress scale; they do not imply dollars and percentage points are equivalent.

Classic preserves the original grading: win chance within 5 percentage points; exact outs plus hit chance within 5 points; all range components within 5 points and summing to 100 (0.011-point input tolerance); higher-EV call/fold decision. Classic per-drill accuracy and weak-topic views exclude Estimate records. Original history remains readable. No retention cap, network destination, or storage migration discards old attempts; failed storage stays in memory with a warning.

Entering or clearing focused practice starts fresh spots in both modes for that drill, preserving recorded history. Both modes traverse the matching spot set; Classic attempts count toward that sequence by recorded spot ID. Ordinary mode switches retain each mode's existing draft/result. Progress drill links select the mode named by their section.

## Audit method and limitations

Run `npm run math:audit` to write `public/rules.json` and the generated table below, then `npm run build`. `npm test` independently **reruns every measurement**, compares the complete report to the saved file and app data, and checks that MATH.md contains the regenerated table. Every authored estimate must reference a measured rule and fall within its measured worst-case error.

The deterministic sweep uses:

- 54 fixed preflop hand matchups spanning rank gaps, suits, connected overcards and low shared kickers. Each enumerates all **1,712,304** remaining boards; reversing the players yields 108 rule measurements without recomputing the identical boards.
- 3,000 seeded legal flop/turn deals for draws, excluding already-made targets and zero-out hands, plus all authored draw examples. These are current-out hit probabilities, not showdown equities.
- All authored postflop equity spots, eight additional seeded four-way turn/river deals, and 120 seeded legal heads-up flop/turn/river deals; all their remaining boards are exhaustively enumerated. Seven bet/pot ratios per spot exercise pot and implied arithmetic. No-positive-win cases are excluded from the finite implied-payout measurement and are covered by the engine's zero-win/tie boundary tests.
- All 256 subsets of the eight relevant A/K cards for each of the four combo forms. This is exhaustive blocker arithmetic (including empty-range and extreme blocker boundary cases); not every subset is a single visible board. Legal board blockers are also exercised in authored practice spots.
- All authored ranges plus 120 seeded legal boards for made, draw and air share rounding (420 category measurements).

Selecting a deterministic collection of **spots** is not Monte Carlo equity: each spot's target has zero sampling error. The means weight each listed case equally, not by real-world hand frequency. Worst errors are **observed on this corpus, not universal bounds**. More extreme untested matchups may be worse. Display rounding can contribute up to 0.005 in a value's displayed unit; direct/implied formulas use full stored probabilities, while the question displays equity to two decimals.

For postflop quick equity, score each legal next card as 1 for winning, 1 divided by the number of winners for a split, and 0 for losing at that next-card showdown. With factor `f = 4` on the flop or `2` on the turn, use `f × winning-equivalent cards` when behind, `100 − f × losing-equivalent cards` when ahead, and `100 × currentShare + f × (winning-equivalent cards − unseen × currentShare)` when currently tied; clamp each matchup to [0,100] before averaging equally over legal joint opponent assignments. This shortcut ignores runner-runner routes and redraws and can be poor on shared high-card boards. River share counts winning/tied combos directly. The exact reveal always supersedes these shortcuts.

Combo and pot-price rules are exact arithmetic shortcuts. Implied odds use the declared win-only extra-payout model; they are not forecasts of payment. Range-share quick math counts blocker-adjusted combos in the asked category using the same classification contract above, divides by total combos and rounds to a 5-point increment (at most 2.5 points rounding error). Counting mistakes by the learner are part of their guess error, not the rule's rounding error. The broad 70/30 rule is particularly weak with low kickers that often play the board; its large measured miss is intentionally disclosed.

## Measured mental-math rules

<!-- RULE AUDIT START -->
| Rule | Cases | Mean absolute error | Worst absolute error | Signed range (quick − exact) |
| --- | ---: | ---: | ---: | ---: |
| Rule of 2 | 361 | 1.1567 pp | 2.6087 pp | -2.6087 to -0.6957 pp |
| Rule of 4 | 172 | 0.6811 pp | 5.8834 pp | -0.4662 to 5.8834 pp |
| Pair vs two overcards | 18 | 2.7923 pp | 5.0842 pp | -2.1648 to 5.0842 pp |
| Two overcards vs pair | 18 | 2.7923 pp | 5.0842 pp | -5.0842 to 2.1648 pp |
| Dominated preflop hands | 36 | 5.9666 pp | 17.0702 pp | -17.0702 to 17.0702 pp |
| Pair vs pair | 36 | 1.2623 pp | 2.2167 pp | -2.2167 to 2.2167 pp |
| Postflop outs shortcut | 92 | 2.7199 pp | 23.9293 pp | -6.4444 to 23.9293 pp |
| Multiway outs & pot shares | 12 | 0.1288 pp | 0.9211 pp | -0.9211 to 0.6250 pp |
| River range share | 42 | 0.0000 pp | 0.0000 pp | 0.0000 to 0.0000 pp |
| Price of a call | 1022 | 0.0000 pp | 0.0000 pp | 0.0000 to 0.0000 pp |
| How much more to win | 819 | 0.0000 $ | 0.0000 $ | -0.0000 to 0.0000 $ |
| Pair combos | 256 | 0.0000 combos | 0.0000 combos | 0.0000 to 0.0000 combos |
| Unpaired combos | 256 | 0.0000 combos | 0.0000 combos | 0.0000 to 0.0000 combos |
| Suited combos | 256 | 0.0000 combos | 0.0000 combos | 0.0000 to 0.0000 combos |
| Offsuit combos | 256 | 0.0000 combos | 0.0000 combos | 0.0000 to 0.0000 combos |
| Range category share | 420 | 0.6075 pp | 2.5000 pp | -2.4468 to 2.5000 pp |

- **Rule of 2:** One card to come: outs × 2 ≈ hit %; it understates the exact chance. Largest measured error: Js Ts vs unknown / 9s Qd 2s 4c (15 outs).
- **Rule of 4:** Two cards to come: outs × 4 ≈ hit %; from 7 outs it overstates, especially with combo draws. Largest measured error: 9h 8h vs unknown / 7h 6c Kh (15 outs).
- **Pair vs two overcards:** A pair against two higher cards starts around 55% equity (55/45). Largest measured error: 2c 2d vs Ah Kh / preflop.
- **Two overcards vs pair:** Two higher cards against a lower pair start around 45% equity (45/55). Largest measured error: Ah Kh vs 2c 2d / preflop.
- **Dominated preflop hands:** With one shared rank, favor the higher kicker about 70/30; suits and connectivity matter. Largest measured error: Ac 3d vs As 2h / preflop.
- **Pair vs pair:** The higher pocket pair starts around 80% equity (80/20). Largest measured error: 2c 2s vs Ac Ad / preflop.
- **Postflop outs shortcut:** If ahead, subtract losing outs × 4 (flop) or × 2 (turn); if behind, multiply winning outs; ties count half; ignore redraws and backdoors (unreliable when currently tied). Largest measured error: 2s 6h vs 3s 5s / Td Ac Ks.
- **Multiway outs & pot shares:** Turn: rounded clean outs ÷ remaining cards. Average over legal ranges; split pots count fractionally. Largest measured error: 8c 8d vs unknown / 8h Qh 2s 4c.
- **River range share:** With no cards left, count winning combos plus half the tied combos, then divide by all combos. Largest measured error: 8h 2h vs Th 9h / Kd Ks Ah Ts 2s.
- **Price of a call:** Bet ÷ (pot before bet + 2 × bet): half pot 25%, pot 33⅓%, twice pot 40%. Largest measured error: 8h 2h vs Th 9h / Kd Ks Ah Ts 2s, pot 100, bet 300.
- **How much more to win:** Extra net needed per win = max(0, (call − equity × final pot) ÷ win chance); use probabilities, not percentages. Largest measured error: 2d 6s vs 3h 2s / 3d Ts 3c, pot 100, bet 50.
- **Pair combos:** A pair has 6 combos; with n unblocked cards of its rank, count n × (n − 1) ÷ 2. Largest measured error: AA, blocked Ac Ad Ah As Kc Kd Kh Ks.
- **Unpaired combos:** Two different ranks have 16 combos; multiply the number of unblocked cards of each rank. Largest measured error: AK, blocked Ac Ad Ah As Kc Kd Kh Ks.
- **Suited combos:** A suited hand has 4 combos; keep only suits where both cards remain unblocked. Largest measured error: AKs, blocked Ac Ad Ah As Kc Kd Kh Ks.
- **Offsuit combos:** An offsuit hand has 12 combos; multiply remaining rank counts, then subtract surviving suited combos. Largest measured error: AKo, blocked Ac Ad Ah As Kc Kd Kh Ks.
- **Range category share:** Count blocked combos in the asked category ÷ all available combos, then round to the nearest 5%. Largest measured error: AA, KK, QQ, AK, AQ, KQ, QJs, JTs / 2h 3h Jh (air).
<!-- RULE AUDIT END -->


## Multiway tournament practice

The four added equity spots use three opponents. Each seat supplies either an exposed two-card hand or an explicit range. Enumerate every legal joint assignment, reject overlaps with hero, board, and other seats, then enumerate every remaining board. Each joint assignment and remaining board are equally weighted. No arbitrary hidden hand is selected.

Equity is `(wins + two-way splits / 2 + three-way splits / 3 + four-way splits / 4) / outcomes`. All players contest one equal-share pot; there are no side pots. Royal flush on the board four-way: 0% outright wins, 100% ties, 25% pot share. With As Js on Ks 8s 3d 2c against Kc Qd, Qh Qc, Th Td, 9 spades and 3 aces win: 12 of 40 rivers = 30%.

Equity Estimate grading awards 100 points within an inclusive ±5 percentage-point grace range. The displayed accepted interval rounds inward to avoid promising credit outside that range. Other drills retain their existing scoring. Prior history is preserved without regrading.

The outs shortcut is an approximation, not a bound. On multiway turns, the quick estimate rounds the range-weighted winning-equivalent outs (or losing-equivalent outs when ahead) to a whole card, then divides by the actual remaining deck size. Four players on the turn leave 40 cards per legal deal. Other postflop shortcuts retain the rule of 2/4 above. Multiway ranges are averaged jointly and split pots use actual shares. These are chip-equity exercises: bubble and pay-jump decisions also depend on ICM, stack sizes, ranges, and future betting.

### Independent checks of the pictured hands

`tests/multiway.test.mjs` separately expands the opponent ranges, rejects overlapping cards, enumerates every river, and ranks all five-card subsets with the independent reference evaluator. It verifies every authored multiway spot, including:

| Hero / turn board | Legal deals | River outcomes | Wins | Equity |
| --- | ---: | ---: | ---: | ---: |
| As Js / Ks 8s 3d 2c, versus KQ / QQ / TT | 216 | 8,640 | 2,322 | 26.875% |
| 8c 8d / 8h Qh 2s 4c, versus AA,KK / AhKh,AhJh,KhJh / AQ | 171 | 6,840 | 5,535 | 80.9210526…% |

Neither case ties. The first hand has four spades: currently high card with a flush draw. The second has three eights. Tests explicitly check that a fifth spade completes the first hand's flush, and that the deck contains 52 unique, round-trippable cards. The existing evaluator suite also checks all 2,598,960 five-card category frequencies and 2,000 independently ranked seven-card hands.

The ±5-point allowance is a teaching threshold, not a standard deviation or confidence interval. For the second hand, a 75% guess is 5.9210526… points low; 76% through 85% are accepted whole-number answers. At two decimals the accepted range is 75.93%–85.92%, rounded inward from the unrounded limits. Both Classic and Estimate now display the appropriate target's range. Existing history is not regraded.

The UI typesets fractions and multiplication with native MathML, without a runtime math library. Detailed counts and measured shortcut errors remain inside “Show the math.”

### Draw sets and combinations

Draw lessons show the actual current-out set as card faces. With 9 outs and 46 unseen cards on the turn:

```math
P(\mathrm{hit})=\frac{\binom{9}{1}}{\binom{46}{1}}=\frac{9}{46}\approx19.57\%.
```

On the flop, 47 cards are unseen. With the same 9 current outs, count the complement: both remaining cards miss.

```math
P(\mathrm{at\ least\ one\ current\ out})=1-\frac{\binom{38}{2}}{\binom{47}{2}}=\frac{378}{1081}\approx34.97\%.
```

These are draw-hit probabilities, not showdown equity. Other runner-runner improvements are excluded. The visible combination formulas contain LaTeX annotations in their semantic MathML markup. Explicit card codes in ranges are displayed with readable ranks and suit symbols; `Ts` is 10♠, whereas `AKs` is a suited range token.

### Accuracy heatmap

The gradient encodes closeness to the exact target, not a probability density or confidence interval. Green peaks at the exact value and fades through amber to red with increasing error. The outlined band marks ±5 percentage points. The axis focuses on the target neighborhood (rounded outward in five-point increments and clipped to 0–100); guesses outside the axis appear at its edge with an explicit off-scale arrow and value.

Percentage estimates within 1 point say “Spot on!”, within 2.5 say “Great read.”, and within 5 say “In range.” The grading threshold itself is unchanged. Accepted answers get a short marker pop and two expanding rings; reduced motion removes those effects. Historical attempts are preserved.

Teaching references: [PokerStars: counting outs](https://www.pokerstars.com/poker/learn/lesson/calculating-outs/), [pot odds](https://www.pokerstars.com/poker/learn/lesson/pot-odds/), and [ICM in tournaments](https://www.pokerstars.com/poker/learn/lesson/icm-and-its-impact-on-tournaments/).
