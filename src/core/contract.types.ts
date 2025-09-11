import type {ZodObject, ZodArray, infer as ZInfer} from "zod";
import type {MiddlewareContract} from "./middleware.types";
import type {Request, Response} from "express";

/**
 * Supported HTTP methods for an API contract.
 */
export type RequestMethod = "post" | "put" | "patch" | "delete" | "get";

/** @internal Extracts body type from a Zod schema */
type BodyType<BODY extends ZodObject<any> | undefined> =
    BODY extends ZodObject<any> ? ZInfer<BODY> : undefined;

/** @internal Extracts headers type from a Zod schema */
type HeadersType<HEADERS extends ZodObject<any> | undefined> =
    HEADERS extends ZodObject<any> ? ZInfer<HEADERS> : undefined;

/** @internal Extracts query type from a Zod schema */
type QueryType<QUERY extends ZodObject<any> | undefined> =
    QUERY extends ZodObject<any> ? ZInfer<QUERY> : undefined;

/** @internal Extracts params type from a Zod schema */
type ParamsType<PARAMS extends ZodObject<any> | undefined> =
    PARAMS extends ZodObject<any> ? ZInfer<PARAMS> : undefined;

/** @internal Defines request schemas for body, headers, query, and params */
type RequestSchema<
    BODY extends ZodObject<any>,
    HEADERS extends ZodObject<any>,
    QUERY extends ZodObject<any>,
    PARAMS extends ZodObject<any>,
> = {
    body?: BODY;
    headers?: HEADERS;
    query?: QUERY;
    params?: PARAMS;
};

/**
 * A valid response schema for an endpoint.
 * Can be a single Zod object, an array of Zod objects, or `null` if no content.
 */
export type ResponseSchemaItem = ZodObject<any> | ZodArray<ZodObject<any>> | null;

/** @internal Maps HTTP status codes to response schemas */
type ResponseSchema<RESPONSE extends { [KEY in number]: ResponseSchemaItem }> = RESPONSE;

/** @internal Union of all possible responses for a schema */
type ResponseUnion<RESPONSE extends ResponseSchema<any>> = {
    [KEY in keyof RESPONSE & number]: RESPONSE[KEY] extends null
        ? { status: KEY }
        : { status: KEY; body: ZInfer<NonNullable<RESPONSE[KEY]>> };
}[keyof RESPONSE & number];

/** @internal Extracts middleware context type */
type MiddlewareContext<M> =
    M extends MiddlewareContract<any, any, any, infer C>
        ? C extends ZodObject<any>
            ? ZInfer<C>
            : unknown
        : never;

/** @internal Converts union types to intersection */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

/** @internal Merge multiple middleware contexts into a single type */
type MergeMiddlewares<M extends readonly MiddlewareContract[]> = UnionToIntersection<
    MiddlewareContext<M[number]>
>;

/**
 * Defines a type-safe API contract for an Express endpoint.
 *
 * This object defines:
 * - `name` (optional): Human-readable name.
 * - `path`: Route path (e.g. "/users/:id").
 * - `method`: HTTP method.
 * - `request` (optional): Zod schemas for body, headers, query, params.
 * - `responses`: Status codes mapped to response schemas.
 * - `middlewares` (optional): Array of middleware contracts providing context.
 * - `handler`: Function called with typed `request`, `response`, parsed `body`, `headers`, `query`, `params`, and merged middleware `context`.
 */
export interface Contract<
    BODY extends ZodObject<any> = ZodObject<any>,
    HEADERS extends ZodObject<any> = ZodObject<any>,
    QUERY extends ZodObject<any> = ZodObject<any>,
    PARAMS extends ZodObject<any> = ZodObject<any>,
    RESPONSE extends Record<number, ResponseSchemaItem> = Record<number, ResponseSchemaItem>,
    MIDDLEWARES extends readonly MiddlewareContract[] = readonly MiddlewareContract[],
> {
    /** Optional human-readable name for the endpoint */
    name?: string;
    /** Route path, e.g. "/users/:id" */
    path: string;
    /** HTTP method for this endpoint */
    method: RequestMethod;
    /** Optional request schemas for body, headers, query, params */
    request?: RequestSchema<BODY, HEADERS, QUERY, PARAMS>;
    /** Responses mapped by status codes */
    responses: ResponseSchema<RESPONSE>;
    /** Optional middlewares applied to this endpoint */
    middlewares?: MIDDLEWARES;
    /** Handler function called with typed args */
    handler: (args: {
        req: Request;
        res: Response;
        body: BodyType<BODY>;
        headers: HeadersType<HEADERS>;
        query: QueryType<QUERY>;
        params: ParamsType<PARAMS>;
        context: MergeMiddlewares<MIDDLEWARES>;
    }) => Promise<Partial<ResponseUnion<RESPONSE>>> | Partial<ResponseUnion<RESPONSE>>;
}
