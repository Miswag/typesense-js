"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchOnlyDocuments = void 0;
var tslib_1 = require("tslib");
var RequestWithCache_1 = tslib_1.__importDefault(require("./RequestWithCache"));
var Collections_1 = tslib_1.__importDefault(require("./Collections"));
var Utils_1 = require("./Utils");
var SearchQueryMiddleware_1 = tslib_1.__importDefault(require("./SearchQueryMiddleware"));
var QueryEmbedder_1 = tslib_1.__importDefault(require("./QueryEmbedder"));
var SearchQueryFilterBuilder_1 = require("./SearchQueryFilterBuilder");
var RESOURCEPATH = "/documents";
var SearchOnlyDocuments = /** @class */ (function () {
    function SearchOnlyDocuments(collectionName, apiCall, configuration) {
        this.collectionName = collectionName;
        this.apiCall = apiCall;
        this.configuration = configuration;
        this.requestWithCache = new RequestWithCache_1.default();
        this.searchQueryMiddleware = new SearchQueryMiddleware_1.default(this.configuration, this.apiCall.logger);
        this.queryEmbedder = new QueryEmbedder_1.default(this.configuration, this.apiCall.logger);
    }
    SearchOnlyDocuments.prototype.clearCache = function () {
        this.requestWithCache.clearCache();
    };
    SearchOnlyDocuments.prototype.search = function (searchParameters_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function (searchParameters, _a) {
            var additionalQueryParams, _b, streamConfig, rest, queryParams, originalQuery, vector, vectorField, vectorQuery, middlewareFilterBy, middlewareTelemetry, middlewareEnrichment, isStreamingRequest, shouldRunHybridSearch, hybridResponse, searchResponse;
            var _c, _d, _e;
            var _f = _a === void 0 ? {} : _a, _g = _f.cacheSearchResultsForSeconds, cacheSearchResultsForSeconds = _g === void 0 ? this.configuration
                .cacheSearchResultsForSeconds : _g, _h = _f.abortSignal, abortSignal = _h === void 0 ? null : _h, _j = _f.middlewareEnabled, middlewareEnabled = _j === void 0 ? undefined : _j, _k = _f.middlewareTimeoutMs, middlewareTimeoutMs = _k === void 0 ? undefined : _k, _l = _f.precomputedFilterBy, precomputedFilterBy = _l === void 0 ? undefined : _l, _m = _f.searchMode, searchMode = _m === void 0 ? "lexical" : _m;
            return tslib_1.__generator(this, function (_o) {
                switch (_o.label) {
                    case 0:
                        additionalQueryParams = {};
                        if (this.configuration.useServerSideSearchCache === true) {
                            additionalQueryParams["use_cache"] = true;
                        }
                        _b = (0, Utils_1.normalizeArrayableParams)(searchParameters), streamConfig = _b.streamConfig, rest = tslib_1.__rest(_b, ["streamConfig"]);
                        queryParams = tslib_1.__assign(tslib_1.__assign({}, additionalQueryParams), rest);
                        originalQuery = queryParams.q;
                        if (!(searchMode === "vector")) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.queryEmbedder.fetchVector(queryParams.q)];
                    case 1:
                        vector = _o.sent();
                        if (vector != null) {
                            vectorField = (_d = (_c = this.configuration.queryEmbedding) === null || _c === void 0 ? void 0 : _c.vectorField) !== null && _d !== void 0 ? _d : "embedding";
                            vectorQuery = "".concat(vectorField, ":([").concat(vector.join(","), "], k:").concat((_e = queryParams.per_page) !== null && _e !== void 0 ? _e : 10, ")");
                            queryParams.vector_query = vectorQuery;
                            queryParams.q = "*";
                        }
                        _o.label = 2;
                    case 2:
                        if (!(precomputedFilterBy != null && precomputedFilterBy.trim() !== "")) return [3 /*break*/, 3];
                        middlewareFilterBy = precomputedFilterBy;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.searchQueryMiddleware.fetchEnrichment(originalQuery, {
                            enabledOverride: middlewareEnabled,
                            timeoutMsOverride: middlewareTimeoutMs,
                        })];
                    case 4:
                        middlewareEnrichment = _o.sent();
                        middlewareFilterBy = middlewareEnrichment === null || middlewareEnrichment === void 0 ? void 0 : middlewareEnrichment.filterBy;
                        middlewareTelemetry = middlewareEnrichment === null || middlewareEnrichment === void 0 ? void 0 : middlewareEnrichment.telemetry;
                        _o.label = 5;
                    case 5:
                        queryParams.filter_by = (0, SearchQueryFilterBuilder_1.mergeFilterByClauses)(queryParams.filter_by, middlewareFilterBy);
                        isStreamingRequest = queryParams.conversation_stream === true;
                        shouldRunHybridSearch = this.shouldRunHybridSearch(queryParams.q, middlewareFilterBy, isStreamingRequest);
                        if (!shouldRunHybridSearch) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.performHybridSearch(queryParams, abortSignal, cacheSearchResultsForSeconds)];
                    case 6:
                        hybridResponse = _o.sent();
                        return [2 /*return*/, this.appendMiddlewareTelemetry(hybridResponse, middlewareTelemetry, middlewareFilterBy)];
                    case 7: return [4 /*yield*/, this.requestWithCache.perform(this.apiCall, "get", {
                            path: this.endpointPath("search"),
                            queryParams: queryParams,
                            streamConfig: streamConfig,
                            abortSignal: abortSignal,
                            isStreamingRequest: isStreamingRequest,
                        }, {
                            cacheResponseForSeconds: cacheSearchResultsForSeconds,
                        })];
                    case 8:
                        searchResponse = _o.sent();
                        return [2 /*return*/, this.appendMiddlewareTelemetry(searchResponse, middlewareTelemetry, middlewareFilterBy)];
                }
            });
        });
    };
    SearchOnlyDocuments.prototype.shouldRunHybridSearch = function (query, middlewareFilterBy, isStreamingRequest) {
        if (isStreamingRequest) {
            return false;
        }
        if (middlewareFilterBy == null || middlewareFilterBy.trim() === "") {
            return false;
        }
        if (typeof query !== "string") {
            return false;
        }
        var trimmedQuery = query.trim();
        return trimmedQuery.length > 0 && trimmedQuery !== "*";
    };
    SearchOnlyDocuments.prototype.performHybridSearch = function (queryParams, abortSignal, cacheSearchResultsForSeconds) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var rankedSearch, recallSearch, hybridResponse, rankedResult, recallResult;
            var _a, _b;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        rankedSearch = tslib_1.__assign(tslib_1.__assign({}, queryParams), { collection: this.collectionName });
                        recallSearch = tslib_1.__assign(tslib_1.__assign({}, rankedSearch), { q: "*" });
                        return [4 /*yield*/, this.requestWithCache.perform(this.apiCall, "post", {
                                path: "/multi_search",
                                body: {
                                    searches: [rankedSearch, recallSearch],
                                },
                                queryParams: {},
                                abortSignal: abortSignal,
                                isStreamingRequest: false,
                            }, {
                                cacheResponseForSeconds: cacheSearchResultsForSeconds,
                            })];
                    case 1:
                        hybridResponse = _c.sent();
                        rankedResult = (_a = hybridResponse === null || hybridResponse === void 0 ? void 0 : hybridResponse.results) === null || _a === void 0 ? void 0 : _a[0];
                        if (rankedResult == null) {
                            throw new Error("Hybrid search failed: ranked result is missing");
                        }
                        if (rankedResult.error != null || rankedResult.code != null) {
                            throw new Error(rankedResult.error || "Search failed with code ".concat(rankedResult.code));
                        }
                        recallResult = (_b = hybridResponse === null || hybridResponse === void 0 ? void 0 : hybridResponse.results) === null || _b === void 0 ? void 0 : _b[1];
                        if (recallResult == null ||
                            recallResult.error != null ||
                            recallResult.code != null) {
                            return [2 /*return*/, rankedResult];
                        }
                        return [2 /*return*/, this.mergeHybridResults(rankedResult, recallResult)];
                }
            });
        });
    };
    SearchOnlyDocuments.prototype.mergeHybridResults = function (rankedResult, recallResult) {
        var _this = this;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        var rankedHits = (_a = rankedResult.hits) !== null && _a !== void 0 ? _a : [];
        var recallHits = (_b = recallResult.hits) !== null && _b !== void 0 ? _b : [];
        var seenIds = new Set();
        var mergedHits = tslib_1.__spreadArray([], rankedHits, true);
        rankedHits.forEach(function (hit) { return seenIds.add(_this.hitKey(hit)); });
        recallHits.forEach(function (hit) {
            var key = _this.hitKey(hit);
            if (!seenIds.has(key)) {
                seenIds.add(key);
                mergedHits.push(hit);
            }
        });
        return tslib_1.__assign(tslib_1.__assign({}, rankedResult), { hits: mergedHits, found: Math.max((_c = rankedResult.found) !== null && _c !== void 0 ? _c : 0, (_d = recallResult.found) !== null && _d !== void 0 ? _d : 0), ranked_found: (_e = rankedResult.found) !== null && _e !== void 0 ? _e : 0, recall_found: (_f = recallResult.found) !== null && _f !== void 0 ? _f : 0, found_docs: Math.max((_g = rankedResult.found_docs) !== null && _g !== void 0 ? _g : 0, (_h = recallResult.found_docs) !== null && _h !== void 0 ? _h : 0), out_of: Math.max((_j = rankedResult.out_of) !== null && _j !== void 0 ? _j : 0, (_k = recallResult.out_of) !== null && _k !== void 0 ? _k : 0), facet_counts: (_l = recallResult.facet_counts) !== null && _l !== void 0 ? _l : rankedResult.facet_counts, grouped_hits: (_m = recallResult.grouped_hits) !== null && _m !== void 0 ? _m : rankedResult.grouped_hits, search_time_ms: Math.max((_o = rankedResult.search_time_ms) !== null && _o !== void 0 ? _o : 0, (_p = recallResult.search_time_ms) !== null && _p !== void 0 ? _p : 0) });
    };
    SearchOnlyDocuments.prototype.hitKey = function (hit) {
        var _a;
        var documentId = (_a = hit === null || hit === void 0 ? void 0 : hit.document) === null || _a === void 0 ? void 0 : _a["id"];
        if (typeof documentId === "string" ||
            typeof documentId === "number" ||
            typeof documentId === "boolean") {
            return String(documentId);
        }
        return JSON.stringify(hit.document);
    };
    SearchOnlyDocuments.prototype.appendMiddlewareTelemetry = function (searchResponse, telemetry, filterBy) {
        var _a;
        var result = searchResponse;
        if (filterBy != null) {
            result = tslib_1.__assign(tslib_1.__assign({}, result), { middleware_filter_by: filterBy });
        }
        if (telemetry == null) {
            return result;
        }
        var serializedTelemetry = JSON.parse(JSON.stringify(telemetry));
        return tslib_1.__assign(tslib_1.__assign({}, result), { metadata: tslib_1.__assign(tslib_1.__assign({}, ((_a = result.metadata) !== null && _a !== void 0 ? _a : {})), { middleware_telemetry: serializedTelemetry }) });
    };
    SearchOnlyDocuments.prototype.endpointPath = function (operation) {
        return "".concat(Collections_1.default.RESOURCEPATH, "/").concat(encodeURIComponent(this.collectionName)).concat(RESOURCEPATH).concat(operation === undefined ? "" : "/" + operation);
    };
    Object.defineProperty(SearchOnlyDocuments, "RESOURCEPATH", {
        get: function () {
            return RESOURCEPATH;
        },
        enumerable: false,
        configurable: true
    });
    return SearchOnlyDocuments;
}());
exports.SearchOnlyDocuments = SearchOnlyDocuments;
//# sourceMappingURL=SearchOnlyDocuments.js.map