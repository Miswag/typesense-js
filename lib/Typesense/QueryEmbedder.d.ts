import type Configuration from "./Configuration";
import type { Logger } from "loglevel";
export default class QueryEmbedder {
    private readonly configuration;
    private readonly logger;
    constructor(configuration: Configuration, logger: Logger);
    fetchVector(query: unknown): Promise<number[] | undefined>;
    private extractVector;
}
