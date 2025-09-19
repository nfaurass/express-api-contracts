import type {$ZodIssue as ZodIssue} from "zod/v4/core";
import type {Express, Request, Response} from "express";
import type {Contract, RequestMethod} from "../core/contract.types";
import {ZodError} from "zod";
import {useMiddleware} from "./useMiddleware.js";

/** @internal Tracks registered contracts per Express app instance to prevent duplicates */
const registeredContractsMap = new WeakMap<Express, Set<string>>();

/**
 * Registers one or multiple API contracts on an Express application.
 *
 * @param app Express application instance
 * @param contracts Array of contracts to register
 */
export function registerContracts<Contracts extends readonly Contract<any, any, any, any, any>[]>(
    app: Express,
    contracts: Contracts,
) {
    // Retrieve or initialize the set of already registered routes for this app
    let registered = registeredContractsMap.get(app);
    if (!registered) {
        registered = new Set<string>();
        registeredContractsMap.set(app, registered);
    }

    for (const contract of contracts) {
        const key = `${contract.method}:${contract.path}`;

        // Skip duplicate registrations
        if (registered.has(key)) {
            console.warn(
                `[Warning] Contract already registered for [${contract.method}] ${contract.path}. Skipping duplicate.`,
            );
            continue;
        }
        registered.add(key);

        // Convert middlewares into Express-compatible middleware functions
        const middlewares = contract.middlewares?.map(useMiddleware) ?? [];

        // Cast method to lowercase string for Express routing
        const method = contract.method.toLowerCase() as RequestMethod;

        // Register route with Express
        (app as any)[method](
            contract.path,
            ...(middlewares || []),
            async (req: Request, res: Response) => {
                try {
                    // Collect all validation errors
                    const errors: {path: string; message: string}[] = [];

                    // Validate request body if schema is defined
                    if (contract.request?.body) {
                        const bodyResult = contract.request.body.safeParse(req.body);
                        if (!bodyResult.success) {
                            errors.push(
                                ...bodyResult.error.issues.map((i: ZodIssue) => ({
                                    path: `body.${i.path.join(".")}`,
                                    message: i.message,
                                })),
                            );
                        }
                    }

                    // Validate request headers if schema is defined
                    if (contract.request?.headers) {
                        const headersResult = contract.request.headers.safeParse(req.headers);
                        if (!headersResult.success) {
                            errors.push(
                                ...headersResult.error.issues.map((i: ZodIssue) => ({
                                    path: `headers.${i.path.join(".")}`,
                                    message: i.message,
                                })),
                            );
                        }
                    }

                    // Validate query parameters if schema is defined
                    if (contract.request?.query) {
                        const queryResult = contract.request.query.safeParse(req.query);
                        if (!queryResult.success) {
                            errors.push(
                                ...queryResult.error.issues.map((i: ZodIssue) => ({
                                    path: `query.${i.path.join(".")}`,
                                    message: i.message,
                                })),
                            );
                        }
                    }

                    // Validate route params if schema is defined
                    if (contract.request?.params) {
                        const paramsResult = contract.request.params.safeParse(req.params);
                        if (!paramsResult.success) {
                            errors.push(
                                ...paramsResult.error.issues.map((i: ZodIssue) => ({
                                    path: `params.${i.path.join(".")}`,
                                    message: i.message,
                                })),
                            );
                        }
                    }

                    // Return 400 with all validation errors if any
                    if (errors.length > 0) return res.status(400).json({errors});

                    // Parse request parts based on schemas for handler
                    const body = contract.request?.body?.safeParse(req.body)?.data;
                    const headers = contract.request?.headers?.safeParse(req.headers)?.data;
                    const query = contract.request?.query?.safeParse(req.query)?.data;
                    const params = contract.request?.params?.safeParse(req.params)?.data;

                    // Call the handler function with typed arguments
                    const result = await contract.handler({
                        body,
                        headers,
                        query,
                        params,
                        req,
                        res,
                        context: (req as any).context ?? {},
                    });

                    // Ensure the handler returned a valid response object with a status code
                    if (!result || !result.status)
                        throw new Error(
                            "Handler did not return a valid response object with 'status'",
                        );

                    // Get the response schema for this status code
                    const schema = contract.responses[result.status];
                    if (schema === undefined)
                        throw new Error(`No schema defined for status ${result.status}`);

                    // Handle responses with no body
                    if (schema === null) {
                        if ("body" in result && result.body !== undefined)
                            throw new Error(
                                `Response must not include a body for status ${result.status}`,
                            );
                        return res.sendStatus(result.status);
                    }

                    // Ensure body exists for responses expecting one
                    if (!("body" in result))
                        throw new Error(`Response for status ${result.status} must include a body`);

                    // Validate response body against schema
                    const validatedBody = schema.safeParse(result.body);

                    // Return 500 if response validation fails
                    if (validatedBody && !validatedBody.success) {
                        return res.status(500).json({
                            errors: validatedBody.error.issues.map((i: ZodIssue) => ({
                                path: `response.${i.path.join(".")}`,
                                message: i.message,
                            })),
                        });
                    }

                    // Send successful response
                    return res.status(result.status).json(validatedBody?.data || {});
                } catch (err: unknown) {
                    // Handle Zod validation errors globally
                    if (err instanceof ZodError)
                        return res.status(500).json({
                            errors: err.issues.map((i: ZodIssue) => ({
                                path: i.path.join("."),
                                message: i.message,
                            })),
                        });

                    // Handle generic errors
                    return res
                        .status(500)
                        .json({error: err instanceof Error ? err.message : String(err)});
                }
            },
        );
    }
}
