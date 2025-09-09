import {Express, Request, RequestHandler, Response} from "express";
import {Contract, RequestMethod} from "../core/contract";
import {ZodError} from 'zod';
import {useMiddleware} from "./use";

const registeredContractsMap = new WeakMap<Express, Set<string>>();

export function registerContracts<Contracts extends readonly Contract<any, any, any, any>[]>(app: Express, contracts: Contracts) {
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
                // Validate request body, headers, and query
                const body = contract.request?.body ? contract.request.body.safeParse(req.body) : undefined;
                if (body && !body.success) throw body.error;
                const headers = contract.request?.headers ? contract.request.headers.safeParse(req.headers) : undefined;
                if (headers && !headers.success) throw headers.error;
                const query = contract.request?.query ? contract.request.query.safeParse(req.query) : undefined;
                if (query && !query.success) throw query.error;

                // Call handler
                const result = await contract.handler({body: body?.data, headers: headers?.data, query: query?.data});
                if (!result || !result.status) throw new Error("Handler did not return a valid response object with 'status'");

                // Validate response
                const schema = contract.responses[result.status];
                if (!schema) throw new Error(`No schema defined for status ${result.status}`);
                const validatedBody = schema.safeParse(result.body);
                if (validatedBody && !validatedBody.success) throw validatedBody.error;

                return res.status(result.status).json(validatedBody?.data || {});
            } catch (err: unknown) {
                // Return validation or handler errors
                if (err instanceof ZodError) return res.status(400).json({
                    errors: err.issues.map(i => ({
                        path: i.path.join("."),
                        message: i.message
                    }))
                });
                return res.status(400).json({error: err instanceof Error ? err.message : String(err)});
            }
        });
    }
}