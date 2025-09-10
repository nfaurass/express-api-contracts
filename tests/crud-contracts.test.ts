import {describe, it, expect} from 'vitest';
import express from 'express';
import request from 'supertest';
import {createContract, registerContracts} from '../src';
import {z} from 'zod';

// In-memory "database"
const users: { id: number; name: string; email: string }[] = [
    {id: 1, name: 'Alice', email: 'alice@example.com'},
    {id: 2, name: 'Bob', email: 'bob@example.com'},
];

// GET /users
const listUsersContract = createContract({
    name: 'listUsers',
    path: '/users',
    method: 'get',
    responses: {
        200: z.array(z.object({id: z.number(), name: z.string(), email: z.email()})),
    },
    handler: async () => ({status: 200, body: users}),
});

// GET /users/:id
const getUserContract = createContract({
    name: 'getUserById',
    path: '/users/:id',
    method: 'get',
    request: {
        params: z.object({id: z.coerce.number()}),
    },
    responses: {
        200: z.object({id: z.number(), name: z.string(), email: z.email()}),
        404: z.object({error: z.string()}),
    },
    handler: async ({params}) => {
        const user = users.find(u => u.id === params.id);
        if (!user) return {status: 404, body: {error: 'User not found'}};
        return {status: 200, body: user};
    },
});

// POST /users
const createUserContract = createContract({
    name: 'createUser',
    path: '/users',
    method: 'post',
    request: {
        body: z.object({name: z.string(), email: z.email()}),
    },
    responses: {
        201: z.object({id: z.number(), name: z.string(), email: z.email()}),
    },
    handler: async ({body}) => {
        const newUser = {id: users.length + 1, ...body};
        users.push(newUser);
        return {status: 201, body: newUser};
    },
});

// PUT /users/:id
const updateUserContract = createContract({
    name: 'updateUser',
    path: '/users/:id',
    method: 'put',
    request: {
        params: z.object({id: z.coerce.number()}),
        body: z.object({name: z.string().optional(), email: z.email().optional()}),
    },
    responses: {
        200: z.object({id: z.number(), name: z.string(), email: z.email()}),
        404: z.object({error: z.string()}),
    },
    handler: async ({params, body}) => {
        const user = users.find(u => u.id === params.id);
        if (!user) return {status: 404, body: {error: 'User not found'}};
        Object.assign(user, body);
        return {status: 200, body: user};
    },
});

// DELETE /users/:id
const deleteUserContract = createContract({
    name: 'deleteUser',
    path: '/users/:id',
    method: 'delete',
    request: {
        params: z.object({id: z.coerce.number()}),
    },
    responses: {
        204: z.object(),
        404: z.object({error: z.string()}),
    },
    handler: async ({params}) => {
        const index = users.findIndex(u => u.id === params.id);
        if (index === -1) return {status: 404, body: {error: 'User not found'}};
        users.splice(index, 1);
        return {status: 204, body: {}};
    },
});

describe('User CRUD Contracts', () => {
    const app = express();
    app.use(express.json());
    registerContracts(app, [listUsersContract, getUserContract, createUserContract, updateUserContract, deleteUserContract]);

    it('should list all users', async () => {
        const res = await request(app).get('/users');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('should get a single user by id', async () => {
        const res = await request(app).get('/users/1');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Alice');
    });

    it('should return 404 for non-existent user', async () => {
        const res = await request(app).get('/users/999');
        expect(res.status).toBe(404);
    });

    it('should create a new user', async () => {
        const res = await request(app).post('/users').send({name: 'Charlie', email: 'charlie@example.com'});
        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Charlie');
    });

    it('should update an existing user', async () => {
        const res = await request(app).put('/users/1').send({name: 'Alice Updated'});
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Alice Updated');
    });

    it('should return 404 when updating non-existent user', async () => {
        const res = await request(app).put('/users/999').send({name: 'No One'});
        expect(res.status).toBe(404);
    });

    it('should delete an existing user', async () => {
        const res = await request(app).delete('/users/2');
        expect(res.status).toBe(204);
    });

    it('should return 404 when deleting non-existent user', async () => {
        const res = await request(app).delete('/users/999');
        expect(res.status).toBe(404);
    });
});