import type {$ZodIssue as ZodIssue} from "zod/v4/core";
import type {MiddlewareContract} from "../core/middleware.types";
import type {NextFunction, Request, RequestHandler, Response} from "express";
import {ZodError} from "zod";

/**
 * @internal Converts a `MiddlewareContract` into an Express-compatible request handler.
 *
 * @param middleware Middleware contract defining validation and handler
 * @returns Express `RequestHandler` function
 */
export function useMiddleware<Middleware extends MiddlewareContract<any, any, any, any>>(
    middleware: Middleware,
): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        let finished = false; // Track if middleware completed

        try {
            // Collect validation errors
            const errors: {path: string; message: string}[] = [];

            // Validate request body
            if (middleware.request?.body) {
                const bodyResult = middleware.request.body.safeParse(req.body);
                if (!bodyResult.success) {
                    errors.push(
                        ...bodyResult.error.issues.map((i: ZodIssue) => ({
                            path: `body.${i.path.join(".")}`,
                            message: i.message,
                        })),
                    );
                }
            }

            // Validate headers
            if (middleware.request?.headers) {
                const headersResult = middleware.request.headers.safeParse(req.headers);
                if (!headersResult.success) {
                    errors.push(
                        ...headersResult.error.issues.map((i: ZodIssue) => ({
                            path: `headers.${i.path.join(".")}`,
                            message: i.message,
                        })),
                    );
                }
            }

            // Validate query
            if (middleware.request?.query) {
                const queryResult = middleware.request.query.safeParse(req.query);
                if (!queryResult.success) {
                    errors.push(
                        ...queryResult.error.issues.map((i: ZodIssue) => ({
                            path: `query.${i.path.join(".")}`,
                            message: i.message,
                        })),
                    );
                }
            }

            // Return 400 if any validation errors
            if (errors.length > 0) return res.status(400).json({errors});

            // Parse validated request parts for the handler
            const body = middleware.request?.body?.safeParse(req.body)?.data;
            const headers = middleware.request?.headers?.safeParse(req.headers)?.data;
            const query = middleware.request?.query?.safeParse(req.query)?.data;

            // Wrap handler call in safe function to catch errors
            const safeHandler = async () => {
                try {
                    await middleware.handler({
                        body,
                        headers,
                        query,
                        context: (req as any).context ?? {},
                        req,
                        res,
                        next: {
                            /** Call to proceed with request; optionally extend context */
                            success: (ctx?) => {
                                try {
                                    finished = true;
                                    (req as any).context = {
                                        ...(req as any).context,
                                        ...(ctx || {}),
                                    };
                                    next();
                                } catch (err) {
                                    const errorMessage =
                                        err instanceof Error
                                            ? err.message
                                            : "Internal Server Error";
                                    console.error("Middleware handler error:", errorMessage);
                                    return res.status(500).json({error: errorMessage});
                                }
                            },
                            /** Call to terminate request with a specific status and body */
                            error: (status, body) => {
                                try {
                                    finished = true;
                                    return res.status(status).json(body);
                                } catch (err) {
                                    const errorMessage =
                                        err instanceof Error
                                            ? err.message
                                            : "Internal Server Error";
                                    console.error("Middleware handler error:", errorMessage);
                                    return res.status(500).json({error: errorMessage});
                                }
                            },
                        },
                    });
                } catch (err: unknown) {
                    const errorMessage =
                        err instanceof Error ? err.message : "Internal Server Error";
                    console.error("Middleware handler error:", errorMessage);
                    if (!finished) return res.status(500).json({error: errorMessage});
                }
            };

            await safeHandler();

            // If handler did not call next.success/error and response not sent, proceed
            if (!finished && !res.headersSent) next();
        } catch (err: unknown) {
            // Handle Zod validation errors globally
            if (err instanceof ZodError) {
                finished = true;
                return res.status(400).json({
                    errors: err.issues.map((i) => ({
                        path: i.path.join("."),
                        message: `Invalid input: ${i.message}`,
                    })),
                });
            }

            // Handle generic errors
            finished = true;
            if (!res.headersSent) {
                const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
                console.error("Middleware handler error:", errorMessage);
                return res.status(500).json({error: errorMessage});
            }
        }
    };
}
