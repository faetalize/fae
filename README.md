# fæ

a tiny dark pixel fairy

```
node src/render.mjs awake|frantic|asleep|faces output.svg [freeze_seconds]
```

use the `FAIRY_COUNT` env variable to choose the number of contributions she reads out in her speech bubble, e.g. `FAIRY_COUNT=12 node src/render.mjs awake output.svg`. she doesn't speak when asleep.

`api/current.mjs` serves her on vercel at `/current.svg`, which is what the profile links to. `src/pick_mood.mjs` picks her mood from the last 24 hours of contributions, and vercel caches each image for 30 minutes.

it needs a `GITHUB_TOKEN` env variable. any github token works if the profile shares private contributions. if it doesn't, use one with the `read:user` scope so private work still counts.

## licences

- `art/` and any image of her, including what the renderer outputs: [FaeCL-1.0](LICENSE-ART)
- everything else: [GPL-3.0](LICENSE)
