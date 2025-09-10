import {ZodError} from "zod";
import {MiddlewareContract} from "../core/middleware";
import {NextFunction, Request, RequestHandler, Response} from "express";

export function useMiddleware<Middleware extends MiddlewareContract<any, any, any, any>>(middleware: Middleware): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        let finished = false;
        try {
            // Validate request body, headers, query
            const body = middleware.request?.body ? middleware.request.body.safeParse(req.body) : undefined;
            if (body && !body.success) throw body.error;
            const rawHeaders = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v]));
            const headers = middleware.request?.headers ? middleware.request.headers.safeParse(rawHeaders) : undefined;
            if (headers && !headers.success) throw headers.error;
            const query = middleware.request?.query ? middleware.request.query.safeParse(req.query) : undefined;
            if (query && !query.success) throw query.error;

            // Middleware Safe handler
            const safeHandler = async () => {
                try {
                    await middleware.handler({
                        body: body?.data,
                        headers: headers?.data,
                        query: query?.data,
                        context: {},
                        req,
                        res,
                        next: {
                            success: (ctx?) => {
                                try {
                                    finished = true;
                                    Object.assign(req, {middlewareContext: ctx || {}});
                                    next();
                                } catch (err) {
                                    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
                                    console.error("Middleware handler error:", errorMessage);
                                    return res.status(500).json({error: errorMessage});
                                }
                            },
                            error: (status, body) => {
                                try {
                                    finished = true;
                                    return res.status(status).json(body);
                                } catch (err) {
                                    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
                                    console.error("Middleware handler error:", errorMessage);
                                    return res.status(500).json({error: errorMessage});
                                }
                            },
                        },
                    });
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
                    console.error("Middleware handler error:", errorMessage);
                    if (!finished) return res.status(500).json({error: errorMessage});
                }
            };

            await safeHandler();

            if (!finished && !res.headersSent) next();
        } catch (err: unknown) {
            if (err instanceof ZodError) {
                finished = true;
                return res.status(400).json({
                    errors: err.issues.map(i => ({
                        path: i.path.join("."),
                        message: `Invalid input: ${i.message}`,
                    })),
                });
            }
            finished = true;
            if (!res.headersSent) {
                const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
                console.error("Middleware handler error:", errorMessage);
                return res.status(500).json({error: errorMessage});
            }
        }
    };
}