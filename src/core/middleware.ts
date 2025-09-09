import {ZodType, infer as ZInfer, ZodObject} from "zod";
import {Request, Response} from "express";

// Request Types
type BodyType<BODY extends ZodType | undefined> = BODY extends ZodType ? ZInfer<BODY> : undefined;
type HeadersType<HEADERS extends ZodType | undefined> = HEADERS extends ZodType ? ZInfer<HEADERS> : undefined;
type QueryType<QUERY extends ZodType | undefined> = QUERY extends ZodType ? ZInfer<QUERY> : undefined;
export type RequestSchema<BODY extends ZodType, HEADERS extends ZodType, QUERY extends ZodType> = {
    body?: BODY;
    headers?: HEADERS;
    query?: QUERY;
};

// Middleware Context
export type MiddlewareContext = Record<string, unknown>;

// Middleware Contract Interface
export interface MiddlewareContract<BODY extends ZodType = ZodObject, HEADERS extends ZodType = ZodObject, QUERY extends ZodType = ZodObject, CONTEXT extends MiddlewareContext = MiddlewareContext> {
    name?: string;
    request?: RequestSchema<BODY, HEADERS, QUERY>;
    handler: (args: {
        body: BodyType<BODY> extends undefined ? undefined : BodyType<BODY>;
        headers: HeadersType<HEADERS> extends undefined ? undefined : HeadersType<HEADERS>;
        query: QueryType<QUERY> extends undefined ? undefined : QueryType<QUERY>;
        context: CONTEXT;
        req: Request;
        res: Response;
        next: {
            success: (context?: Partial<CONTEXT>) => void;
            error: (status: number, body: unknown) => void;
        };
    }) => void | Promise<void>;
}

// Middleware Creator
export function createMiddleware<BODY extends ZodType = ZodObject, HEADERS extends ZodType = ZodObject, QUERY extends ZodType = ZodObject, CONTEXT extends MiddlewareContext = MiddlewareContext>(middleware: MiddlewareContract<BODY, HEADERS, QUERY, CONTEXT>) {
    return middleware;
}