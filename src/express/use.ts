import {ZodError} from "zod";
import {MiddlewareContract} from "../core/middleware";
import {NextFunction, Request, RequestHandler, Response} from "express";

export function useMiddleware<Middleware extends MiddlewareContract<any, any, any, any>>(middleware: Middleware): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate request body, headers, query
            const body = middleware.request?.body ? middleware.request.body.safeParse(req.body) : undefined;
            if (body && !body.success) throw body.error;
            const headers = middleware.request?.headers ? middleware.request.headers.safeParse(req.headers) : undefined;
            if (headers && !headers.success) throw headers.error;
            const query = middleware.request?.query ? middleware.request.query.safeParse(req.query) : undefined;
            if (query && !query.success) throw query.error;

            // Middleware handler
            let finished = false;
            await middleware.handler({
                body: body?.data,
                headers: headers?.data,
                query: query?.data,
                context: {},
                req,
                next: {
                    success: (ctx?) => {
                        finished = true;
                        Object.assign(req, {middlewareContext: ctx || {}});
                        next();
                    },
                    error: (status, body) => {
                        finished = true;
                        res.status(status).json(body);
                    },
                },
            });
            if (!finished) next();
        } catch (err: unknown) {
            if (err instanceof ZodError) {
                return res.status(400).json({
                    errors: err.issues.map(i => ({
                        path: i.path.join("."),
                        message: i.message
                    }))
                });
            }
            next(err);
        }
    };
}