import express from "express";
import {z} from "zod";
import {
    createContract,
    createMiddleware,
    registerContracts,
    generateOpenApi,
} from "express-api-contracts";

// in-memory user store
const users = new Map<number, { id: number; email: string; name: string }>();
users.set(1, {id: 1, name: "Full Name", email: "email@example.com"});

// shared Zod schemas
const Email = z.email();
const Name = z.string().min(2);
const IdParam = z.object({
    id: z.coerce.number(),
});
const PaginationQuery = z.object({
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
});

// auth middleware (validates Authorization header and provides userId)
const authMiddleware = createMiddleware({
    name: "auth",
    request: {headers: z.object({authorization: z.string()})},
    provides: z.object({userId: z.number()}),
    handler: ({headers, next}) => {
        const token = headers.authorization.replace(/^Bearer\s*/i, "");
        if (token === "valid") return next.success({userId: 1});
        return next.error(401, {message: "Invalid token"});
    },
});

// CONTRACT 1: Create user
const CreateUser = createContract({
    name: "CreateUser",
    path: "/users",
    method: "post",
    request: {
        body: z.object({email: Email, name: Name}),
    },
    responses: {
        201: z.object({id: z.number(), email: z.email(), name: z.string()}),
        400: z.object({error: z.string()}),
    },
    handler: async ({body}) => {
        if (Array.from(users.values()).some((u) => u.email === body.email)) return {
            status: 400,
            body: {error: "Email exists"},
        };
        const id = Math.random();
        const user = {id, email: body.email, name: body.name};
        users.set(id, user);
        return {status: 201, body: user};
    },
});

// CONTRACT 2: List users with pagination
const ListUsers = createContract({
    name: "ListUsers",
    path: "/users",
    method: "get",
    request: {query: PaginationQuery},
    responses: {
        200: z.object({
            items: z.array(
                z.object({id: z.number(), email: z.email(), name: z.string()}),
            ),
            total: z.number(),
            meta: z.object({limit: z.number(), offset: z.number()}),
        }),
    },
    handler: async ({query}) => {
        const limit = query.limit ?? 10;
        const offset = query.offset ?? 0;
        const all = Array.from(users.values());
        const items = all.slice(offset, offset + limit);
        return {
            status: 200,
            body: {items, total: all.length, meta: {limit, offset}},
        };
    },
});

// CONTRACT 3: Get user by id (protected)
const GetUser = createContract({
    name: "GetUser",
    path: "/users/:id",
    method: "get",
    middlewares: [authMiddleware],
    request: {params: IdParam},
    responses: {
        200: z.object({id: z.number(), email: z.email(), name: z.string()}),
        401: z.object({error: z.string()}),
        404: z.object({error: z.string()}),
    },
    handler: async ({params}) => {
        const u = users.get(params.id);
        if (!u) return {status: 404, body: {error: "Not found"}};
        return {status: 200, body: u};
    },
});

// CONTRACT 4: Update user (protected, simple merge)
const UpdateUser = createContract({
    name: "UpdateUser",
    path: "/users/:id",
    method: "put",
    middlewares: [authMiddleware],
    request: {
        params: IdParam,
        body: z.object({email: Email.optional(), name: Name.optional()}),
    },
    responses: {
        200: z.object({id: z.number(), email: z.email(), name: z.string()}),
        400: z.object({errors: z.array(z.object({path: z.string(), message: z.string()}))}),
        401: z.object({message: z.string()}),
        404: z.object({message: z.string()}),
    },
    handler: async ({params, body, context}) => {
        if (params.id != context.userId) return {status: 404, body: {message: "Not found"}};
        const u = users.get(context.userId);
        if (!u) return {status: 404, body: {message: "Not found"}};
        if (body.email && Array.from(users.values()).some((x) => x.email === body.email && x.id !== context.userId,)) return {
            status: 400,
            body: {errors: [{path: "body.email", message: "Email in use"}]},
        };
        const updated = {...u, ...body};
        users.set(context.userId, updated);
        return {status: 200, body: updated};
    },
});

// CONTRACT 5: Delete user (service token only)
const DeleteUser = createContract({
    name: "DeleteUser",
    path: "/users/:id",
    method: "delete",
    middlewares: [
        createMiddleware({
            name: "serviceAuthentication",
            request: {headers: z.object({authorization: z.string()})},
            handler: ({headers, next}) => {
                const token = headers.authorization.replace(/^Bearer\s*/i, "");
                if (token === "service") return next.success();
                return next.error(401, {message: "Service token required"});
            },
        }),
    ],
    request: {params: IdParam},
    responses: {
        204: null,
        404: z.object({message: z.string()}),
    },
    handler: async ({params}) => {
        if (!users.has(params.id)) return {status: 404, body: {message: "Not found"}};
        users.delete(params.id);
        return {status: 204};
    },
});

// app setup and registration
const app = express();
app.use(express.json());
registerContracts(app, [
    CreateUser,
    ListUsers,
    GetUser,
    UpdateUser,
    DeleteUser,
]);

// OpenAPI generation and docs endpoints
const openApi = generateOpenApi(
    [CreateUser, ListUsers, GetUser, UpdateUser, DeleteUser],
    {
        title: "Example API",
        version: "1.0.0",
    },
);
app.get("/openapi.json", (_req, res) => res.json(openApi));

app.listen(3000, () => console.log(`Listening http://localhost:${3000}`));