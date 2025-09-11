import type {Contract, RequestMethod} from "../core/contract.types";
import {toJSONSchema} from "zod";
import {OpenApiMetadata} from "./openapi.types";

/** @internal Removes `$schema` property from JSON Schema */
function sanitizeSchema(schema: any) {
    const {$schema, ...rest} = schema;
    return rest;
}

/**
 * Generates an OpenAPI 3 specification from type-safe API contracts.
 *
 * @param contracts Array of API contracts created via `createContract`
 * @param metadata OpenAPI metadata (`title`, `version`, etc.)
 * @returns OpenAPI 3 specification object
 */
export function generateOpenApi<
    Contracts extends readonly Contract<any, any, any, any, any, any>[]
>(contracts: Contracts, metadata: OpenApiMetadata): unknown {
    const paths: Record<string, any> = {};

    for (const contract of contracts) {
        const method = contract.method as RequestMethod;
        const path = contract.path;

        // Generate request body schema if defined
        const requestBody = contract.request?.body
            ? {
                content: {
                    "application/json": {schema: sanitizeSchema(toJSONSchema(contract.request.body))}
                }
            }
            : undefined;

        // Collect query parameters
        const parameters: any[] = [];
        if (contract.request?.query) {
            const querySchema = contract.request.query.shape;
            for (const key in querySchema) {
                const isOptional = querySchema[key].safeParse(undefined).success;
                parameters.push({
                    name: key,
                    in: "query",
                    required: !isOptional,
                    schema: sanitizeSchema(toJSONSchema(querySchema[key]))
                });
            }
        }

        // Collect header parameters
        if (contract.request?.headers) {
            const headerSchema = contract.request.headers.shape;
            for (const key in headerSchema) {
                const isOptional = headerSchema[key].safeParse(undefined).success;
                parameters.push({
                    name: key.toLowerCase(),
                    in: "header",
                    required: !isOptional,
                    schema: sanitizeSchema(toJSONSchema(headerSchema[key]))
                });
            }
        }

        // Map responses for OpenAPI
        const responses: Record<string, any> = {};
        for (const status in contract.responses) {
            const schema = contract.responses[Number(status)];
            if (schema === null) {
                responses[status] = {
                    description: `Response ${status} (no content)`
                };
            } else {
                responses[status] = {
                    description: `Response ${status}`,
                    content: {
                        "application/json": {schema: sanitizeSchema(toJSONSchema(schema))}
                    }
                };
            }
        }

        // Assign path + method in OpenAPI paths object
        paths[path] = paths[path] || {};
        paths[path][method] = {
            summary: contract.name || undefined,
            requestBody,
            responses,
            parameters
        };
    }

    return {openapi: "3.0.3", info: metadata, paths};
}