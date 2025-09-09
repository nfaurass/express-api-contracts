import {ZodType, infer as ZInfer, ZodObject} from "zod";
import {MiddlewareContract} from "./middleware";
import {Request, Response} from "express";

// Request Types
export type RequestMethod = "post" | "put" | "patch" | "delete" | "get";
type BodyType<BODY extends ZodType | undefined> = BODY extends ZodType ? ZInfer<BODY> : undefined;
type HeadersType<HEADERS extends ZodType | undefined> = HEADERS extends ZodType ? ZInfer<HEADERS> : undefined;
type QueryType<QUERY extends ZodType | undefined> = QUERY extends ZodType ? ZInfer<QUERY> : undefined;
type ParamsType<PARAMS extends ZodType | undefined> = PARAMS extends ZodType ? ZInfer<PARAMS> : undefined;
type RequestSchema<BODY extends ZodType, HEADERS extends ZodType, QUERY extends ZodType, PARAMS extends ZodType> = {
    body?: BODY;
    headers?: HEADERS;
    query?: QUERY;
    params?: PARAMS;
};

// Response Types
type ResponseSchema<RESPONSE extends { [KEY in number]: ZodType }> = RESPONSE;
type ResponseUnion<RESPONSE extends ResponseSchema<any>> = {
    [KEY in keyof RESPONSE & number]: { status: KEY; body: ZInfer<RESPONSE[KEY]> };
}[keyof RESPONSE & number];

// Contract Interface
export interface Contract<BODY extends ZodType = ZodObject, HEADERS extends ZodType = ZodObject, QUERY extends ZodType = ZodObject, PARAMS extends ZodType = ZodObject, RESPONSE extends Record<number, ZodType> = Record<number, ZodType>> {
    name?: string;
    path: string;
    method: RequestMethod;
    request?: RequestSchema<BODY, HEADERS, QUERY, PARAMS>;
    responses: ResponseSchema<RESPONSE>;
    middlewares?: MiddlewareContract[];
    handler: (args: {
        req: Request;
        res: Response;
        body: BodyType<BODY> extends undefined ? undefined : BodyType<BODY>;
        headers: HeadersType<HEADERS> extends undefined ? undefined : HeadersType<HEADERS>;
        query: QueryType<QUERY> extends undefined ? undefined : QueryType<QUERY>;
        params: ParamsType<PARAMS> extends undefined ? undefined : ParamsType<PARAMS>;
    }) => Promise<Partial<ResponseUnion<RESPONSE>>> | Partial<ResponseUnion<RESPONSE>>;
}

// Contract Creator
export function createContract<BODY extends ZodType = ZodObject, HEADERS extends ZodType = ZodObject, QUERY extends ZodType = ZodObject, PARAMS extends ZodType = ZodObject, RESPONSE extends Record<number, ZodType> = Record<number, ZodType>>(contract: Contract<BODY, HEADERS, QUERY, PARAMS, RESPONSE>) {
    return contract;
}