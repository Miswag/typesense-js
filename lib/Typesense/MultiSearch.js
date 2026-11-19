"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var RequestWithCache_1 = tslib_1.__importDefault(require("./RequestWithCache"));
var Utils_1 = require("./Utils");
var SearchQueryMiddleware_1 = tslib_1.__importDefault(require("./SearchQueryMiddleware"));
var SearchQueryFilterBuilder_1 = require("./SearchQueryFilterBuilder");
var RESOURCEPATH = "/multi_search";
var MultiSearch = /** @class */ (function () {
    function MultiSearch(apiCall, configuration, useTextContentType) {
        if (useTextContentType === void 0) { useTextContentType = false; }
        this.apiCall = apiCall;
        this.configuration = configuration;
        this.useTextContentType = useTextContentType;
        this.requestWithCache = new RequestWithCache_1.default();
        this.logger = this.apiCall.logger;
        this.searchQueryMiddleware = new SearchQueryMiddleware_1.default(this.configuration, this.logger);
    }
    MultiSearch.prototype.clearCache = function () {
        this.requestWithCache.clearCache();
    };
    MultiSearch.prototype.perform = function (searchRequests, commonParams, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var params, cacheSearchResultsForSeconds, normalizedSearchRequests, streamConfig, paramsWithoutStream, normalizedQueryParams, middlewareBySearch, searchResponse;
            var _a;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        params = commonParams ? tslib_1.__assign({}, commonParams) : {};
                        cacheSearchResultsForSeconds = (_a = options === null || options === void 0 ? void 0 : options.cacheSearchResultsForSeconds) !== null && _a !== void 0 ? _a : this.configuration.cacheSearchResultsForSeconds;
                        if (this.configuration.useServerSideSearchCache === true) {
                            params.use_cache = true;
                        }
                        if (searchRequests.union === true && this.hasAnySearchObjectPagination(searchRequests)) {
                            this.logger.warn("Individual `searches` pagination parameters are ignored when `union: true` is set. Use a top-level pagination parameter instead. See https://typesense.org/docs/29.0/api/federated-multi-search.html#union-search");
                        }
                        normalizedSearchRequests = {
                            union: searchRequests.union,
                            searches: searchRequests.searches.map((Utils_1.normalizeArrayableParams)),
                        };
                        streamConfig = params.streamConfig, paramsWithoutStream = tslib_1.__rest(params, ["streamConfig"]);
                        normalizedQueryParams = (0, Utils_1.normalizeArrayableParams)(paramsWithoutStream);
                        return [4 /*yield*/, this.applySearchQueryMiddlewareFilters(normalizedSearchRequests.searches, normalizedQueryParams.q, options)];
                    case 1:
                        middlewareBySearch = _b.sent();
                        return [4 /*yield*/, this.requestWithCache.perform(this.apiCall, "post", {
                                path: RESOURCEPATH,
                                body: normalizedSearchRequests,
                                queryParams: normalizedQueryParams,
                                headers: this.useTextContentType
                                    ? { "content-type": "text/plain" }
                                    : {},
                                streamConfig: streamConfig,
                                abortSignal: options === null || options === void 0 ? void 0 : options.abortSignal,
                                isStreamingRequest: this.isStreamingRequest(params),
                            }, cacheSearchResultsForSeconds !== undefined
                                ? { cacheResponseForSeconds: cacheSearchResultsForSeconds }
                                : undefined)];
                    case 2:
                        searchResponse = (_b.sent());
                        return [2 /*return*/, this.appendMiddlewareTelemetryToResponse(searchResponse, middlewareBySearch)];
                }
            });
        });
    };
    MultiSearch.prototype.isStreamingRequest = function (commonParams) {
        return commonParams.streamConfig !== undefined;
    };
    MultiSearch.prototype.applySearchQueryMiddlewareFilters = function (searches, commonQuery, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var precomputedFilterBy;
            var _this = this;
            var _a;
            return tslib_1.__generator(this, function (_b) {
                precomputedFilterBy = ((_a = options === null || options === void 0 ? void 0 : options.precomputedFilterBy) === null || _a === void 0 ? void 0 : _a.trim())
                    ? options.precomputedFilterBy
                    : undefined;
                return [2 /*return*/, Promise.all(searches.map(function (search) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                        var middlewareEnrichment, _a, middlewareFilterBy;
                        var _b;
                        return tslib_1.__generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    if (!(precomputedFilterBy != null)) return [3 /*break*/, 1];
                                    _a = { filterBy: precomputedFilterBy };
                                    return [3 /*break*/, 3];
                                case 1: return [4 /*yield*/, this.searchQueryMiddleware.fetchEnrichment((_b = search.q) !== null && _b !== void 0 ? _b : commonQuery, {
                                        enabledOverride: options === null || options === void 0 ? void 0 : options.middlewareEnabled,
                                        timeoutMsOverride: options === null || options === void 0 ? void 0 : options.middlewareTimeoutMs,
                                    })];
                                case 2:
                                    _a = _c.sent();
                                    _c.label = 3;
                                case 3:
                                    middlewareEnrichment = _a;
                                    middlewareFilterBy = middlewareEnrichment === null || middlewareEnrichment === void 0 ? void 0 : middlewareEnrichment.filterBy;
                                    search.filter_by = (0, SearchQueryFilterBuilder_1.mergeFilterByClauses)(search.filter_by, middlewareFilterBy);
                                    return [2 /*return*/, middlewareEnrichment];
                            }
                        });
                    }); }))];
            });
        });
    };
    MultiSearch.prototype.appendMiddlewareTelemetryToResponse = function (response, middlewareBySearch) {
        var _a;
        var middlewareTelemetryBySearch = middlewareBySearch.map(function (m) { return m === null || m === void 0 ? void 0 : m.telemetry; });
        var hasFilterBy = middlewareBySearch.some(function (m) { return m === null || m === void 0 ? void 0 : m.filterBy; });
        if (!hasFilterBy && middlewareTelemetryBySearch.every(function (telemetry) { return telemetry == null; })) {
            return response;
        }
        if ("results" in response && Array.isArray(response.results)) {
            var enrichedResults = response.results.map(function (r, index) {
                var _a, _b;
                // Same field documents().search returns, so callers can replay it on page 2+.
                var filterBy = (_a = middlewareBySearch[index]) === null || _a === void 0 ? void 0 : _a.filterBy;
                var result = filterBy ? tslib_1.__assign(tslib_1.__assign({}, r), { middleware_filter_by: filterBy }) : r;
                var telemetry = middlewareTelemetryBySearch[index];
                if (telemetry == null) {
                    return result;
                }
                var serializedTelemetry = JSON.parse(JSON.stringify(telemetry));
                return tslib_1.__assign(tslib_1.__assign({}, result), { metadata: tslib_1.__assign(tslib_1.__assign({}, ((_b = result.metadata) !== null && _b !== void 0 ? _b : {})), { middleware_telemetry: serializedTelemetry }) });
            });
            return tslib_1.__assign(tslib_1.__assign({}, response), { results: enrichedResults });
        }
        var unionResponse = response;
        var firstTelemetry = middlewareTelemetryBySearch.find(function (telemetry) { return telemetry != null; });
        if (firstTelemetry == null) {
            return response;
        }
        var serializedTelemetry = JSON.parse(JSON.stringify(firstTelemetry));
        return tslib_1.__assign(tslib_1.__assign({}, unionResponse), { metadata: tslib_1.__assign(tslib_1.__assign({}, ((_a = unionResponse.metadata) !== null && _a !== void 0 ? _a : {})), { middleware_telemetry: serializedTelemetry }) });
    };
    MultiSearch.prototype.hasAnySearchObjectPagination = function (searchRequests) {
        return searchRequests.searches.some(function (search) { return search.page !== undefined || search.per_page !== undefined || search.offset !== undefined || search.limit !== undefined || search.limit_hits !== undefined; });
    };
    return MultiSearch;
}());
exports.default = MultiSearch;
//# sourceMappingURL=MultiSearch.js.map