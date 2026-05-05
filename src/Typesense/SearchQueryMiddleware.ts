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

interface EnrichmentCacheEntry {
  enrichment: SearchQueryMiddlewareEnrichment;
  expiresAt: number;
}

const ENRICHMENT_CACHE_TTL_MS = 5 * 60 * 1000;

export default class SearchQueryMiddleware {
  private readonly enrichmentCache = new Map<string, EnrichmentCacheEntry>();

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

    const cached = this.enrichmentCache.get(queryText);
    if (cached != null && Date.now() < cached.expiresAt) {
      return cached.enrichment;
    }

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

      const enrichment: SearchQueryMiddlewareEnrichment = {
        filterBy: buildFilterByFromMiddlewareResponse(response.data?.result?.filters),
        telemetry: response.data?.telemetry,
      };

      this.enrichmentCache.set(queryText, {
        enrichment,
        expiresAt: Date.now() + ENRICHMENT_CACHE_TTL_MS,
      });

      return enrichment;
    } catch (error) {
      this.logger.warn(
        `Search query middleware call failed, proceeding without middleware filters: ${error}`,
      );
      return undefined;
    }
  }

  getCachedEnrichment(query: string): SearchQueryMiddlewareEnrichment | undefined {
    const cached = this.enrichmentCache.get(query.trim());
    if (cached != null && Date.now() < cached.expiresAt) {
      return cached.enrichment;
    }
    return undefined;
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
