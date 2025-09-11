import type {infer as ZInfer, ZodObject} from "zod";
import type {Request, Response} from "express";

/** @internal Extracts body type from a Zod schema */
type BodyType<BODY extends ZodObject<any> | undefined> =
    BODY extends ZodObject<any> ? ZInfer<BODY> : undefined;

/** @internal Extracts headers type from a Zod schema */
type HeadersType<HEADERS extends ZodObject<any> | undefined> =
    HEADERS extends ZodObject<any> ? ZInfer<HEADERS> : undefined;

/** @internal Extracts query type from a Zod schema */
type QueryType<QUERY extends ZodObject<any> | undefined> =
    QUERY extends ZodObject<any> ? ZInfer<QUERY> : undefined;

/** @internal Extracts context type from a Zod schema */
type ContextType<CONTEXT extends ZodObject<any> | undefined> =
    CONTEXT extends ZodObject<any> ? ZInfer<CONTEXT> : undefined;

/** @internal Defines request schemas for body, headers, and query */
type RequestSchema<
    BODY extends ZodObject<any> = ZodObject<any>,
    HEADERS extends ZodObject<any> = ZodObject<any>,
    QUERY extends ZodObject<any> = ZodObject<any>,
> = {
    body?: BODY;
    headers?: HEADERS;
    query?: QUERY;
};

/**
 * Defines a type-safe middleware contract for use with API contracts.
 *
 * This object defines:
 * - `name` (optional): Human-readable name.
 * - `request` (optional): Zod schemas for body, headers, query.
 * - `provides` (optional): Zod schema describing the context added by this middleware.
 * - `handler`: Function called with typed `body`, `headers`, `query`, `context`, `req`, `res`, and `next`.
 */
export interface MiddlewareContract<
    BODY extends ZodObject<any> = ZodObject<any>,
    HEADERS extends ZodObject<any> = ZodObject<any>,
    QUERY extends ZodObject<any> = ZodObject<any>,
    CONTEXT extends ZodObject<any> = ZodObject<any>,
> {
    /** Optional name for identifying the middleware */
    name?: string;
    /** Optional request validation schemas */
    request?: RequestSchema<BODY, HEADERS, QUERY>;
    /** Context provided by this middleware */
    provides?: CONTEXT;
    /** Handler function called with typed args */
    handler: (args: {
        body: BodyType<BODY>;
        headers: HeadersType<HEADERS>;
        query: QueryType<QUERY>;
        context: ContextType<CONTEXT>;
        req: Request;
        res: Response;
        next: {
            /** Call when middleware succeeds; optionally extend context */
            success: (context?: Partial<ContextType<CONTEXT>>) => void;
            /** Call when middleware fails with status and body */
            error: (status: number, body: unknown) => void;
        };
    }) => void | Promise<void>;
}
