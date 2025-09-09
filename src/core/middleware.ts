import {ZodType, infer as ZInfer, ZodObject} from "zod";
import {Request} from "express";

// Request Types
type BodyType<B extends ZodType | undefined> = B extends ZodType ? ZInfer<B> : undefined;
type HeadersType<H extends ZodType | undefined> = H extends ZodType ? ZInfer<H> : undefined;
type QueryType<Q extends ZodType | undefined> = Q extends ZodType ? ZInfer<Q> : undefined;
export type RequestSchema<B extends ZodType, H extends ZodType, Q extends ZodType> = {
    body?: B;
    headers?: H;
    query?: Q;
};

// Middleware Context
export type MiddlewareContext = Record<string, unknown>;

// Middleware Contract Interface
export interface MiddlewareContract<B extends ZodType = ZodObject, H extends ZodType = ZodObject, Q extends ZodType = ZodObject, C extends MiddlewareContext = MiddlewareContext> {
    name?: string;
    request?: RequestSchema<B, H, Q>;
    handler: (args: {
        body: BodyType<B> extends undefined ? undefined : BodyType<B>;
        headers: HeadersType<H> extends undefined ? undefined : HeadersType<H>;
        query: QueryType<Q> extends undefined ? undefined : QueryType<Q>;
        context: C;
        req: Request;
        next: {
            success: (context?: Partial<C>) => void;
            error: (status: number, body: unknown) => void;
        };
    }) => void | Promise<void>;
}

// Middleware Creator
export function createMiddleware<B extends ZodType = ZodObject, H extends ZodType = ZodObject, Q extends ZodType = ZodObject, C extends MiddlewareContext = MiddlewareContext>(middleware: MiddlewareContract<B, H, Q, C>) {
    return middleware;
}