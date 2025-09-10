import {Express, Request, Response} from "express";
import {Contract, RequestMethod} from "../core/contract";
import {ZodError, ZodIssue} from 'zod';
import {useMiddleware} from "./use";

const registeredContractsMap = new WeakMap<Express, Set<string>>();

export function registerContracts<Contracts extends readonly Contract<any, any, any, any, any>[]>(app: Express, contracts: Contracts) {
    // Track registered routes
    let registered = registeredContractsMap.get(app);
    if (!registered) {
        registered = new Set<string>();
        registeredContractsMap.set(app, registered);
    }

    for (const contract of contracts) {
        const key = `${contract.method}:${contract.path}`;
        if (registered.has(key)) {
            console.warn(`[Warning] Contract already registered for [${contract.method}] ${contract.path}. Skipping duplicate.`);
            continue;
        }
        registered.add(key);

        const middlewares = contract.middlewares?.map(useMiddleware) ?? [];

        const method = contract.method.toLowerCase() as RequestMethod;
        (app as any)[method](contract.path, ...(middlewares || []), async (req: Request, res: Response) => {
            try {
                // Track errors
                const errors: { path: string; message: string }[] = [];

                // Validate request
                // Body
                if (contract.request?.body) {
                    const bodyResult = contract.request.body.safeParse(req.body);
                    if (!bodyResult.success) {
                        errors.push(...bodyResult.error.issues.map((i: ZodIssue) => ({
                            path: `body.${i.path.join(".")}`,
                            message: i.message
                        })));
                    }
                }
                // Headers
                if (contract.request?.headers) {
                    const headersResult = contract.request.headers.safeParse(req.headers);
                    if (!headersResult.success) {
                        errors.push(...headersResult.error.issues.map((i: ZodIssue) => ({
                            path: `headers.${i.path.join(".")}`,
                            message: i.message
                        })));
                    }
                }
                // Query
                if (contract.request?.query) {
                    const queryResult = contract.request.query.safeParse(req.query);
                    if (!queryResult.success) {
                        errors.push(...queryResult.error.issues.map((i: ZodIssue) => ({
                            path: `query.${i.path.join(".")}`,
                            message: i.message
                        })));
                    }
                }
                // Params
                if (contract.request?.params) {
                    const paramsResult = contract.request.params.safeParse(req.params);
                    if (!paramsResult.success) {
                        errors.push(...paramsResult.error.issues.map((i: ZodIssue) => ({
                            path: `params.${i.path.join(".")}`,
                            message: i.message
                        })));
                    }
                }

                // Throw on errors
                if (errors.length > 0) {
                    return res.status(400).json({errors});
                }

                // Call handler
                const body = contract.request?.body?.safeParse(req.body)?.data;
                const headers = contract.request?.headers?.safeParse(req.headers)?.data;
                const query = contract.request?.query?.safeParse(req.query)?.data;
                const params = contract.request?.params?.safeParse(req.params)?.data;
                const result = await contract.handler({
                    body,
                    headers,
                    query,
                    params,
                    req,
                    res,
                    context: (req as any).context ?? {}
                });
                if (!result || !result.status) throw new Error("Handler did not return a valid response object with 'status'");

                // Validate response
                const schema = contract.responses[result.status];

                if (schema === undefined) throw new Error(`No schema defined for status ${result.status}`);

                if (schema === null) {
                    if ("body" in result && result.body !== undefined) throw new Error(`Response must not include a body for status ${result.status}`);
                    return res.sendStatus(result.status);
                }

                if (!("body" in result)) throw new Error(`Response for status ${result.status} must include a body`);

                const validatedBody = schema.safeParse(result.body);

                if (validatedBody && !validatedBody.success) {
                    return res.status(500).json({
                        errors: validatedBody.error.issues.map((i: ZodIssue) => ({
                            path: `response.${i.path.join(".")}`,
                            message: i.message
                        }))
                    });
                }

                return res.status(result.status).json(validatedBody?.data || {});
            } catch (err: unknown) {
                // Return validation or handler errors
                if (err instanceof ZodError) return res.status(500).json({
                    errors: err.issues.map((i: ZodIssue) => ({
                        path: i.path.join("."),
                        message: i.message
                    }))
                });
                return res.status(500).json({error: err instanceof Error ? err.message : String(err)});
            }
        });
    }
}