import {infer as ZInfer, ZodObject} from "zod";
import {Request, Response} from "express";

// Request Types
type BodyType<BODY extends ZodObject<any> | undefined> = BODY extends ZodObject<any> ? ZInfer<BODY> : undefined;
type HeadersType<HEADERS extends ZodObject<any> | undefined> = HEADERS extends ZodObject<any> ? ZInfer<HEADERS> : undefined;
type QueryType<QUERY extends ZodObject<any> | undefined> = QUERY extends ZodObject<any> ? ZInfer<QUERY> : undefined;
type ContextType<CONTEXT extends ZodObject<any> | undefined> = CONTEXT extends ZodObject<any> ? ZInfer<CONTEXT> : undefined;
export type RequestSchema<BODY extends ZodObject<any> = ZodObject<any>, HEADERS extends ZodObject<any> = ZodObject<any>, QUERY extends ZodObject<any> = ZodObject<any>> = {
    body?: BODY;
    headers?: HEADERS;
    query?: QUERY;
};

// Middleware Contract Interface
export interface MiddlewareContract<BODY extends ZodObject<any> = ZodObject<any>, HEADERS extends ZodObject<any> = ZodObject<any>, QUERY extends ZodObject<any> = ZodObject<any>, CONTEXT extends ZodObject<any> = ZodObject<any>> {
    name?: string;
    request?: RequestSchema<BODY, HEADERS, QUERY>;
    provides?: CONTEXT;
    handler: (args: {
        body: BodyType<BODY>;
        headers: HeadersType<HEADERS>;
        query: QueryType<QUERY>;
        context: ContextType<CONTEXT>;
        req: Request;
        res: Response;
        next: {
            success: (context?: Partial<ContextType<CONTEXT>>) => void;
            error: (status: number, body: unknown) => void;
        };
    }) => void | Promise<void>;
}

// Middleware Creator
export function createMiddleware<BODY extends ZodObject<any> = ZodObject<any>, HEADERS extends ZodObject<any> = ZodObject<any>, QUERY extends ZodObject<any> = ZodObject<any>, CONTEXT extends ZodObject<any> = ZodObject<any>>(middleware: MiddlewareContract<BODY, HEADERS, QUERY, CONTEXT>) {
    return middleware;
}