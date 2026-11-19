"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var axios_1 = tslib_1.__importDefault(require("axios"));
var QueryEmbedder = /** @class */ (function () {
    function QueryEmbedder(configuration, logger) {
        this.configuration = configuration;
        this.logger = logger;
    }
    QueryEmbedder.prototype.fetchVector = function (query) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var queryEmbeddingConfig, trimmedQuery, response, error_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryEmbeddingConfig = this.configuration.queryEmbedding;
                        if (queryEmbeddingConfig == null || queryEmbeddingConfig.enabled !== true) {
                            return [2 /*return*/, undefined];
                        }
                        if (typeof query !== "string") {
                            return [2 /*return*/, undefined];
                        }
                        trimmedQuery = query.trim();
                        if (trimmedQuery === "" || trimmedQuery === "*") {
                            return [2 /*return*/, undefined];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.post(queryEmbeddingConfig.url, {
                                action: queryEmbeddingConfig.action,
                                query: trimmedQuery,
                            }, {
                                timeout: queryEmbeddingConfig.requestTimeoutMs,
                            })];
                    case 2:
                        response = _a.sent();
                        return [2 /*return*/, this.extractVector(response.data)];
                    case 3:
                        error_1 = _a.sent();
                        this.logger.warn("Query embedding call failed, proceeding without vector search: ".concat(error_1));
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    QueryEmbedder.prototype.extractVector = function (data) {
        var embedding = data.embedding, dimensions = data.dimensions;
        if (!Array.isArray(embedding) ||
            !embedding.every(function (value) { return typeof value === "number"; })) {
            this.logger.warn("Query embedding response missing a numeric embedding array, proceeding without vector search");
            return undefined;
        }
        if (typeof dimensions === "number" && embedding.length !== dimensions) {
            this.logger.warn("Query embedding response length (".concat(embedding.length, ") does not match declared dimensions (").concat(dimensions, "), proceeding without vector search"));
            return undefined;
        }
        return embedding;
    };
    return QueryEmbedder;
}());
exports.default = QueryEmbedder;
//# sourceMappingURL=QueryEmbedder.js.map