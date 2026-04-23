# AI Middleware Search Enrichment

This package supports an optional AI middleware layer that can infer filters
from the user query before searching.

## What this extension does

- Calls an external middleware API with the user query
- Reads inferred filters from middleware response
- Merges inferred filters into `filter_by`
- Runs hybrid retrieval when applicable:
  - ranked request: `q=<user_query>`
  - recall request: `q=*`
- Merges + deduplicates hits (ranked first, then recall-only)

## Configuration

```ts
export interface SearchQueryMiddlewareOptions {
  url: string;
  apiKey: string;
  apiKeyHeader?: string;     // default: "x-api-key"
  queryParamName?: string;   // default: "query" (or "q")
  requestTimeoutMs?: number; // default: 5000
  enabled?: boolean;         // default: false
}
```

Example:

```javascript
const client = new Typesense.Client({
  nodes: [{ host: "localhost", port: "8108", protocol: "http" }],
  apiKey: "xyz",
  searchQueryMiddleware: {
    enabled: true,
    url: "http://127.0.0.1:8000/api/search",
    apiKey: "middleware-key",
    apiKeyHeader: "x-api-key",
    queryParamName: "q",
    requestTimeoutMs: 5000,
  },
});
```

## Middleware contract

Expected response shape:

```json
{
  "request": { "query": "beesline deodorant", "case": "Filtered Category" },
  "result": {
    "filters": {
      "brand": ["Beesline"],
      "l4_division_en": ["Women Deodorants", "Men Deodorants"]
    }
  },
  "telemetry": { "...": "..." }
}
```

Only `result.filters` is required for filtering behavior.

## Behavior matrix

### Middleware disabled (`enabled: false`)

- No middleware call
- No inferred filters
- Normal search request only

### Middleware enabled + successful inference

- Middleware called
- Inferred filters merged into `filter_by`
- Hybrid retrieval can run (`q=query` + `q=*`)
- Merged + deduped final hits

### Middleware enabled but fails/timeouts

- Fail-open behavior
- Search still executes
- No inferred filters
