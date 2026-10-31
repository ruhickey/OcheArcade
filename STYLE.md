# Oche Arcade art style

Every generated sprite follows this guide. The menu, setup screens and side panel stay as they are: this covers what's drawn inside each game.

## Style

Hand-painted pub-sign illustration, like a traditional painted English pub sign brought to life as a game piece. Thick warm dark-brown outlines, saturated colours and soft painterly cel shading. No flat vector, no photo textures, no gradients standing in for shading. Sprites sit on a dark chalkboard, so every one needs a strong silhouette that reads from 2.4m away.

## Palette

| Name | Value | Job |
|---|---|---|
| Slate | `#26332F` | The backdrop behind everything, drawn in code |
| Chalk | `#EFEDE3` | Highlights and pale surfaces |
| Sisal | `#D2B07A` | Rope, wood highlights and warm neutrals |
| Pub-sign brown | `#3A2414` | Every outline |
| Board red | `#E0483C` | Player 1, and danger |
| Chalk blue | `#6DB3EA` | Player 2 |
| Amber | `#EBC94F` | Player 3, and gold and celebration |
| Violet | `#C39BEA` | Player 4 |

## Semantic colour

- Red means player 1, danger or a wrong hit.
- Green means success, and never identifies a player, so red and green are never the only difference between two sides.
- Gold means a win or a loot.
- Player colours match the existing tokens in `public/style.css`.

## Lighting

Every sprite uses the same five rules:

1. A warm undertone in every colour, as if lit by warm pub lamps.
2. One light direction: a lamp at the upper left.
3. Distinct highlight and shadow shapes, not one flat mid-tone.
4. A thin warm rim light on the lit edge.
5. A code light grade over each stage: a low warm wash from the upper left, plus a gentle vignette.

## Rules for every sprite

- One object per sprite, each generated against the anchor and cut out on transparency.
- No text, numbers or blank label plates. Numbers are drawn in code, so they stay sharp and can change.
- Moving parts are separate sprites.
- Reuse beats regenerating: tint or mirror one sprite instead of generating a near-duplicate.
- Game rules never depend on the art. Hit areas, zones and positions stay as code, and sprites are drawn to fit them.
- The playfield stays the brightest thing on screen, and nothing should make a target harder to read.
