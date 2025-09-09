import {describe, it, expect} from "vitest";
import express from "express";
import request from "supertest";
import {createContract, registerContracts, createMiddleware} from "../src";
import {z} from "zod";

const authMiddlewareContract = createMiddleware({
    name: "authMiddleware",
    request: {
        headers: z.object({
            authorization: z.string(),
        }),
    },
    handler: ({headers, next}) => {
        if (!headers || headers.authorization !== "Bearer ABC123") return next.error(401, {error: "Unauthorized"});
        next.success({userId: 1});
    },
});

const loggerMiddlewareContract = createMiddleware({
    name: "loggerMiddleware",
    handler: ({req}) => {
        console.log(`[${new Date().toISOString()}] ${req.path}`);
    },
});

const getProfileContract = createContract({
    name: "getProfile",
    path: "/profile",
    method: "get",
    middlewares: [loggerMiddlewareContract, authMiddlewareContract],
    request: {
        headers: z.object({
            authorization: z.string()
        })
    },
    responses: {
        200: z.object({id: z.number(), name: z.string()}),
        401: z.object({error: z.string()}),
    },
    handler: () => {
        return {status: 200, body: {id: 1, name: "Alice"}};
    },
});

const publicInfoContract = createContract({
    name: "getPublicInfo",
    path: "/info",
    method: "get",
    responses: {
        200: z.object({message: z.string()}),
    },
    handler: () => {
        return {status: 200, body: {message: "This route is public"}};
    },
});

describe("Middleware Contracts", () => {
    const app = express();
    app.use(express.json());

    registerContracts(app, [getProfileContract, publicInfoContract]);

    it("should block unauthorized access to /profile", async () => {
        const res = await request(app).get("/profile");
        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            "errors": [{
                "message": "Invalid input: expected string, received undefined",
                "path": "authorization"
            },]
        });
    });

    it("should allow authorized access to /profile", async () => {
        const res = await request(app).get("/profile").set("authorization", "Bearer ABC123");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({id: 1, name: "Alice"});
    });

    it("should allow public access to /info", async () => {
        const res = await request(app).get("/info");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({message: "This route is public"});
    });
});