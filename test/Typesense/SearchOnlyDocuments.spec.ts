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
});
