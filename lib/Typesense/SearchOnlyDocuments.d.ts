import RequestWithCache from "./RequestWithCache";
import ApiCall from "./ApiCall";
import Configuration from "./Configuration";
import type { DocumentSchema, SearchOptions, SearchParamsWithPreset, SearchResponse } from "./Documents";
import { SearchableDocuments, SearchParams } from "./Types";
export declare class SearchOnlyDocuments<T extends DocumentSchema> implements SearchableDocuments<T> {
    protected collectionName: string;
    protected apiCall: ApiCall;
    protected configuration: Configuration;
    protected requestWithCache: RequestWithCache;
    private readonly searchQueryMiddleware;
    private readonly queryEmbedder;
    constructor(collectionName: string, apiCall: ApiCall, configuration: Configuration);
    clearCache(): void;
    search<const Infix extends string>(searchParameters: SearchParams<T, Infix> | SearchParamsWithPreset<T, Infix>, { cacheSearchResultsForSeconds, abortSignal, middlewareEnabled, middlewareTimeoutMs, precomputedFilterBy, searchMode, }?: SearchOptions): Promise<SearchResponse<T>>;
    private shouldRunHybridSearch;
    private performHybridSearch;
    private mergeHybridResults;
    private hitKey;
    private appendMiddlewareTelemetry;
    protected endpointPath(operation?: string): string;
    static get RESOURCEPATH(): string;
}
