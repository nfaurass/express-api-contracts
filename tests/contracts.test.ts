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

describe('Contract', () => {
    const app = express();
    app.use(express.json());
    registerContracts(app, [getUserContract]);

    it('should return 200 and valid response for GET /users', async () => {
        const res = await request(app).get('/users');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({id: 1, name: "Name"});
    });
});