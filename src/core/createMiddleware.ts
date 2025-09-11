import type {ZodObject} from "zod";
import type {MiddlewareContract} from "./middleware.types";

/**
 * Create a type-safe middleware contract for Express.
 *
 * @param middleware Object defining the middleware:
 * - `name` (optional): Human-readable name.
 * - `request` (optional): Zod schemas for body, headers, query.
 * - `provides` (optional): Zod schema for the context this middleware adds.
 * - `handler`: Function called with typed `body`, `headers`, `query`, `context`, `req`, `res`, and `next`.
 */
export function createMiddleware<
    BODY extends ZodObject<any> = ZodObject<any>,
    HEADERS extends ZodObject<any> = ZodObject<any>,
    QUERY extends ZodObject<any> = ZodObject<any>,
    CONTEXT extends ZodObject<any> = ZodObject<any>,
>(middleware: MiddlewareContract<BODY, HEADERS, QUERY, CONTEXT>) {
    return middleware;
}
