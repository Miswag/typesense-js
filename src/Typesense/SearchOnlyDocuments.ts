import RequestWithCache from "./RequestWithCache";
import ApiCall from "./ApiCall";
import Configuration from "./Configuration";
import Collections from "./Collections";
import type {
  DocumentSchema,
  ExtractBaseTypes,
  SearchOptions,
  SearchParamsWithPreset,
  SearchResponse,
} from "./Documents";
import { normalizeArrayableParams } from "./Utils";
import { SearchableDocuments, SearchParams } from "./Types";
import SearchQueryMiddleware from "./SearchQueryMiddleware";
import { mergeFilterByClauses } from "./SearchQueryFilterBuilder";

const RESOURCEPATH = "/documents";

export class SearchOnlyDocuments<T extends DocumentSchema>
  implements SearchableDocuments<T>
{
  protected requestWithCache: RequestWithCache = new RequestWithCache();
  private readonly searchQueryMiddleware: SearchQueryMiddleware;

  constructor(
    protected collectionName: string,
    protected apiCall: ApiCall,
    protected configuration: Configuration,
  ) {
    this.searchQueryMiddleware = new SearchQueryMiddleware(
      this.configuration,
      this.apiCall.logger,
    );
  }

  clearCache() {
    this.requestWithCache.clearCache();
  }

  async search<const Infix extends string>(
    searchParameters: SearchParams<T, Infix> | SearchParamsWithPreset<T, Infix>,
    {
      cacheSearchResultsForSeconds = this.configuration
        .cacheSearchResultsForSeconds,
      abortSignal = null,
      middlewareEnabled = undefined,
      middlewareTimeoutMs = undefined,
    }: SearchOptions = {},
  ): Promise<SearchResponse<T>> {
    const additionalQueryParams = {};
    if (this.configuration.useServerSideSearchCache === true) {
      additionalQueryParams["use_cache"] = true;
    }

    const { streamConfig, ...rest } = normalizeArrayableParams<
      T,
      SearchParams<T, Infix>,
      Infix
    >(searchParameters);

    const queryParams: ExtractBaseTypes<SearchParams<T, Infix>> = {
      ...additionalQueryParams,
      ...rest,
    };
    const middlewareEnrichment = await this.searchQueryMiddleware.fetchEnrichment(
      queryParams.q,
      {
        enabledOverride: middlewareEnabled,
        timeoutMsOverride: middlewareTimeoutMs,
      },
    );
    const middlewareFilterBy = middlewareEnrichment?.filterBy;

    queryParams.filter_by = mergeFilterByClauses(
      queryParams.filter_by,
      middlewareFilterBy,
    ) as ExtractBaseTypes<SearchParams<T, Infix>>["filter_by"];

    const isStreamingRequest = queryParams.conversation_stream === true;
    const shouldRunHybridSearch = this.shouldRunHybridSearch(
      queryParams.q,
      middlewareFilterBy,
      isStreamingRequest,
    );

    if (shouldRunHybridSearch) {
      const hybridResponse = await this.performHybridSearch<T, Infix>(
        queryParams,
        abortSignal,
        cacheSearchResultsForSeconds,
      );
      return this.appendMiddlewareTelemetry(
        hybridResponse,
        middlewareEnrichment?.telemetry,
      );
    }

    const searchResponse = await this.requestWithCache.perform<
      ApiCall,
      "get",
      [T],
      SearchResponse<T>
    >(
      this.apiCall,
      "get",
      {
        path: this.endpointPath("search"),
        queryParams,
        streamConfig,
        abortSignal,
        isStreamingRequest,
      },
      {
        cacheResponseForSeconds: cacheSearchResultsForSeconds,
      },
    );

    return this.appendMiddlewareTelemetry(
      searchResponse,
      middlewareEnrichment?.telemetry,
    );
  }

  private shouldRunHybridSearch(
    query: unknown,
    middlewareFilterBy: string | undefined,
    isStreamingRequest: boolean,
  ): boolean {
    if (isStreamingRequest) {
      return false;
    }

    if (middlewareFilterBy == null || middlewareFilterBy.trim() === "") {
      return false;
    }

    if (typeof query !== "string") {
      return false;
    }

    const trimmedQuery = query.trim();
    return trimmedQuery.length > 0 && trimmedQuery !== "*";
  }

  private async performHybridSearch<TDoc extends DocumentSchema, Infix extends string>(
    queryParams: ExtractBaseTypes<SearchParams<TDoc, Infix>>,
    abortSignal: AbortSignal | null,
    cacheSearchResultsForSeconds: number,
  ): Promise<SearchResponse<TDoc>> {
    const rankedSearch = {
      ...queryParams,
      collection: this.collectionName,
    };
    const recallSearch = {
      ...rankedSearch,
      q: "*",
    };

    const hybridResponse = await this.requestWithCache.perform<
      ApiCall,
      "post",
      [TDoc],
      { results: SearchResponse<TDoc>[] }
    >(
      this.apiCall,
      "post",
      {
        path: "/multi_search",
        body: {
          searches: [rankedSearch, recallSearch],
        },
        queryParams: {},
        abortSignal,
        isStreamingRequest: false,
      },
      {
        cacheResponseForSeconds: cacheSearchResultsForSeconds,
      },
    );

    const rankedResult = hybridResponse?.results?.[0];
    if (rankedResult == null) {
      throw new Error("Hybrid search failed: ranked result is missing");
    }

    if (rankedResult.error != null || rankedResult.code != null) {
      throw new Error(rankedResult.error || `Search failed with code ${rankedResult.code}`);
    }

    const recallResult = hybridResponse?.results?.[1];
    if (
      recallResult == null ||
      recallResult.error != null ||
      recallResult.code != null
    ) {
      return rankedResult;
    }

    return this.mergeHybridResults(rankedResult, recallResult);
  }

  private mergeHybridResults<TDoc extends DocumentSchema>(
    rankedResult: SearchResponse<TDoc>,
    recallResult: SearchResponse<TDoc>,
  ): SearchResponse<TDoc> {
    const rankedHits = rankedResult.hits ?? [];
    const recallHits = recallResult.hits ?? [];
    const seenIds = new Set<string>();

    const mergedHits = [...rankedHits];
    rankedHits.forEach((hit) => seenIds.add(this.hitKey(hit)));

    recallHits.forEach((hit) => {
      const key = this.hitKey(hit);
      if (!seenIds.has(key)) {
        seenIds.add(key);
        mergedHits.push(hit);
      }
    });

    return {
      ...rankedResult,
      hits: mergedHits,
      found: Math.max(rankedResult.found ?? 0, recallResult.found ?? 0),
      found_docs: Math.max(
        rankedResult.found_docs ?? 0,
        recallResult.found_docs ?? 0,
      ),
      out_of: Math.max(rankedResult.out_of ?? 0, recallResult.out_of ?? 0),
      facet_counts: recallResult.facet_counts ?? rankedResult.facet_counts,
      grouped_hits: recallResult.grouped_hits ?? rankedResult.grouped_hits,
      search_time_ms: Math.max(
        rankedResult.search_time_ms ?? 0,
        recallResult.search_time_ms ?? 0,
      ),
    };
  }

  private hitKey<TDoc extends DocumentSchema>(hit: {
    document: TDoc;
  }): string {
    const documentId = hit?.document?.["id"];
    if (
      typeof documentId === "string" ||
      typeof documentId === "number" ||
      typeof documentId === "boolean"
    ) {
      return String(documentId);
    }

    return JSON.stringify(hit.document);
  }

  private appendMiddlewareTelemetry<TDoc extends DocumentSchema>(
    searchResponse: SearchResponse<TDoc>,
    telemetry: Record<string, unknown> | undefined,
  ): SearchResponse<TDoc> {
    if (telemetry == null) {
      return searchResponse;
    }

    const serializedTelemetry = JSON.parse(
      JSON.stringify(telemetry),
    ) as Record<string, never>;

    return {
      ...searchResponse,
      metadata: {
        ...(searchResponse.metadata ?? {}),
        middleware_telemetry: serializedTelemetry,
      },
    };
  }

  protected endpointPath(operation?: string) {
    return `${Collections.RESOURCEPATH}/${encodeURIComponent(this.collectionName)}${RESOURCEPATH}${
      operation === undefined ? "" : "/" + operation
    }`;
  }

  static get RESOURCEPATH() {
    return RESOURCEPATH;
  }
}
