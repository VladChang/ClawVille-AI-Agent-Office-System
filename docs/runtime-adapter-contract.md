# Runtime Adapter Contract (Backend ↔ Frontend)

This document defines the **defensive contract layer** used by frontend runtime integration (`frontend/lib/runtimeContract.ts`).

## Goals

- Keep frontend stable when runtime payloads are partial, malformed, or drift slightly.
- Preserve compatibility across runtime modes:
  - `mock`: local fixtures only
  - `local`: real runtime with mock fallback
  - `real`: strict real runtime path
- Centralize mapping/validation from unknown payloads to typed UI models.

## API Envelope Contract

Expected backend envelope:

```json
{
  "success": true,
  "data": []
}
```

Rules:
- If envelope is invalid (`success !== true` or missing `data`), frontend throws `Invalid API envelope`.
- Mapping is then applied item-by-item with safe filtering.

## Entity Mapping Contracts

### Agent mapping
Required fields:
- `id` (string)
- `name` (string)
- `role` (string)

Fallbacks:
- invalid/missing `status` -> `offline`
- missing `updatedAt` -> epoch ISO (`1970-01-01T00:00:00.000Z`)

Invalid records are dropped.

### Task mapping
Required fields:
- `id` (string)
- `title` (string)

Fallbacks:
- invalid/missing `status` -> `todo`
- invalid/missing `priority` -> `medium`
- missing `createdAt` -> epoch ISO
- missing `updatedAt` -> `createdAt`

Invalid records are dropped.

### Event mapping
Required fields:
- `id` (string)
- `type` (string)
- `message` (string)

Fallbacks:
- missing `timestamp` -> epoch ISO
- invalid/missing `level` -> derived from `type` (`schema.ts` rules)
- invalid `metadata` -> omitted

Invalid records are dropped.

## Realtime Envelope Contract

Expected shape:

```json
{
  "type": "snapshot | state_changed",
  "data": {
    "snapshot": {
      "agents": [],
      "tasks": [],
      "events": []
    }
  }
}
```

Rules:
- Non-matching envelope type is ignored.
- Missing/invalid arrays map to empty arrays.
- Malformed items inside arrays are skipped.
- Parser returns `null` for invalid envelope root to keep WS stream alive.

## Strict Real-Mode Error Contract

When frontend runtime mode is `real`:
- Adapter must not fallback to local fixtures.
- Fetch failures are wrapped as explicit strict-mode errors with prefix `[Runtime mode: real]`.
- Store surfaces this message via `error` + connection hint so operators know this is a runtime wiring issue, not silent fallback.

## Testing Scope

Covered by `frontend/tests/runtimeContract.test.ts`:
- malformed and partial payload mapping
- required field guard behavior
- fallback defaults
- list filtering strategy
- realtime envelope safe parsing
- API envelope validation
