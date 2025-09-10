import {ZodObject, ZodType, ZodArray, infer as ZInfer} from "zod";
import {MiddlewareContract} from "./middleware";
import {Request, Response} from "express";

// Request Types
export type RequestMethod = "post" | "put" | "patch" | "delete" | "get";
type BodyType<BODY extends ZodObject<any> | undefined> = BODY extends ZodObject<any> ? ZInfer<BODY> : undefined;
type HeadersType<HEADERS extends ZodObject<any> | undefined> = HEADERS extends ZodObject<any> ? ZInfer<HEADERS> : undefined;
type QueryType<QUERY extends ZodObject<any> | undefined> = QUERY extends ZodObject<any> ? ZInfer<QUERY> : undefined;
type ParamsType<PARAMS extends ZodObject<any> | undefined> = PARAMS extends ZodObject<any> ? ZInfer<PARAMS> : undefined;
type RequestSchema<BODY extends ZodObject<any>, HEADERS extends ZodObject<any>, QUERY extends ZodObject<any>, PARAMS extends ZodObject<any>> = {
    body?: BODY;
    headers?: HEADERS;
    query?: QUERY;
    params?: PARAMS;
};

// Response Types
type ResponseSchemaItem = ZodObject<any> | ZodArray<ZodObject<any>>;
type ResponseSchema<RESPONSE extends { [KEY in number]: ResponseSchemaItem }> = RESPONSE;
type ResponseUnion<RESPONSE extends ResponseSchema<any>> = {
    [KEY in keyof RESPONSE & number]: { status: KEY; body: ZInfer<RESPONSE[KEY]> };
}[keyof RESPONSE & number];

// Contract Interface
export interface Contract<BODY extends ZodObject<any> = ZodObject<any>, HEADERS extends ZodObject<any> = ZodObject<any>, QUERY extends ZodObject<any> = ZodObject<any>, PARAMS extends ZodObject<any> = ZodObject<any>, RESPONSE extends Record<number, ResponseSchemaItem> = Record<number, ResponseSchemaItem>> {
    name?: string;
    path: string;
    method: RequestMethod;
    request?: RequestSchema<BODY, HEADERS, QUERY, PARAMS>;
    responses: ResponseSchema<RESPONSE>;
    middlewares?: MiddlewareContract[];
    handler: (args: {
        req: Request;
        res: Response;
        body: BodyType<BODY>;
        headers: HeadersType<HEADERS>;
        query: QueryType<QUERY>;
        params: ParamsType<PARAMS>;
    }) => Promise<Partial<ResponseUnion<RESPONSE>>> | Partial<ResponseUnion<RESPONSE>>;
}

// Contract Creator
export function createContract<BODY extends ZodObject<any> = ZodObject<any>, HEADERS extends ZodObject<any> = ZodObject<any>, QUERY extends ZodObject<any> = ZodObject<any>, PARAMS extends ZodObject<any> = ZodObject<any>, RESPONSE extends Record<number, ResponseSchemaItem> = Record<number, ResponseSchemaItem>>(contract: Contract<BODY, HEADERS, QUERY, PARAMS, RESPONSE>) {
    return contract;
}