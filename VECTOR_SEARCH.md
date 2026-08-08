# Vector Search via Query Embedding

This package supports an optional vector-search mode that embeds the user's
query text via an external embedding endpoint, then searches Typesense using
that vector instead of lexical text matching.

## What this extension does

- On `search(params, { searchMode: 'vector' })`, calls an external embedding
  endpoint with the query text
- Reads the returned vector from the response
- Sets `vector_query` on the configured vector field and forces `q = "*"`
  (pure vector search, no lexical blending)
- Skips the embedding call entirely for an empty or literal `"*"` query
  (mirrors the same exclusion in `searchQueryMiddleware`), leaving the
  request as a normal lexical search
- Fails open: if the embedding call fails, times out, or returns a
  malformed/mismatched-dimensions response, falls back to a normal lexical
  search unchanged

## Configuration

```ts
export interface QueryEmbeddingOptions {
  url: string;
  action?: string;         // default: "embed"
  vectorField?: string;    // default: "embedding"
  requestTimeoutMs?: number; // default: 5000
  enabled?: boolean;       // default: false
}
```

Example:

```javascript
const client = new Typesense.Client({
  nodes: [{ host: "localhost", port: "8108", protocol: "http" }],
  apiKey: "xyz",
  queryEmbedding: {
    enabled: true,
    url: "http://localhost:9001/2015-03-31/functions/function/invocations",
    vectorField: "embedding",
  },
});

const results = await client
  .collections("miswag-items-search")
  .documents()
  .search({ q: "شامبو للشعر", query_by: "name" }, { searchMode: "vector" });
```

## Embedding endpoint contract

Request:

```json
{ "action": "embed", "query": "شامبو للشعر" }
```

Expected response:

```json
{
  "query": "شامبو للشعر",
  "embedding": [0.007587038, 0.016346376, "... 768 floats"],
  "dimensions": 768
}
```

`dimensions` is optional. If present, it must match `embedding.length` or the
response is treated as malformed (fail-open).

## Behavior matrix

### `searchMode: 'lexical'` (default, or omitted)

- No embedding call
- Normal text search, unchanged from existing behavior

### `searchMode: 'vector'` with an empty or `"*"` query

- No embedding call (same wildcard/empty exclusion as `searchQueryMiddleware`)
- Normal lexical search, unchanged

### `searchMode: 'vector'` + embedding call succeeds

- `vector_query` set to `<vectorField>:([...], k:<per_page or 10>)`
- `q` forced to `"*"`
- Pure vector ranking, no lexical text matching

### `searchMode: 'vector'` + embedding call fails/times out/malformed response

- Fail-open behavior (`QueryEmbedder` catches request errors and also
  rejects non-numeric or dimension-mismatched embeddings)
- `vector_query` is never set and `q` is left unchanged
- Falls back to normal lexical search with the original `q`

## Composition with `searchQueryMiddleware`

The original query text is captured before vector mode can overwrite it with
`"*"`. That captured value — not the mutated `q` — is what gets passed to
`searchQueryMiddleware` for filter inference. This means vector mode and
middleware filter inference compose correctly: even when vector mode
succeeds and rewrites `q` to `"*"` for the Typesense request, the middleware
still sees the real query text and can still infer filters from it, which
get merged into `filter_by` on the vector request.

Only filter inference composes, not middleware's hybrid ranked+recall
dual-query behavior. That hybrid path only runs when the query passed to
Typesense is non-empty and not `"*"` (see `SEMANTIC_MIDDLEWARE.md`). Once
vector mode succeeds, `q` has already been forced to `"*"`, so the hybrid
`multi_search` never triggers — the vector-mode request always goes out as a
single pure-vector search with the middleware's inferred filters attached.
