# fæ

a tiny dark pixel fairy

```
node src/render.mjs awake|frantic|asleep|faces output.svg [freeze_seconds]
```

use the `FAIRY_COUNT` env variable to choose the number of contributions she reads out in her speech bubble, e.g. `FAIRY_COUNT=12 node src/render.mjs awake output.svg`. she doesn't speak when asleep.

`src/pick_mood.mjs` picks her mood from the last 24 hours of contributions. every 30 minutes an action publishes the result to the `output` branch, which is what the profile links to.

## licences

- `art/` and any image of her, including what the renderer outputs: [FaeCL-1.0](LICENSE-ART)
- everything else: [GPL-3.0](LICENSE)
