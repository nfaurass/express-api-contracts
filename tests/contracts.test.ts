import {describe, it, expect} from 'vitest';
import express from 'express';
import request from 'supertest';
import {createContract} from '../src/core/contract';
import {registerContracts} from '../src/express/register';
import {z} from 'zod';

const getUserContract = createContract({
    name: "getUser",
    path: "/users",
    method: "get",
    responses: {
        200: z.object({id: z.number(), name: z.string()}),
        404: z.object({error: z.string()})
    },
    handler: async ({}) => ({status: 200, body: {id: 1, name: "Name"}})
});

const paramsContract = createContract({
    name: "getUserById",
    path: "/users/:userId/post/:postId/comment/:commentId",
    method: "get",
    request: {
        // params are strings by default
        params: z.object({
            userId: z.coerce.number(),
            postId: z.coerce.number(),
            commentId: z.coerce.number(),
        })
    },
    responses: {
        200: z.object({userId: z.number(), postId: z.number(), commentId: z.number()}),
    },
    handler: async ({params}) => ({
        status: 200,
        body: {userId: params.userId, postId: params.postId, commentId: params.commentId}
    })
});

const createUserContract = createContract({
    name: "createUser",
    path: "/users",
    method: "post",
    request: {
        body: z.object({email: z.string()}),
        query: z.object({id: z.string()}),
        headers: z.object({"api-key": z.string()}),
    },
    responses: {
        200: z.object({message: z.string()}),
        400: z.object({error: z.string()})
    },
    handler: ({body, headers, query}) => {
        return {
            status: 200, body: {message: `Email: ${body.email}, ID: ${query.id}, Key: ${headers["api-key"]}`}
        };
    },
});

describe('Contract', () => {
    const app = express();
    app.use(express.json());
    registerContracts(app, [getUserContract, createUserContract, paramsContract]);

    it('should return 200 and the params for GET /users/3/post/10/comment/494', async () => {
        const res = await request(app).get('/users/3/post/10/comment/494');
        console.log(res.body);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({userId: 3, postId: 10, commentId: 494});
    });

    it('should return 200 and valid response for GET /users', async () => {
        const res = await request(app).get('/users');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({id: 1, name: "Name"});
    });

    it('should validate body, query, and headers correctly', async () => {
        const res = await request(app).post('/users?id=123').set('api-key', 'my-secret-key').send({email: 'users@example.com'});
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'Email: users@example.com, ID: 123, Key: my-secret-key'
        });
    });

    it('should fail with missing body', async () => {
        const res = await request(app).post('/users?id=123').set('api-key', 'my-secret-key').send({});
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain('email');
    });

    it('should fail with missing header', async () => {
        const res = await request(app).post('/users?id=123').send({email: 'users@example.com'});
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain('api-key');
    });

    it('should fail with missing query', async () => {
        const res = await request(app).post('/users').set('api-key', 'my-secret-key').send({email: 'users@example.com'});
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain('id');
    });
});