# aether-theater-feed

Validator and static compatibility mirror for the canonical Aether Theater
Musings feeds. AetherTheater.com remains the canonical source; the mirror is
only an alternate machine-readable location for feed readers and AI tools.

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

## Local mirror generation

The mirror command requires an output directory outside the repository's
tracked files:

```text
node scripts/mirror-feeds.js C:\path\to\temporary-pages-output
```

It fetches the three fixed canonical endpoints, validates all responses, then
copies their response bytes unchanged to `f.json`, `f.rss`, and `f.atom` and
copies the compatibility-only `index.html`. It does not rewrite or regenerate
feed content. If any fetch or validation fails, it exits before creating the
output directory.

## GitHub Pages

`.github/workflows/pages.yml` runs tests and the mirror command on a schedule
and by manual dispatch. It uploads one Pages artifact only after all three
canonical responses validate, then deploys it with GitHub Pages. Configure the
repository's Pages source to **GitHub Actions** once in repository settings.

For this repository, the expected project Pages URLs are:

- `https://awrightcsa.github.io/aether-theater-feed/`
- `https://awrightcsa.github.io/aether-theater-feed/f.json`
- `https://awrightcsa.github.io/aether-theater-feed/f.rss`
- `https://awrightcsa.github.io/aether-theater-feed/f.atom`

Generated mirror files are temporary workflow artifacts and must not be
committed to `main`.

## Recovery and limitations

If a refresh fails, the workflow exits before artifact upload/deployment, so
the last successful Pages deployment remains live. Inspect the endpoint named
in the error and retry after the canonical source is available.

Validation is structural and plausibility-based. It does not perform full XML
schema validation or semantic comparison across feed formats. Custom domains,
databases, servers, caching sophistication, archives, and non-Pages targets
are intentionally out of scope.
