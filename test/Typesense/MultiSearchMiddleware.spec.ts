import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAxiosAdapter from "axios-mock-adapter";
import { Client as TypesenseClient } from "../../src/Typesense";

describe("MultiSearch search query middleware", () => {
  let mockAxios: MockAxiosAdapter;
  const middlewareUrl = "http://localhost:9002/middleware/enrich";
  const client = () =>
    new TypesenseClient({
      nodes: [{ host: "localhost", port: 8108, protocol: "http" }],
      apiKey: "xyz",
      searchQueryMiddleware: { url: middlewareUrl, apiKey: "k", enabled: true },
    });

  let body: { searches: Array<Record<string, unknown>> };
  let middlewareCalls: number;
  beforeEach(() => {
    mockAxios = new MockAxiosAdapter(axios);
    middlewareCalls = 0;
    mockAxios.onPost(middlewareUrl).reply(() => {
      middlewareCalls++;
      return [200, { result: { filters: { brand: ["Nike"] } } }];
    });
    mockAxios.onPost(/\/multi_search/).reply((config) => {
      body = JSON.parse(config.data);
      return [200, { results: [{ hits: [], found: 0 }] }];
    });
  });
  afterEach(() => mockAxios.restore());

  it("returns middleware_filter_by on each result", async () => {
    const r = await client().multiSearch.perform(
      { searches: [{ collection: "c", q: "nike shoes", query_by: "name" }] },
      {},
      { middlewareEnabled: true },
    );
    expect(middlewareCalls).toBe(1);
    expect(body.searches[0].filter_by).toContain("Nike");
    expect((r.results[0] as { middleware_filter_by?: string }).middleware_filter_by).toContain("Nike");
  });

  it("uses precomputedFilterBy instead of calling the middleware", async () => {
    const r = await client().multiSearch.perform(
      { searches: [{ collection: "c", q: "nike shoes", query_by: "name", filter_by: "price:>1" }] },
      {},
      { precomputedFilterBy: "brand:=[`Adidas`]" },
    );
    expect(middlewareCalls).toBe(0);
    expect(body.searches[0].filter_by).toContain("price:>1");
    expect(body.searches[0].filter_by).toContain("Adidas");
    expect((r.results[0] as { middleware_filter_by?: string }).middleware_filter_by).toBe("brand:=[`Adidas`]");
  });
});
