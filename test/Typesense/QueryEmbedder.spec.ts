import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import axios from "axios";
import MockAxiosAdapter from "axios-mock-adapter";
import * as logger from "loglevel";
import Configuration from "../../src/Typesense/Configuration";
import QueryEmbedder from "../../src/Typesense/QueryEmbedder";

describe("QueryEmbedder", () => {
  let mockAxios: MockAxiosAdapter;
  const embedUrl = "http://localhost:9001/2015-03-31/functions/function/invocations";

  beforeEach(() => {
    mockAxios = new MockAxiosAdapter(axios);
  });

  afterEach(() => {
    mockAxios.restore();
  });

  const buildConfiguration = (overrides: Record<string, unknown> = {}) =>
    new Configuration({
      nodes: [{ host: "localhost", port: 8108, protocol: "http" }],
      apiKey: "xyz",
      queryEmbedding: {
        url: embedUrl,
        enabled: true,
        ...overrides,
      },
    });

  it("returns the embedding vector on success", async () => {
    mockAxios.onPost(embedUrl).reply(200, {
      query: "شامبو للشعر",
      embedding: [0.1, 0.2, 0.3],
      dimensions: 3,
    });

    const embedder = new QueryEmbedder(buildConfiguration(), logger);
    const vector = await embedder.fetchVector("شامبو للشعر");

    expect(vector).toEqual([0.1, 0.2, 0.3]);
  });

  it("sends the configured action and query in the request body", async () => {
    mockAxios.onPost(embedUrl).reply((config) => {
      const body = JSON.parse(config.data);
      expect(body).toEqual({ action: "embed", query: "shampoo" });
      return [200, { embedding: [1, 2], dimensions: 2 }];
    });

    const embedder = new QueryEmbedder(buildConfiguration(), logger);
    await embedder.fetchVector("shampoo");
  });

  it("returns undefined and fails open when the request errors", async () => {
    mockAxios.onPost(embedUrl).networkError();

    const embedder = new QueryEmbedder(buildConfiguration(), logger);
    const vector = await embedder.fetchVector("shampoo");

    expect(vector).toBeUndefined();
  });

  it("returns undefined and fails open on timeout", async () => {
    mockAxios.onPost(embedUrl).timeout();

    const embedder = new QueryEmbedder(
      buildConfiguration({ requestTimeoutMs: 10 }),
      logger,
    );
    const vector = await embedder.fetchVector("shampoo");

    expect(vector).toBeUndefined();
  });

  it("returns undefined when the response is missing an embedding array", async () => {
    mockAxios.onPost(embedUrl).reply(200, { query: "shampoo" });

    const embedder = new QueryEmbedder(buildConfiguration(), logger);
    const vector = await embedder.fetchVector("shampoo");

    expect(vector).toBeUndefined();
  });

  it("returns undefined when the embedding length does not match declared dimensions", async () => {
    mockAxios.onPost(embedUrl).reply(200, {
      query: "shampoo",
      embedding: [1, 2, 3],
      dimensions: 5,
    });

    const embedder = new QueryEmbedder(buildConfiguration(), logger);
    const vector = await embedder.fetchVector("shampoo");

    expect(vector).toBeUndefined();
  });

  it("does not call the endpoint when queryEmbedding is not configured", async () => {
    const configuration = new Configuration({
      nodes: [{ host: "localhost", port: 8108, protocol: "http" }],
      apiKey: "xyz",
    });

    const embedder = new QueryEmbedder(configuration, logger);
    const vector = await embedder.fetchVector("shampoo");

    expect(vector).toBeUndefined();
    expect(mockAxios.history.post.length).toBe(0);
  });

  it("does not call the endpoint when queryEmbedding.enabled is false", async () => {
    const embedder = new QueryEmbedder(
      buildConfiguration({ enabled: false }),
      logger,
    );
    const vector = await embedder.fetchVector("shampoo");

    expect(vector).toBeUndefined();
    expect(mockAxios.history.post.length).toBe(0);
  });
});
