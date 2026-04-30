import type ApiCall from "./ApiCall";
import type Configuration from "./Configuration";
import RequestWithCache from "./RequestWithCache";
import type {
  DocumentSchema,
  ExtractBaseTypes,
  SearchOptions,
  SearchParams,
  SearchResponse,
} from "./Documents";
import { normalizeArrayableParams } from "./Utils";
import type {
  MultiSearchRequestsSchema,
  MultiSearchRequestsWithUnionSchema,
  MultiSearchResponse,
  MultiSearchUnionParameters,
  MultiSearchResultsParameters,
  UnionSearchResponse,
  MultiSearchRequestsWithoutUnionSchema,
} from "./Types";
import { Logger } from "loglevel";
import SearchQueryMiddleware from "./SearchQueryMiddleware";
import { mergeFilterByClauses } from "./SearchQueryFilterBuilder";

const RESOURCEPATH = "/multi_search";

export default class MultiSearch {
  private requestWithCache: RequestWithCache;
  private readonly searchQueryMiddleware: SearchQueryMiddleware;
  readonly logger: Logger;

  constructor(
    private apiCall: ApiCall,
    private configuration: Configuration,
    private useTextContentType: boolean = false,
  ) {
    this.requestWithCache = new RequestWithCache();
    this.logger = this.apiCall.logger;
    this.searchQueryMiddleware = new SearchQueryMiddleware(
      this.configuration,
      this.logger,
    );
  }

  clearCache() {
    this.requestWithCache.clearCache();
  }

  async perform<
    const T extends DocumentSchema[] = [],
    const Infix extends string = string,
  >(
    searchRequests: MultiSearchRequestsWithUnionSchema<T[number], Infix>,
    commonParams?: MultiSearchUnionParameters<T[number], Infix>,
    options?: SearchOptions,
  ): Promise<UnionSearchResponse<T[number]>>;

  async perform<
    const T extends DocumentSchema[] = [],
    const Infix extends string = string,
  >(
    searchRequests: MultiSearchRequestsWithoutUnionSchema<T[number], Infix>,
    commonParams?: MultiSearchResultsParameters<T, Infix>,
    options?: SearchOptions,
  ): Promise<{
    results: { [Index in keyof T]: SearchResponse<T[Index]> } & {
      length: T["length"];
    };
  }>;

  async perform<
    const T extends DocumentSchema[] = [],
    const Infix extends string = string,
  >(
    searchRequests: MultiSearchRequestsSchema<T[number], Infix>,
    commonParams?:
      | MultiSearchUnionParameters<T[number], Infix>
      | MultiSearchResultsParameters<T, Infix>,
    options?: SearchOptions,
  ): Promise<MultiSearchResponse<T, Infix>> {
    const params = commonParams ? { ...commonParams } : {};
    const cacheSearchResultsForSeconds =
      options?.cacheSearchResultsForSeconds ??
      this.configuration.cacheSearchResultsForSeconds;

    if (this.configuration.useServerSideSearchCache === true) {
      params.use_cache = true;
    }

    if (searchRequests.union === true && this.hasAnySearchObjectPagination(searchRequests)) {
      this.logger.warn(
        "Individual `searches` pagination parameters are ignored when `union: true` is set. Use a top-level pagination parameter instead. See https://typesense.org/docs/29.0/api/federated-multi-search.html#union-search"
      );
    }

    const normalizedSearchRequests: Omit<typeof searchRequests, "searches"> & {
      searches: ExtractBaseTypes<SearchParams<T[number], Infix>>[];
    } = {
      union: searchRequests.union,
      searches: searchRequests.searches.map(
        normalizeArrayableParams<
          T[number],
          SearchParams<T[number], Infix>,
          Infix
        >,
      ),
    };

    const { streamConfig, ...paramsWithoutStream } = params;
    const normalizedQueryParams = normalizeArrayableParams(
      paramsWithoutStream as SearchParams<T[number], Infix>,
    );

    const middlewareTelemetryBySearch = await this.applySearchQueryMiddlewareFilters(
      normalizedSearchRequests.searches,
      normalizedQueryParams.q,
      options,
    );

    const searchResponse = (await this.requestWithCache.perform(
      this.apiCall,
      "post",
      {
        path: RESOURCEPATH,
        body: normalizedSearchRequests,
        queryParams: normalizedQueryParams,
        headers: this.useTextContentType
          ? { "content-type": "text/plain" }
          : {},
        streamConfig,
        abortSignal: options?.abortSignal,
        isStreamingRequest: this.isStreamingRequest(params),
      } as any,
      cacheSearchResultsForSeconds !== undefined
        ? { cacheResponseForSeconds: cacheSearchResultsForSeconds }
        : undefined,
    )) as MultiSearchResponse<T, Infix>;

    return this.appendMiddlewareTelemetryToResponse(
      searchResponse,
      middlewareTelemetryBySearch,
    );
  }

