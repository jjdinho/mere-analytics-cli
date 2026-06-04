# Mere Analytics CLI

A thin terminal wrapper around the [Mere Analytics](https://app.usemere.com) HTTP
API. Authenticate once in your browser, then run SQL and read your schema from
the command line.

By default the CLI works with the hosted cloud version at
`https://app.usemere.com`. It also works against any self-hosted instance of the
open-source server — [`jjdinho/mere-analytics`](https://github.com/jjdinho/mere-analytics)
— via `--api-url` (see [Self-hosting](#self-hosting)).

```
mere auth login          # browser OAuth, pick a project
mere schema              # list queryable tables and columns
mere query "SELECT event, count() AS n FROM events GROUP BY event ORDER BY n DESC LIMIT 10"
```

## Install

```bash
npm install -g mere-analytics-cli
```

Or run it from source:

```bash
npm install
npm run build
node dist/index.js --help
```

Requires Node.js 18+.

## Authentication

```bash
mere auth login
```

This runs the OAuth 2.1 authorization-code + PKCE flow: it opens your browser,
you sign in and choose **which project** to grant, and the CLI stores the
resulting access token in `~/.mere/config.json` (mode `0600`).

Access tokens last one hour. When yours expires, just run `mere auth login`
again.

```bash
mere auth status         # show the active instance, project, and expiry
mere whoami              # confirm the identity/project your token is bound to
mere auth logout         # delete stored credentials
```

## Self-hosting

By default the CLI talks to the hosted cloud instance at
`https://app.usemere.com`. Mere Analytics is also fully open source and
self-hostable — [`jjdinho/mere-analytics`](https://github.com/jjdinho/mere-analytics).
To point the CLI at your own instance, pass `--api-url` at login:

```bash
mere auth login --api-url https://analytics.example.com
```

The URL is saved alongside your token, so every later `query`, `schema`, and
`whoami` automatically targets that instance. Switch back to the cloud (or
another instance) by logging in again with a different `--api-url`.

## Commands

| Command | Description |
|---|---|
| `mere auth login [--api-url <url>]` | Authenticate via the browser. `--api-url` selects a self-hosted instance. |
| `mere auth logout` | Clear stored credentials. |
| `mere auth status` | Show the active instance, project, and token expiry. |
| `mere query [sql]` | Run read-only ClickHouse SQL. Reads from stdin if no argument is given. |
| `mere schema` | Show the queryable tables and columns for your project. |
| `mere whoami` | Show the identity and project your token is bound to. |

## Querying

Pass SQL as an argument or pipe it via stdin:

```bash
mere query "SELECT count() FROM events"
cat report.sql | mere query
```

Queries run against three tables — `events`, `persons`, and `sessions` — scoped
automatically to your project (you never add a `project_id` filter). Results are
capped server-side, so always include a `LIMIT`. Run `mere schema` to see every
column, type, and description.

## JSON output

Add `--json` to any command for machine-readable output instead of a table —
useful for scripting and piping into `jq`:

```bash
mere query "SELECT event, count() AS n FROM events GROUP BY event" --json | jq '.rows'
mere schema --json
```

Errors are reported on stderr (or as `{"ok": false, "error": ...}` with `--json`)
and the process exits non-zero:

| Code | Meaning |
|---|---|
| 0 | OK |
| 1 | Usage error (bad arguments, bad SQL) |
| 2 | Not found |
| 3 | Auth error (not logged in / expired token) |
| 4 | Forbidden |
| 5 | Rate limited |
| 6 | Network error |
| 7 | API error (5xx) |

## Development

```bash
npm install
npm test          # run the vitest suite
npm run typecheck # type-check with tsc
npm run build     # bundle to dist/ with tsup
```
