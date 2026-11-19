"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var axios_1 = tslib_1.__importDefault(require("axios"));
var SearchQueryFilterBuilder_1 = require("./SearchQueryFilterBuilder");
var SearchQueryMiddleware = /** @class */ (function () {
    function SearchQueryMiddleware(configuration, logger) {
        this.configuration = configuration;
        this.logger = logger;
    }
    SearchQueryMiddleware.prototype.fetchFilterBy = function (query_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function (query, _a) {
            var enrichment;
            var _b = _a === void 0 ? {} : _a, enabledOverride = _b.enabledOverride, timeoutMsOverride = _b.timeoutMsOverride;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.fetchEnrichment(query, {
                            enabledOverride: enabledOverride,
                            timeoutMsOverride: timeoutMsOverride,
                        })];
                    case 1:
                        enrichment = _c.sent();
                        return [2 /*return*/, enrichment === null || enrichment === void 0 ? void 0 : enrichment.filterBy];
                }
            });
        });
    };
    SearchQueryMiddleware.prototype.fetchEnrichment = function (query_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function (query, _a) {
            var middlewareConfig, queryText, response, error_1;
            var _b, _c;
            var _d, _e, _f;
            var _g = _a === void 0 ? {} : _a, enabledOverride = _g.enabledOverride, timeoutMsOverride = _g.timeoutMsOverride;
            return tslib_1.__generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        if (!this.shouldRunMiddleware(query, enabledOverride)) {
                            return [2 /*return*/, undefined];
                        }
                        middlewareConfig = this.configuration.searchQueryMiddleware;
                        if (middlewareConfig == null) {
                            return [2 /*return*/, undefined];
                        }
                        queryText = String(query).trim();
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.post(middlewareConfig.url, undefined, {
                                params: (_b = {},
                                    _b[middlewareConfig.queryParamName] = queryText,
                                    _b),
                                headers: (_c = {},
                                    _c[middlewareConfig.apiKeyHeader] = middlewareConfig.apiKey,
                                    _c),
                                timeout: timeoutMsOverride !== null && timeoutMsOverride !== void 0 ? timeoutMsOverride : middlewareConfig.requestTimeoutMs,
                            })];
                    case 2:
                        response = _h.sent();
                        return [2 /*return*/, {
                                filterBy: (0, SearchQueryFilterBuilder_1.buildFilterByFromMiddlewareResponse)((_e = (_d = response.data) === null || _d === void 0 ? void 0 : _d.result) === null || _e === void 0 ? void 0 : _e.filters),
                                telemetry: (_f = response.data) === null || _f === void 0 ? void 0 : _f.telemetry,
                            }];
                    case 3:
                        error_1 = _h.sent();
                        this.logger.warn("Search query middleware call failed, proceeding without middleware filters: ".concat(error_1));
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SearchQueryMiddleware.prototype.shouldRunMiddleware = function (query, enabledOverride) {
        var middlewareConfig = this.configuration.searchQueryMiddleware;
        if (middlewareConfig == null) {
            return false;
        }
        var isEnabled = enabledOverride !== null && enabledOverride !== void 0 ? enabledOverride : middlewareConfig.enabled;
        if (isEnabled !== true) {
            return false;
        }
        if (typeof query !== "string") {
            return false;
        }
        var trimmedQuery = query.trim();
        return trimmedQuery.length > 0 && trimmedQuery !== "*";
    };
    return SearchQueryMiddleware;
}());
exports.default = SearchQueryMiddleware;
//# sourceMappingURL=SearchQueryMiddleware.js.map