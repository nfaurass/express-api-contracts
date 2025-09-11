import type {ZodObject} from "zod";
import type {MiddlewareContract} from "./middleware.types";
import type {Contract, ResponseSchemaItem} from "./contract.types";

/**
 * Create a type-safe Express API contract.
 *
 * @param contract Object defining the endpoint:
 * - `name` (optional): Human-readable name.
 * - `path`: Route path (e.g. "/users/:id").
 * - `method`: HTTP method ("get", "post", etc.).
 * - `request` (optional): Zod schemas for body, headers, query.
 * - `responses`: Object mapping status codes to Zod schemas or `null`.
 * - `middlewares` (optional): Array of middleware contracts.
 * - `handler`: Function called with typed `req`, `res`, `body`, `headers`, `query`, `context`.
 */
export function createContract<
    BODY extends ZodObject<any> = ZodObject<any>,
    HEADERS extends ZodObject<any> = ZodObject<any>,
    QUERY extends ZodObject<any> = ZodObject<any>,
    PARAMS extends ZodObject<any> = ZodObject<any>,
    RESPONSE extends Record<number, ResponseSchemaItem> = Record<number, ResponseSchemaItem>,
    MIDDLEWARES extends readonly MiddlewareContract[] = readonly MiddlewareContract[],
>(contract: Contract<BODY, HEADERS, QUERY, PARAMS, RESPONSE, MIDDLEWARES>) {
    return contract;
}
