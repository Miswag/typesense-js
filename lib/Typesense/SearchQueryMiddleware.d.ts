import type Configuration from "./Configuration";
import type { Logger } from "loglevel";
interface SearchQueryMiddlewareRequestOptions {
    enabledOverride?: boolean;
    timeoutMsOverride?: number;
}
export interface SearchQueryMiddlewareEnrichment {
    filterBy?: string;
    telemetry?: Record<string, unknown>;
}
export default class SearchQueryMiddleware {
    private readonly configuration;
    private readonly logger;
    constructor(configuration: Configuration, logger: Logger);
    fetchFilterBy(query: unknown, { enabledOverride, timeoutMsOverride, }?: SearchQueryMiddlewareRequestOptions): Promise<string | undefined>;
    fetchEnrichment(query: unknown, { enabledOverride, timeoutMsOverride, }?: SearchQueryMiddlewareRequestOptions): Promise<SearchQueryMiddlewareEnrichment | undefined>;
    private shouldRunMiddleware;
}
export {};