  private isStreamingRequest(commonParams: { streamConfig?: unknown }) {
    return commonParams.streamConfig !== undefined;
  }

  private async applySearchQueryMiddlewareFilters<
    TDoc extends DocumentSchema,
    Infix extends string,
  >(
    searches: ExtractBaseTypes<SearchParams<TDoc, Infix>>[],
    commonQuery: unknown,
    options?: SearchOptions,
  ): Promise<(Record<string, unknown> | undefined)[]> {
    return Promise.all(
      searches.map(async (search) => {
        const middlewareEnrichment = await this.searchQueryMiddleware.fetchEnrichment(
          search.q ?? commonQuery,
          {
            enabledOverride: options?.middlewareEnabled,
            timeoutMsOverride: options?.middlewareTimeoutMs,
          },
        );
        const middlewareFilterBy = middlewareEnrichment?.filterBy;

        search.filter_by = mergeFilterByClauses(
          search.filter_by,
          middlewareFilterBy,
        ) as ExtractBaseTypes<SearchParams<TDoc, Infix>>["filter_by"];

        return middlewareEnrichment?.telemetry;
      }),
    );
  }

  private appendMiddlewareTelemetryToResponse<
    T extends DocumentSchema[],
    Infix extends string,
  >(
    response: MultiSearchResponse<T, Infix>,
    middlewareTelemetryBySearch: (Record<string, unknown> | undefined)[],
  ): MultiSearchResponse<T, Infix> {
    if (middlewareTelemetryBySearch.every((telemetry) => telemetry == null)) {
      return response;
    }

    if ("results" in response && Array.isArray(response.results)) {
      const enrichedResults = response.results.map((result, index) => {
        const telemetry = middlewareTelemetryBySearch[index];
        if (telemetry == null) {
          return result;
        }

        const serializedTelemetry = JSON.parse(JSON.stringify(telemetry)) as Record<
          string,
          never
        >;

        return {
          ...result,
          metadata: {
            ...(result.metadata ?? {}),
            middleware_telemetry: serializedTelemetry,
          },
        };
      }) as typeof response.results;

      return {
        ...response,
        results: enrichedResults,
      };
    }

    const unionResponse = response as UnionSearchResponse<T[number]>;
    const firstTelemetry = middlewareTelemetryBySearch.find(
      (telemetry) => telemetry != null,
    );

    if (firstTelemetry == null) {
      return response;
    }

    const serializedTelemetry = JSON.parse(
      JSON.stringify(firstTelemetry),
    ) as Record<string, never>;

    return {
      ...unionResponse,
      metadata: {
        ...(unionResponse.metadata ?? {}),
        middleware_telemetry: serializedTelemetry,
      },
    } as MultiSearchResponse<T, Infix>;
  }

  private hasAnySearchObjectPagination(searchRequests: MultiSearchRequestsSchema<DocumentSchema, string>) {
    return searchRequests.searches.some(search => search.page !== undefined || search.per_page !== undefined || search.offset !== undefined || search.limit !== undefined || search.limit_hits !== undefined);
  }
}

export type {
  MultiSearchRequestsSchema,
  MultiSearchRequestsWithUnionSchema,
  MultiSearchResponse,
  MultiSearchUnionParameters,
  MultiSearchResultsParameters,
  UnionSearchResponse,
  MultiSearchRequestsWithoutUnionSchema,
} from "./Types";
