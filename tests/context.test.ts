import {describe, it, expect} from "vitest";
import express from "express";
import request from "supertest";
import {createContract, registerContracts, createMiddleware} from "../src";
import {z} from "zod";

// Auth middleware
const authMiddlewareContract = createMiddleware({
    name: "authMiddleware",
    provides: z.object({
        username: z.string(),
    }),
    handler: ({req, next}) => {
        const auth = req.headers["authorization"];
        if (!auth) return next.error(400, {message: "Missing authorization header"});
        if (auth !== "Bearer valid-token") return next.error(401, {message: "Unauthorized"});
        next.success({username: "nidal"});
    },
});

// DOB middleware
const dobMiddlewareContract = createMiddleware({
    name: "dobMiddleware",
    provides: z.object({
        dob: z.string(),
    }),
    handler: ({next}) => {
        next.success({dob: "2003"});
    },
});

// IP middleware
const ipMiddlewareContract = createMiddleware({
    name: "ipMiddleware",
    provides: z.object({
        ip: z.string(),
    }),
    handler: ({req, next}) => {
        const ip = req.ip || "127.0.0.1";
        next.success({ip});
    },
});

// Protected route
const getProfileContract = createContract({
    name: "getProfile",
    path: "/profile",
    method: "get",
    middlewares: [authMiddlewareContract, dobMiddlewareContract, ipMiddlewareContract],
    responses: {
        200: z.object({id: z.number(), name: z.string(), dob: z.string(), ip: z.string()}),
        400: z.object({message: z.string()}),
        401: z.object({message: z.string()}),
    },
    handler: ({context}) => ({
        status: 200,
        body: {id: 1, name: context.username, dob: context.dob, ip: context.ip},
    }),
});

// Middleware conflict contract
const conflictMiddlewareContract = createMiddleware({
    name: "conflictMiddleware",
    provides: z.object({
        username: z.string(),
    }),
    handler: ({next}) => {
        next.success({username: "overridden"});
    },
});

const conflictContract = createContract({
    name: "conflictProfile",
    path: "/conflict",
    method: "get",
    middlewares: [authMiddlewareContract, conflictMiddlewareContract],
    responses: {
        200: z.object({name: z.string()}),
        400: z.object({message: z.string()}),
        401: z.object({message: z.string()}),
    },
    handler: ({context}) => ({
        status: 200,
        body: {name: context.username},
    }),
});

describe("Middleware Contracts", () => {
    const app = express();
    app.use(express.json());
    registerContracts(app, [getProfileContract, conflictContract]);

    it("should fail with 400 if authorization header is missing", async () => {
        const res = await request(app).get("/profile");
        expect(res.status).toBe(400);
        expect(res.body.message).toContain("Missing authorization header");
    });

    it("should fail with 401 if authorization header is invalid", async () => {
        const res = await request(app).get("/profile").set("authorization", "Bearer invalid");
        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Unauthorized");
    });

    it("should succeed with valid authorization header", async () => {
        const res = await request(app).get("/profile").set("authorization", "Bearer valid-token");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({id: 1, name: "nidal", dob: "2003"});
        expect(typeof res.body.ip).toBe("string");
    });

    it("should respect middleware order and allow context overrides", async () => {
        const res = await request(app).get("/conflict").set("authorization", "Bearer valid-token");
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("overridden");
    });

    it("should propagate middleware errors correctly", async () => {
        const failingDobMiddleware = createMiddleware({
            name: "failingDob",
            provides: z.object({dob: z.string()}),
            handler: ({next}) => {
                next.error(400, {message: "DOB middleware failed"});
            },
        });

        const tempContract = createContract({
            name: "temp",
            path: "/temp",
            method: "get",
            middlewares: [authMiddlewareContract, failingDobMiddleware],
            responses: {
                200: z.object({dob: z.string()}),
                400: z.object({message: z.string()}),
            },
            handler: ({context}) => ({
                status: 200,
                body: {dob: context.dob},
            }),
        });

        const app2 = express();
        app2.use(express.json());
        registerContracts(app2, [tempContract]);

        const res = await request(app2).get("/temp").set("authorization", "Bearer valid-token");
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("DOB middleware failed");
    });
});