import {describe, it, expect} from "vitest";
import {z} from "zod";
import {createContract, createMiddleware, generateOpenApi} from "../src";

// Example middlewares
const authMiddleware = createMiddleware({
    name: "authMiddleware",
    provides: z.object({userId: z.number()}),
    handler: ({next}) => {
        next.success({userId: 123});
    },
});

// Contracts
const createUserContract = createContract({
    name: "createUser",
    path: "/users",
    method: "post",
    middlewares: [authMiddleware],
    request: {
        body: z.object({
            name: z.string(),
            email: z.email(),
        }),
        headers: z.object({
            authorization: z.string(),
        }),
    },
    responses: {
        201: z.object({id: z.number(), name: z.string(), email: z.email()}),
        400: z.object({error: z.string()}),
    },
    handler: ({body}) => ({
        status: 201,
        body: {id: 1, ...body},
    }),
});

const listUsersContract = createContract({
    name: "listUsers",
    path: "/users",
    method: "get",
    request: {
        query: z.object({
            limit: z.number().int().optional(),
            offset: z.number().int().optional(),
        }),
    },
    responses: {
        200: z.array(z.object({id: z.number(), name: z.string(), email: z.email()})),
        204: null,
    },
    handler: ({query}) => ({
        status: 200,
        body: [{id: 1, name: "Alice", email: "alice@example.com"}],
    }),
});

const getUserContract = createContract({
    name: "getUser",
    path: "/users/:id",
    method: "get",
    request: {
        params: z.object({id: z.string()}),
    },
    responses: {
        200: z.object({id: z.number(), name: z.string()}),
        404: z.object({error: z.string()}),
    },
    handler: ({params}) => ({
        status: 200,
        body: {id: Number(params.id), name: "Alice"},
    }),
});

describe("generateOpenApi", () => {
    it("should generate a valid OpenAPI spec with multiple contracts", () => {
        const metadata = {
            title: "User API",
            version: "1.0.0",
            description: "API for managing users",
            contact: {name: "Support", email: "support@example.com"},
            license: {name: "MIT", url: "https://opensource.org/licenses/MIT"},
        };

        const spec = generateOpenApi([createUserContract, listUsersContract, getUserContract], metadata);

        // Top-level structure
        expect(spec).toHaveProperty("openapi", "3.0.3");
        expect(spec).toHaveProperty("info.title", "User API");
        expect(spec).toHaveProperty("paths");

        // Check POST /users
        const postUsers = (spec as any).paths["/users"].post;
        expect(postUsers.summary).toBe("createUser");
        expect(postUsers.requestBody.content["application/json"].schema).toHaveProperty("properties.name");
        expect(postUsers.parameters.find((p: any) => p.in === "header").name).toBe("authorization");
        expect(postUsers.responses["201"]).toBeDefined();

        // Check GET /users
        const getUsers = (spec as any).paths["/users"].get;
        expect(getUsers.summary).toBe("listUsers");
        expect(getUsers.parameters.find((p: any) => p.name === "limit").required).toBe(false);
        expect(getUsers.responses["200"].content["application/json"].schema.type).toBe("array");
        expect(getUsers.responses["204"].description).toContain("no content");

        // Check GET /users/:id
        const getUser = (spec as any).paths["/users/:id"].get;
        expect(getUser.summary).toBe("getUser");
        expect(getUser.responses["404"].content["application/json"].schema).toHaveProperty("properties.error");
    });
});