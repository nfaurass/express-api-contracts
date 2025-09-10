import {describe, it, expect} from "vitest";
import express from "express";
import request from "supertest";
import {createContract, createMiddleware, registerContracts} from "../src";
import {z} from "zod";

// --- Middleware that always throws ---
const failingMiddleware = createMiddleware({
    name: "failingMiddleware",
    handler: () => {
        throw new Error("Middleware failure");
    },
});

// --- Middleware that calls next.error ---
const nextErrorMiddleware = createMiddleware({
    name: "nextErrorMiddleware",
    handler: ({next}) => {
        next.error(418, {error: "I'm a teapot"});
    },
});

// --- Auth Middleware for validation tests ---
const authMiddleware = createMiddleware({
    name: "authMiddleware",
    request: {
        headers: z.object({authorization: z.string()}),
    },
    handler: ({headers, next}) => {
        if (headers.authorization !== "Bearer ABC123")
            return next.error(401, {error: "Unauthorized"});
        next.success({userId: 1});
    },
});

// --- Contracts for testing errors ---
const errorRouteContract = createContract({
    name: "errorRoute",
    path: "/error",
    method: "get",
    middlewares: [failingMiddleware],
    responses: {500: z.object({error: z.string()}), 200: z.object({ok: z.boolean()})},
    handler: () => ({status: 200, body: {ok: true}}),
});

const nextErrorRouteContract = createContract({
    name: "nextErrorRoute",
    path: "/next-error",
    method: "get",
    middlewares: [nextErrorMiddleware],
    responses: {418: z.object({error: z.string()}), 200: z.object({ok: z.boolean()})},
    handler: () => ({status: 200, body: {ok: true}}),
});

const validationRouteContract = createContract({
    name: "validationRoute",
    path: "/validate",
    method: "post",
    middlewares: [authMiddleware],
    responses: {
        200: z.object({message: z.string()}),
        400: z.object({errors: z.array(z.object({path: z.string(), message: z.string()}))}),
        401: z.object({error: z.string()}),
    },
    handler: () => ({status: 200, body: {message: "Validated!"}}),
});

describe("Error Handling Contracts", () => {
    const app = express();
    app.use(express.json());
    registerContracts(app, [errorRouteContract, nextErrorRouteContract, validationRouteContract]);

    it("should return 500 when middleware throws an exception", async () => {
        const res = await request(app).get("/error");
        expect(res.status).toBe(500);
        expect(res.body.error).toContain("Middleware failure");
    });

    it("should return custom error from next.error in middleware", async () => {
        const res = await request(app).get("/next-error");
        expect(res.status).toBe(418);
        expect(res.body.error).toBe("I'm a teapot");
    });

    it("should return 400 for missing headers", async () => {
        const res = await request(app).post("/validate").send({});
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("authorization");
        expect(res.body.errors[0].message).toContain("Invalid input");
    });

    it("should return 401 for invalid authorization header", async () => {
        const res = await request(app).post("/validate").set("authorization", "Bearer WRONG").send({});
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Unauthorized");
    });

    it("should succeed with valid header", async () => {
        const res = await request(app).post("/validate").set("authorization", "Bearer ABC123").send({});
        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Validated!");
    });

    it("should handle multiple validation errors", async () => {
        const badMiddleware = createMiddleware({
            name: "multiValidation",
            request: {
                body: z.object({foo: z.string(), bar: z.number()}),
            },
            handler: ({next}) => next.success(),
        });

        const multiValidationRoute = createContract({
            name: "multiValidationRoute",
            path: "/multi-validate",
            method: "post",
            middlewares: [badMiddleware],
            responses: {200: z.object({})},
            handler: () => ({status: 200, body: {}}),
        });

        const tempApp = express();
        tempApp.use(express.json());
        registerContracts(tempApp, [multiValidationRoute]);

        const res = await request(tempApp).post("/multi-validate").send({foo: 123});
        expect(res.status).toBe(400);
        const paths = res.body.errors.map((e: any) => e.path);
        expect(paths).toContain("foo");
        expect(paths).toContain("bar");
    });

    it("should handle unexpected runtime errors in handler", async () => {
        const crashContract = createContract({
            name: "crash",
            path: "/crash",
            method: "get",
            responses: {},
            handler: () => {
                throw new Error("Handler crash");
            },
        });

        const tempApp = express();
        registerContracts(tempApp, [crashContract]);

        const res = await request(tempApp).get("/crash");
        expect(res.status).toBe(500);
        expect(res.body.error).toContain("Handler crash");
    });
});