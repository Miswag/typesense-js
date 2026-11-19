"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var logger = tslib_1.__importStar(require("loglevel"));
var Errors_1 = require("./Errors");
var Configuration = /** @class */ (function () {
    function Configuration(options) {
        var _this = this;
        this.nodes = options.nodes || [];
        this.nodes = this.nodes
            .map(function (node) { return _this.setDefaultPathInNode(node); })
            .map(function (node) { return _this.setDefaultPortInNode(node); })
            .map(function (node) { return (tslib_1.__assign({}, node)); }); // Make a deep copy
        if (options.randomizeNodes == null) {
            options.randomizeNodes = true;
        }
        if (options.randomizeNodes === true) {
            this.shuffleArray(this.nodes);
        }
        this.nearestNode = options.nearestNode;
        this.nearestNode = this.setDefaultPathInNode(this.nearestNode);
        this.nearestNode = this.setDefaultPortInNode(this.nearestNode);
        this.connectionTimeoutSeconds =
            options.connectionTimeoutSeconds || options.timeoutSeconds || 5;
        this.healthcheckIntervalSeconds = options.healthcheckIntervalSeconds || 60;
        this.numRetries =
            (options.numRetries !== undefined && options.numRetries >= 0
                ? options.numRetries
                : this.nodes.length + (this.nearestNode == null ? 0 : 1)) || 3;
        this.retryIntervalSeconds = options.retryIntervalSeconds || 0.1;
        this.apiKey = options.apiKey;
        this.sendApiKeyAsQueryParam = options.sendApiKeyAsQueryParam; // We will set a default for this in Client and SearchClient
        this.cacheSearchResultsForSeconds =
            options.cacheSearchResultsForSeconds || 0; // Disable client-side cache by default
        this.useServerSideSearchCache = options.useServerSideSearchCache || false;
        this.axiosAdapter = options.axiosAdapter;
        this.logger = options.logger || logger;
        this.logLevel = options.logLevel || "warn";
        this.logger.setLevel(this.logLevel);
        this.additionalHeaders = options.additionalHeaders;
        this.httpAgent = options.httpAgent;
        this.httpsAgent = options.httpsAgent;
        this.paramsSerializer = options.paramsSerializer;
        this.searchQueryMiddleware = this.resolveSearchQueryMiddleware(options.searchQueryMiddleware);
        this.queryEmbedding = this.resolveQueryEmbedding(options.queryEmbedding);
        this.showDeprecationWarnings(options);
        this.validate();
    }
    Configuration.prototype.validate = function () {
        if (this.nodes == null || this.nodes.length === 0 || this.validateNodes()) {
            throw new Errors_1.MissingConfigurationError("Ensure that nodes[].protocol, nodes[].host and nodes[].port are set");
        }
        if (this.nearestNode != null &&
            this.isNodeMissingAnyParameters(this.nearestNode)) {
            throw new Errors_1.MissingConfigurationError("Ensure that nearestNodes.protocol, nearestNodes.host and nearestNodes.port are set");
        }
        if (this.apiKey == null) {
            throw new Errors_1.MissingConfigurationError("Ensure that apiKey is set");
        }
        this.validateSearchQueryMiddleware();
        this.validateQueryEmbedding();
        return true;
    };
    Configuration.prototype.validateSearchQueryMiddleware = function () {
        if (this.searchQueryMiddleware == null ||
            this.searchQueryMiddleware.enabled !== true) {
            return;
        }
        if (typeof this.searchQueryMiddleware.url !== "string" ||
            this.searchQueryMiddleware.url.trim() === "") {
            throw new Errors_1.MissingConfigurationError("Ensure that searchQueryMiddleware.url is set when middleware is enabled");
        }
        if (typeof this.searchQueryMiddleware.apiKey !== "string" ||
            this.searchQueryMiddleware.apiKey.trim() === "") {
            throw new Errors_1.MissingConfigurationError("Ensure that searchQueryMiddleware.apiKey is set when middleware is enabled");
        }
    };
    Configuration.prototype.resolveSearchQueryMiddleware = function (searchQueryMiddleware) {
        var _a, _b, _c, _d;
        if (searchQueryMiddleware == null) {
            return undefined;
        }
        return tslib_1.__assign(tslib_1.__assign({}, searchQueryMiddleware), { enabled: (_a = searchQueryMiddleware.enabled) !== null && _a !== void 0 ? _a : false, apiKeyHeader: (_b = searchQueryMiddleware.apiKeyHeader) !== null && _b !== void 0 ? _b : "x-api-key", queryParamName: (_c = searchQueryMiddleware.queryParamName) !== null && _c !== void 0 ? _c : "query", requestTimeoutMs: (_d = searchQueryMiddleware.requestTimeoutMs) !== null && _d !== void 0 ? _d : 5000 });
    };
    Configuration.prototype.validateQueryEmbedding = function () {
        if (this.queryEmbedding == null || this.queryEmbedding.enabled !== true) {
            return;
        }
        if (typeof this.queryEmbedding.url !== "string" ||
            this.queryEmbedding.url.trim() === "") {
            throw new Errors_1.MissingConfigurationError("Ensure that queryEmbedding.url is set when queryEmbedding is enabled");
        }
    };
    Configuration.prototype.resolveQueryEmbedding = function (queryEmbedding) {
        var _a, _b, _c, _d;
        if (queryEmbedding == null) {
            return undefined;
        }
        return tslib_1.__assign(tslib_1.__assign({}, queryEmbedding), { enabled: (_a = queryEmbedding.enabled) !== null && _a !== void 0 ? _a : false, action: (_b = queryEmbedding.action) !== null && _b !== void 0 ? _b : "embed", vectorField: (_c = queryEmbedding.vectorField) !== null && _c !== void 0 ? _c : "embedding", requestTimeoutMs: (_d = queryEmbedding.requestTimeoutMs) !== null && _d !== void 0 ? _d : 5000 });
    };
    Configuration.prototype.validateNodes = function () {
        var _this = this;
        return this.nodes.some(function (node) {
            return _this.isNodeMissingAnyParameters(node);
        });
    };
    Configuration.prototype.isNodeMissingAnyParameters = function (node) {
        return (!["protocol", "host", "port", "path"].every(function (key) {
            return node.hasOwnProperty(key);
        }) && node["url"] == null);
    };
    Configuration.prototype.setDefaultPathInNode = function (node) {
        if (node != null && !node.hasOwnProperty("path")) {
            node["path"] = "";
        }
        return node;
    };
    Configuration.prototype.setDefaultPortInNode = function (node) {
        if (node != null &&
            !node.hasOwnProperty("port") &&
            node.hasOwnProperty("protocol")) {
            switch (node["protocol"]) {
                case "https":
                    node["port"] = 443;
                    break;
                case "http":
                    node["port"] = 80;
                    break;
            }
        }
        return node;
    };
    Configuration.prototype.showDeprecationWarnings = function (options) {
        if (options.timeoutSeconds) {
            this.logger.warn("Deprecation warning: timeoutSeconds is now renamed to connectionTimeoutSeconds");
        }
        if (options.masterNode) {
            this.logger.warn("Deprecation warning: masterNode is now consolidated to nodes, starting with Typesense Server v0.12");
        }
        if (options.readReplicaNodes) {
            this.logger.warn("Deprecation warning: readReplicaNodes is now consolidated to nodes, starting with Typesense Server v0.12");
        }
    };
    Configuration.prototype.shuffleArray = function (array) {
        var _a;
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            _a = [array[j], array[i]], array[i] = _a[0], array[j] = _a[1];
        }
    };
    return Configuration;
}());
exports.default = Configuration;
//# sourceMappingURL=Configuration.js.map