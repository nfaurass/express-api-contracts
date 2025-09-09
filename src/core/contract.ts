import {ZodType, infer as ZInfer, ZodObject} from "zod";
import {MiddlewareContract} from "./middleware";

// Request Types
export type RequestMethod = "post" | "put" | "patch" | "delete" | "get";
type BodyType<B extends ZodType | undefined> = B extends ZodType ? ZInfer<B> : undefined;
type HeadersType<H extends ZodType | undefined> = H extends ZodType ? ZInfer<H> : undefined;
type QueryType<Q extends ZodType | undefined> = Q extends ZodType ? ZInfer<Q> : undefined;
type ParamsType<P extends ZodType | undefined> = P extends ZodType ? ZInfer<P> : undefined;
type RequestSchema<B extends ZodType, H extends ZodType, Q extends ZodType, P extends ZodType> = {
    body?: B;
    headers?: H;
    query?: Q;
    params?: P;
};

// Response Types
type ResponseSchema<R extends { [K in number]: ZodType }> = R;
type ResponseUnion<R extends ResponseSchema<any>> = {
    [K in keyof R & number]: { status: K; body: ZInfer<R[K]> };
}[keyof R & number];

// Contract Interface
export interface Contract<B extends ZodType = ZodObject, H extends ZodType = ZodObject, Q extends ZodType = ZodObject, P extends ZodType = ZodObject, R extends Record<number, ZodType> = Record<number, ZodType>> {
    name?: string;
    path: string;
    method: RequestMethod;
    request?: RequestSchema<B, H, Q, P>;
    responses: ResponseSchema<R>;
    middlewares?: MiddlewareContract[];
    handler: (args: {
        body: BodyType<B> extends undefined ? undefined : BodyType<B>;
        headers: HeadersType<H> extends undefined ? undefined : HeadersType<H>;
        query: QueryType<Q> extends undefined ? undefined : QueryType<Q>;
        params: ParamsType<P> extends undefined ? undefined : ParamsType<P>;
    }) => Promise<Partial<ResponseUnion<R>>> | Partial<ResponseUnion<R>>;
}

// Contract Creator
export function createContract<B extends ZodType = ZodObject, H extends ZodType = ZodObject, Q extends ZodType = ZodObject, P extends ZodType = ZodObject, R extends Record<number, ZodType> = Record<number, ZodType>>(contract: Contract<B, H, Q, P, R>) {
    return contract;
}