I am asleep and cannot answer anything. Never ask questions or wait for confirmation: make a reasonable call, note it in STATUS.md, and keep going until the app is done end to end.

Build a poker probability trainer for No-Limit Texas Hold'em in the browser, in this folder (it is a git repo; commit at each working milestone).

Drills (each one shows a spot, asks for my answer, then grades it and explains why):
1. Equity: my hand against a specific hand or a range on a given board. I estimate my win %, and you show the exact %.
2. Outs and odds: count my outs on the flop/turn and the chance to hit by the river; also show the rule-of-2-and-4 approximation and how far off it is.
3. Pot odds: the pot, the bet and my equity, then call or fold. The explanation compares the equity I need with the equity I have, and adds implied odds where they matter.
4. Range reading: given a range on a board, what fraction is a made hand, a draw or air.

Every number must come from exact enumeration or a Monte Carlo run with the error shown. No strategy claims beyond what the math supports, and no "GTO" label. Track accuracy over time per drill and show weak spots. Phone-friendly and installable as a PWA, no accounts, deployable as a static site; write DEPLOY.md but don't deploy. Tests must check the equity engine against known reference values (for example AA vs KK preflop, and a flush draw vs top pair on the flop) and the hand-ranking evaluator against every hand category.

Design (as important as the math):
- Minimal: one spot on screen at a time, one primary action, almost no text. The explanation appears only after I answer, in 2–3 short lines plus the numbers.
- The graphics must be genuinely good: crisp custom 2D cards and chips, a restrained palette with one accent color, strong typography, generous whitespace. No template look, no default component-library styling, no gradients-for-decoration, no emoji as UI.
- Motion is subtle and purposeful (card deal, flip, a result reveal), 60 fps on a phone, and respects reduced-motion.
- Light and dark mode. Excellent on a phone in portrait first, and good on a laptop.
- Before finishing, screenshot every screen at phone and laptop sizes, critique them against this section, fix what falls short, and save the final screenshots in `screenshots/`.

Write STATUS.md for the morning: what works, what doesn't, how to run it locally, and what you'd build next. Only when every requirement above is met and all tests pass, put the line `ALL DONE` at the top of STATUS.md.
