import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAxiosAdapter from "axios-mock-adapter";
import { Client as TypesenseClient } from "../../src/Typesense";

describe("SearchOnlyDocuments searchMode", () => {
  let mockAxios: MockAxiosAdapter;
  const embedUrl =
    "http://localhost:9001/2015-03-31/functions/function/invocations";
  const collectionName = "test_vector_search";

  const buildClient = () =>
    new TypesenseClient({
      nodes: [{ host: "localhost", port: 8108, protocol: "http" }],
      apiKey: "xyz",
      queryEmbedding: {
        url: embedUrl,
        enabled: true,
      },
    });

  beforeEach(() => {
    mockAxios = new MockAxiosAdapter(axios);
  });

  afterEach(() => {
    mockAxios.restore();
  });

  it("defaults to lexical search and does not call the embed endpoint", async () => {
    let capturedParams: Record<string, unknown> = {};
    mockAxios
      .onGet(new RegExp(`/collections/${collectionName}/documents/search`))
      .reply((config) => {
        capturedParams = config.params ?? {};
        return [200, { hits: [], found: 0 }];
      });

    const typesense = buildClient();
    await typesense
      .collections(collectionName)
      .documents()
      .search({ q: "shampoo", query_by: "name" });

    expect(
      mockAxios.history.post.filter((r) => r.url === embedUrl).length,
    ).toBe(0);
    expect(capturedParams.q).toBe("shampoo");
    expect(capturedParams.vector_query).toBeUndefined();
  });

  it("fetches a vector and sends vector_query with q='*' when searchMode is 'vector'", async () => {
    mockAxios.onPost(embedUrl).reply(200, {
      embedding: [0.1, 0.2, 0.3],
      dimensions: 3,
    });

    let capturedParams: Record<string, unknown> = {};
    mockAxios
      .onGet(new RegExp(`/collections/${collectionName}/documents/search`))
      .reply((config) => {
        capturedParams = config.params ?? {};
        return [200, { hits: [], found: 0 }];
      });

    const typesense = buildClient();
    await typesense
      .collections(collectionName)
      .documents()
      .search({ q: "شامبو للشعر", query_by: "name" }, { searchMode: "vector" });

    expect(
      mockAxios.history.post.filter((r) => r.url === embedUrl).length,
    ).toBe(1);
    expect(capturedParams.vector_query).toContain(
      "embedding:([0.1,0.2,0.3], k:",
    );
    expect(capturedParams.q).toBe("*");
  });

  it("falls back to lexical search when the embed call fails", async () => {
    mockAxios.onPost(embedUrl).networkError();

    let capturedParams: Record<string, unknown> = {};
    mockAxios
      .onGet(new RegExp(`/collections/${collectionName}/documents/search`))
      .reply((config) => {
        capturedParams = config.params ?? {};
        return [200, { hits: [], found: 0 }];
      });

    const typesense = buildClient();
    await typesense
      .collections(collectionName)
      .documents()
      .search({ q: "شامبو للشعر", query_by: "name" }, { searchMode: "vector" });

    expect(capturedParams.vector_query).toBeUndefined();
    expect(capturedParams.q).toBe("شامبو للشعر");
  });

  it("passes the original query text to search query middleware and still applies its filter_by in vector mode", async () => {
    const middlewareUrl = "http://localhost:9002/middleware/enrich";

    mockAxios.onPost(embedUrl).reply(200, {
      embedding: [0.1, 0.2, 0.3],
      dimensions: 3,
    });

    let capturedMiddlewareQuery: string | undefined;
    mockAxios.onPost(middlewareUrl).reply((config) => {
      capturedMiddlewareQuery = config.params?.query;
      return [200, { result: { filters: { brand: ["Nike"] } }, telemetry: {} }];
    });

    let capturedParams: Record<string, unknown> = {};
    mockAxios
      .onGet(new RegExp(`/collections/${collectionName}/documents/search`))
      .reply((config) => {
        capturedParams = config.params ?? {};
        return [200, { hits: [], found: 0 }];
      });

    const typesense = new TypesenseClient({
      nodes: [{ host: "localhost", port: 8108, protocol: "http" }],
      apiKey: "xyz",
      queryEmbedding: {
        url: embedUrl,
        enabled: true,
      },
      searchQueryMiddleware: {
        url: middlewareUrl,
        apiKey: "middleware-key",
        enabled: true,
      },
    });

    await typesense
      .collections(collectionName)
      .documents()
      .search({ q: "شامبو للشعر", query_by: "name" }, { searchMode: "vector" });

    // Middleware must see the original query text, not the vector-mode "*" override.
    expect(capturedMiddlewareQuery).toBe("شامبو للشعر");

    // The final request is a pure vector search (q forced to "*", vector_query set)...
    expect(capturedParams.q).toBe("*");
    expect(capturedParams.vector_query).toContain(
      "embedding:([0.1,0.2,0.3], k:",
    );

    // ...but still carries the middleware-derived filter, proving shouldRunHybridSearch
    // skips hybrid search via the q === "*" branch, not merely because middleware
    // was unconfigured.
    expect(capturedParams.filter_by).toContain("Nike");
  });
});
