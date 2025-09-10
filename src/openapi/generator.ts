import {Contract, RequestMethod} from "../core/contract";
import {toJSONSchema} from "zod";

// OpenAPI Metadata for OpenAPI `info` object
export type OpenApiMetadata = {
    title: string;
    version: string;
    description?: string;
    summary?: string;
    termsOfService?: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string };
};

// Utility Function to remove `$schema` key from JSON Schema
function sanitizeSchema(schema: any) {
    const {$schema, ...rest} = schema;
    return rest;
}

// OpenAPI Generator
export function generateOpenApi<Contracts extends readonly Contract<any, any, any, any, any, any>[]>(contracts: Contracts, metadata: OpenApiMetadata): unknown {
    const paths: Record<string, any> = {};

    for (const contract of contracts) {
        const method = contract.method as RequestMethod;
        const path = contract.path;

        // Request body schema
        const requestBody = contract.request?.body ? {content: {"application/json": {schema: sanitizeSchema(toJSONSchema(contract.request.body))}}} : undefined;

        // Query parameters
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
        // Header parameters
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

        // Responses
        const responses: Record<string, any> = {};
        for (const status in contract.responses) {
            const schema = contract.responses[Number(status)];
            if (schema === null) {
                responses[status] = {
                    description: `Response ${status} (no content)`,
                };
            } else {
                responses[status] = {
                    description: `Response ${status}`,
                    content: {"application/json": {schema: sanitizeSchema(toJSONSchema(schema))}}
                };
            }
        }

        // Assign path + method
        paths[path] = paths[path] || {};
        paths[path][method] = {summary: contract.name || undefined, requestBody, responses, parameters};
    }

    return {openapi: "3.0.3", info: metadata, paths};
}