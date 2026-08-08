import axios from "axios";
import type Configuration from "./Configuration";
import type { Logger } from "loglevel";

interface QueryEmbedderResponse {
  embedding?: unknown;
  dimensions?: unknown;
}

export default class QueryEmbedder {
  constructor(
    private readonly configuration: Configuration,
    private readonly logger: Logger,
  ) {}

  async fetchVector(query: unknown): Promise<number[] | undefined> {
    const queryEmbeddingConfig = this.configuration.queryEmbedding;
    if (queryEmbeddingConfig == null || queryEmbeddingConfig.enabled !== true) {
      return undefined;
    }

    if (typeof query !== "string" || query.trim() === "") {
      return undefined;
    }

    try {
      const response = await axios.post<QueryEmbedderResponse>(
        queryEmbeddingConfig.url,
        {
          action: queryEmbeddingConfig.action,
          query: query.trim(),
        },
        {
          timeout: queryEmbeddingConfig.requestTimeoutMs,
        },
      );

      return this.extractVector(response.data);
    } catch (error) {
      this.logger.warn(
        `Query embedding call failed, proceeding without vector search: ${error}`,
      );
      return undefined;
    }
  }

  private extractVector(data: QueryEmbedderResponse): number[] | undefined {
    const { embedding, dimensions } = data;

    if (
      !Array.isArray(embedding) ||
      !embedding.every((value) => typeof value === "number")
    ) {
      this.logger.warn(
        "Query embedding response missing a numeric embedding array, proceeding without vector search",
      );
      return undefined;
    }

    if (typeof dimensions === "number" && embedding.length !== dimensions) {
      this.logger.warn(
        `Query embedding response length (${embedding.length}) does not match declared dimensions (${dimensions}), proceeding without vector search`,
      );
      return undefined;
    }

    return embedding as number[];
  }
}
