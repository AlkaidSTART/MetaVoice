# Drawing Positioning QA Cases

Run these on `/canvas` after `npm run dev`.

## Single-scene cases

- `画一个蓝天白云下的小房子，太阳在右上角`
  - Expected: sun is in upper-right safe area, house sits lower center, clouds stay upper half.
- `画一棵树在房子左边`
  - Expected: tree is visibly left of the house and not covering the house.
- `画一条河，河里有一条鱼`
  - Expected: river is lower/middle lower area, fish is inside or near the river.
- `在左上角写上春天`
  - Expected: text is visible and not clipped.

## Append cases

- First: `画一个小房子在草地上`
- Then: `再加一个太阳在右上角`
  - Expected: sun does not cover the house.
- Then: `旁边加一棵树`
  - Expected: tree appears beside the house, not on top of it.

## Failure checks

- No major element should be clipped outside the canvas.
- No two major subjects should share the same center point.
- Background strips may cover large areas; foreground subjects must remain visible.
