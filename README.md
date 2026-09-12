# aether-theater-feed

Validator for the canonical Aether Theater Musings endpoints. It checks the
source feeds in place; it does not transform, generate, mirror, republish, or
deploy content. Canonical content remains at AetherTheater.com.

## Setup

Use Node.js 24.x. No package installation is required.

```text
npm test
npm run validate
```

The validator checks only these canonical endpoints:

- `https://aethertheater.com/musings/f.json`
- `https://aethertheater.com/musings/f.rss`
- `https://aethertheater.com/musings/f.atom`

The JSON check requires the observed JSON Feed v1 top-level structure,
including a non-empty `items` array. Each item must contain non-empty `id`,
`html_content`, `url`, `title`, `summary`, and `date_modified` fields. IDs and
URLs must be HTTPS URLs and dates must be parseable. RSS and Atom responses must
be non-empty, complete-looking XML documents with their expected feed elements.

## Recovery

If validation fails, inspect the endpoint named in the error and retry after
the source site is available. The validator intentionally has no local source
override, cache, output directory, generated artifact, scheduler, or publishing
step, so it cannot mask an unavailable canonical endpoint with stale content.

## Limitations

This v1 performs structural and plausibility checks only. It does not perform
full XML schema validation, compare content across the three representations,
or guarantee that every source value is semantically correct.
