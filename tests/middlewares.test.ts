import {describe, it, expect} from "vitest";
import express from "express";
import request from "supertest";
import {createContract, registerContracts, createMiddleware} from "../src";
import {z} from "zod";

// Auth middleware
const authMiddlewareContract = createMiddleware({
    name: "authMiddleware",
    request: {
        headers: z.object({
            authorization: z.string(),
        }),
    },
    handler: ({headers, next}) => {
        if (headers.authorization !== "Bearer ABC123") return next.error(401, {error: "Unauthorized"});
        next.success({userId: 1});
    },
});

// Logger middleware (simplified, just passes request along)
const loggerMiddlewareContract = createMiddleware({
    name: "loggerMiddleware",
    handler: ({req, next, res}) => {
        console.log(`(${new Date().toISOString()}) [${req.method.toUpperCase()} - ${res.statusCode}] ${req.path}`);
        next.success()
    },
});

// Protected route
const getProfileContract = createContract({
    name: "getProfile",
    path: "/profile",
    method: "get",
    middlewares: [loggerMiddlewareContract, authMiddlewareContract],
    responses: {
        200: z.object({id: z.number(), name: z.string()}),
        401: z.object({error: z.string()}),
        400: z.object({errors: z.array(z.any())}),
    },
    handler: () => ({status: 200, body: {id: 1, name: "Alice"}}),
});

// Public route
const publicInfoContract = createContract({
    name: "getPublicInfo",
    path: "/info",
    method: "get",
    responses: {
        200: z.object({message: z.string()}),
    },
    handler: () => ({status: 200, body: {message: "This route is public"}}),
});

describe("Middleware Contracts", () => {
    const app = express();
    app.use(express.json());
    registerContracts(app, [getProfileContract, publicInfoContract]);

    it("blocks access without authorization header", async () => {
        const res = await request(app).get("/profile");
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain("authorization");
    });

    it("blocks access with invalid token", async () => {
        const res = await request(app)
            .get("/profile")
            .set("authorization", "Bearer WRONG");
        expect(res.status).toBe(401);
        expect(res.body).toEqual({error: "Unauthorized"});
    });

    it("allows access with valid token", async () => {
        const res = await request(app)
            .get("/profile")
            .set("authorization", "Bearer ABC123");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({id: 1, name: "Alice"});
    });

    it("allows public access without authorization", async () => {
        const res = await request(app).get("/info");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({message: "This route is public"});
    });

    it("ignores unrelated headers on public route", async () => {
        const res = await request(app)
            .get("/info")
            .set("x-random", "value");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({message: "This route is public"});
    });

    it("handles middleware errors gracefully", async () => {
        const brokenMiddleware = createMiddleware({
            name: "brokenMiddleware",
            handler: () => {
                throw new Error("Error coming from the middleware");
            },
        });

        const errorContract = createContract({
            name: "errorRoute",
            path: "/error",
            method: "get",
            middlewares: [brokenMiddleware],
            responses: {
                500: z.object({error: z.string()}),
                200: z.object({ok: z.boolean()})
            },
            handler: () => ({status: 200, body: {ok: true}}),
        });

        const tempApp = express();
        tempApp.use(express.json());
        registerContracts(tempApp, [errorContract]);

        const res = await request(tempApp).get("/error");
        expect(res.status).toBe(500);
        expect(res.body.error).toContain("Error coming from the middleware");
    });
});