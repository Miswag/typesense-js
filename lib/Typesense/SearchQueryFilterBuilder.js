"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFilterByFromMiddlewareResponse = buildFilterByFromMiddlewareResponse;
exports.mergeFilterByClauses = mergeFilterByClauses;
var isDivisionField = function (fieldName) {
    return /^l\d+_division/.test(fieldName);
};
function buildFilterByFromMiddlewareResponse(filters) {
    if (filters == null) {
        return undefined;
    }
    var divisionClauses = [];
    var otherClauses = [];
    for (var _i = 0, _a = Object.entries(filters); _i < _a.length; _i++) {
        var _b = _a[_i], fieldName = _b[0], fieldValues = _b[1];
        var clause = buildFieldClause(fieldName, fieldValues);
        if (clause == null)
            continue;
        if (isDivisionField(fieldName)) {
            divisionClauses.push(clause);
        }
        else {
            otherClauses.push(clause);
        }
    }
    var parts = [];
    if (divisionClauses.length === 1) {
        parts.push(divisionClauses[0]);
    }
    else if (divisionClauses.length > 1) {
        parts.push("(".concat(divisionClauses.join(" || "), ")"));
    }
    for (var _c = 0, otherClauses_1 = otherClauses; _c < otherClauses_1.length; _c++) {
        var clause = otherClauses_1[_c];
        parts.push(clause);
    }
    if (parts.length === 0) {
        return undefined;
    }
    return parts.join(" && ");
}
function mergeFilterByClauses(existingFilterBy, middlewareFilterBy) {
    var existing = sanitizeClause(existingFilterBy);
    var middleware = sanitizeClause(middlewareFilterBy);
    if (existing == null)
        return middleware;
    if (middleware == null)
        return existing;
    return "(".concat(existing, ") && (").concat(middleware, ")");
}
function buildFieldClause(fieldName, fieldValues) {
    if (typeof fieldName !== "string" ||
        fieldName.trim() === "" ||
        !Array.isArray(fieldValues)) {
        return undefined;
    }
    var serializedValues = fieldValues
        .map(serializeFilterValue)
        .filter(function (value) { return value !== undefined; });
    if (serializedValues.length === 0) {
        return undefined;
    }
    return "".concat(fieldName, ":=[").concat(serializedValues.join(","), "]");
}
function serializeFilterValue(value) {
    if (typeof value === "string") {
        return "`".concat(escapeForFilterValue(value), "`");
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return undefined;
}
function escapeForFilterValue(value) {
    return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}
function sanitizeClause(clause) {
    if (typeof clause !== "string") {
        return undefined;
    }
    var trimmedClause = clause.trim();
    return trimmedClause.length === 0 ? undefined : trimmedClause;
}
//# sourceMappingURL=SearchQueryFilterBuilder.js.map