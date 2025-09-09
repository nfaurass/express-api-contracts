import {ZodType, infer as ZInfer, ZodObject} from "zod";

// Request Types
export type RequestMethod = "post" | "put" | "patch" | "delete" | "get";
type BodyType<B extends ZodType | undefined> = B extends ZodType ? ZInfer<B> : undefined;
type HeadersType<H extends ZodType | undefined> = H extends ZodType ? ZInfer<H> : undefined;
type QueryType<Q extends ZodType | undefined> = Q extends ZodType ? ZInfer<Q> : undefined;
type RequestSchema<B extends ZodType, H extends ZodType, Q extends ZodType> = {
    body?: B;
    headers?: H;
    query?: Q;
};

// Response Types
export type ResponseSchema<R extends { [K in number]: ZodType }> = R;
export type ResponseUnion<R extends ResponseSchema<any>> = {
    [K in keyof R & number]: { status: K; body: ZInfer<R[K]> };
}[keyof R & number];

// Contract Interface
export interface Contract<B extends ZodType = ZodObject, H extends ZodType = ZodObject, Q extends ZodType = ZodObject, R extends Record<number, ZodType> = Record<number, ZodType>> {
    name?: string;
    path: string;
    method: RequestMethod;
    request?: RequestSchema<B, H, Q>;
    responses: ResponseSchema<R>;
    handler: (args: {
        body: BodyType<B> extends undefined ? undefined : BodyType<B>;
        headers: HeadersType<H> extends undefined ? undefined : HeadersType<H>;
        query: QueryType<Q> extends undefined ? undefined : QueryType<Q>;
    }) => Promise<Partial<ResponseUnion<R>>> | Partial<ResponseUnion<R>>;
}

// Contract Creator
export function createContract<B extends ZodType = ZodObject, H extends ZodType = ZodObject, Q extends ZodType = ZodObject, R extends Record<number, ZodType> = Record<number, ZodType>>(contract: Contract<B, H, Q, R>) {
    return contract;
}