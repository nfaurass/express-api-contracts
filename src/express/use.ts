import {ZodError, ZodIssue} from "zod";
import {MiddlewareContract} from "../core/middleware";
import {NextFunction, Request, RequestHandler, Response} from "express";

export function useMiddleware<Middleware extends MiddlewareContract<any, any, any, any>>(middleware: Middleware): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        let finished = false;
        try {
            // Track errors
            const errors: { path: string; message: string }[] = [];

            // Validate request
            // Body
            if (middleware.request?.body) {
                const bodyResult = middleware.request.body.safeParse(req.body);
                if (!bodyResult.success) {
                    errors.push(...bodyResult.error.issues.map((i: ZodIssue) => ({
                        path: `body.${i.path.join(".")}`,
                        message: i.message
                    })));
                }
            }
            // Headers
            if (middleware.request?.headers) {
                const headersResult = middleware.request.headers.safeParse(req.headers);
                if (!headersResult.success) {
                    errors.push(...headersResult.error.issues.map((i: ZodIssue) => ({
                        path: `headers.${i.path.join(".")}`,
                        message: i.message
                    })));
                }
            }
            // Query
            if (middleware.request?.query) {
                const queryResult = middleware.request.query.safeParse(req.query);
                if (!queryResult.success) {
                    errors.push(...queryResult.error.issues.map((i: ZodIssue) => ({
                        path: `query.${i.path.join(".")}`,
                        message: i.message
                    })));
                }
            }

            // Throw on errors
            if (errors.length > 0) {
                return res.status(400).json({errors});
            }
            
            const body = middleware.request?.body?.safeParse(req.body)?.data;
            const headers = middleware.request?.headers?.safeParse(req.headers)?.data;
            const query = middleware.request?.query?.safeParse(req.query)?.data;
            const safeHandler = async () => {
                try {
                    await middleware.handler({
                        body: body,
                        headers: headers,
                        query: query,
                        context: (req as any).context ?? {},
                        req,
                        res,
                        next: {
                            success: (ctx?) => {
                                try {
                                    finished = true;
                                    (req as any).context = {...(req as any).context, ...(ctx || {})};
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