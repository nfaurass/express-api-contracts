import {describe, it, expect} from 'vitest';
import express from 'express';
import request from 'supertest';
import {createContract, registerContracts} from '../src';
import {z} from 'zod';

// Params validation contract
const paramsContract = createContract({
    name: "getUserById",
    path: "/users/:userId/post/:postId/comment/:commentId",
    method: "get",
    request: {
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

// Body + headers + query contract
const createUserContract = createContract({
    name: "createUser",
    path: "/users",
    method: "post",
    request: {
        body: z.object({email: z.email()}),
        query: z.object({id: z.string()}),
        headers: z.object({"api-key": z.string().min(1)}),
    },
    responses: {
        200: z.object({message: z.string()}),
        400: z.object({errors: z.array(z.any())})
    },
    handler: ({body, headers, query}) => ({
        status: 200,
        body: {message: `Email: ${body.email}, ID: ${query.id}, Key: ${headers["api-key"]}`}
    }),
});

// ---------- Tests ----------

describe('Request Validation Contracts', () => {
    const app = express();
    app.use(express.json());
    registerContracts(app, [paramsContract, createUserContract]);

    it('should return 200 and the params for valid GET /users/:userId/post/:postId/comment/:commentId', async () => {
        const res = await request(app).get('/users/3/post/10/comment/494');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({userId: 3, postId: 10, commentId: 494});
    });

    it('should coerce string params to numbers', async () => {
        const res = await request(app).get('/users/3/post/10/comment/494');
        expect(res.body.userId).toBeTypeOf('number');
    });

    it('should fail when param is not a number', async () => {
        const res = await request(app).get('/users/abc/post/10/comment/494');
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain('userId');
    });

    it('should succeed with valid body, query, and headers', async () => {
        const res = await request(app).post('/users?id=123').set('api-key', 'secret').send({email: 'test@example.com'});
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Email: test@example.com, ID: 123, Key: secret');
    });

    it('should fail with missing body', async () => {
        const res = await request(app).post('/users?id=123').set('api-key', 'secret').send({});
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain('email');
    });

    it('should fail with invalid email in body', async () => {
        const res = await request(app).post('/users?id=123').set('api-key', 'secret').send({email: 'not-an-email'});
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain('email');
    });

    it('should fail with missing header', async () => {
        const res = await request(app).post('/users?id=123').send({email: 'test@example.com'});
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain('api-key');
    });

    it('should fail with empty header', async () => {
        const res = await request(app).post('/users?id=123').set('api-key', '').send({email: 'test@example.com'});
        expect(res.status).toBe(400);
    });

    it('should fail with missing query', async () => {
        const res = await request(app).post('/users').set('api-key', 'secret').send({email: 'test@example.com'});
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toContain('id');
    });

    it('should succeed with extra unexpected fields', async () => {
        const res = await request(app).post('/users?id=123')
            .set('api-key', 'secret').send({email: 'test@example.com', extra: 'not-allowed'});
        expect(res.status).toBe(200);
    });

    it('should fail with all invalid/missing values', async () => {
        const res = await request(app).post('/users').send({});
        expect(res.status).toBe(400);
        expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
    });
});