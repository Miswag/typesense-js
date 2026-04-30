import axios from "axios";
import type Configuration from "./Configuration";
import type { Logger } from "loglevel";
import { buildFilterByFromMiddlewareResponse } from "./SearchQueryFilterBuilder";

interface SearchQueryMiddlewareResponse {
  result?: {
    filters?: Record<string, unknown>;
  };
  telemetry?: Record<string, unknown>;
}

interface SearchQueryMiddlewareRequestOptions {
  enabledOverride?: boolean;
  timeoutMsOverride?: number;
}

export interface SearchQueryMiddlewareEnrichment {
  filterBy?: string;
  telemetry?: Record<string, unknown>;
}

export default class SearchQueryMiddleware {
  constructor(
    private readonly configuration: Configuration,
    private readonly logger: Logger,
  ) {}

  async fetchFilterBy(
    query: unknown,
    {
      enabledOverride,
      timeoutMsOverride,
    }: SearchQueryMiddlewareRequestOptions = {},
  ): Promise<string | undefined> {
    const enrichment = await this.fetchEnrichment(query, {
      enabledOverride,
      timeoutMsOverride,
    });

    return enrichment?.filterBy;
  }

  async fetchEnrichment(
    query: unknown,
    {
      enabledOverride,
      timeoutMsOverride,
    }: SearchQueryMiddlewareRequestOptions = {},
  ): Promise<SearchQueryMiddlewareEnrichment | undefined> {
    if (!this.shouldRunMiddleware(query, enabledOverride)) {
      return undefined;
    }

    const middlewareConfig = this.configuration.searchQueryMiddleware;
    if (middlewareConfig == null) {
      return undefined;
    }

    const queryText = String(query).trim();
    try {
      const response = await axios.post<SearchQueryMiddlewareResponse>(
        middlewareConfig.url,
        undefined,
        {
          params: {
            [middlewareConfig.queryParamName]: queryText,
          },
          headers: {
            [middlewareConfig.apiKeyHeader]: middlewareConfig.apiKey,
          },
          timeout: timeoutMsOverride ?? middlewareConfig.requestTimeoutMs,
        },
      );

      return {
        filterBy: buildFilterByFromMiddlewareResponse(response.data?.result?.filters),
        telemetry: response.data?.telemetry,
      };
    } catch (error) {
      this.logger.warn(
        `Search query middleware call failed, proceeding without middleware filters: ${error}`,
      );
      return undefined;
    }
  }

  private shouldRunMiddleware(
    query: unknown,
    enabledOverride?: boolean,
  ): boolean {
    const middlewareConfig = this.configuration.searchQueryMiddleware;
    if (middlewareConfig == null) {
      return false;
    }

    const isEnabled = enabledOverride ?? middlewareConfig.enabled;
    if (isEnabled !== true) {
      return false;
    }

    if (typeof query !== "string") {
      return false;
    }

    const trimmedQuery = query.trim();
    return trimmedQuery.length > 0 && trimmedQuery !== "*";
  }
}
