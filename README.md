# express-api-contracts

## Type-safe Express APIs with zero boilerplate.

Stop juggling separate validation files, untyped route handlers, and out-of-date OpenAPI specs. `express-api-contracts`
lets you define everything about your API endpoint in one single, type-safe object.

[![NPM version](https://img.shields.io/npm/v/express-api-contracts.svg)](https://www.npmjs.com/package/express-api-contracts)

---

### The Problem

Building a single Express endpoint requires you to write and maintain at least three different things: validation logic,
the route handler itself, and documentation. They quickly fall out of sync and create bugs.

**The Old Way (Fragmented & Unsafe):**

- Your validator is somewhere else...

```typescript
const createUserSchema = z.object({email: z.string().email()});
```

- Your handler is untyped and full of boilerplate...

```typescript
app.post('/users', (req, res) => {
    const result = createUserSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({error: result.error});
    }

    // req.body is `any`, so no autocomplete for `result.data`.
    const newUser = db.users.create({email: result.data.email});

    res.status(201).json(newUser);
});
```

- Your OpenAPI docs are in a separate YAML file you have to update by hand.

**The express-api-contracts Way (Unified & Type-Safe):**

You define your endpoint in one place. This becomes your single source of
truth.

```TypeScript
import {createContract} from 'express-api-contracts';
import {z} from 'zod';

const userContract = createContract({
    path: '/users',
    method: 'post',
    request: {
        body: z.object({
            email: z.string().email(),
            name: z.string(),
        }),
    },
    responses: {
        201: z.object({id: z.string(), name: z.string()}),
    },
    // Your handler is now fully typed!
    handler: async ({body}) => {
        // `body` is guaranteed to have `email` and `name`.
        // Autocomplete works perfectly!
        const newUser = await db.users.create(body);
        return {status: 201, body: newUser};
    },
});
```

Later, you just register it.

```TypeScript
registerContracts(app, [userContract]);
```

### Core Features

* **Automatic Validation:** Incoming requests are automatically validated. Invalid requests get a clean 400 error
  response without you writing any if/else boilerplate.

* **Fully Typed Handlers:** Your handler receives a clean object with a typed body, params, and query. Enjoy perfect
  autocomplete and compile-time safety.

* **Auto-Generated OpenAPI Docs:** Generate a complete and 100% accurate openapi.json spec directly from your contracts.
  Your docs will never be out of sync again.

* **Single Source of Truth:** Define the shape, validation, and logic of your endpoint in one place. Refactor with
  confidence.

### Installation

```Bash
npm install express-api-contracts zod
```

You also need to have express and zod as dependencies in your project.

### Quick Start

Here is a complete, runnable example.

```TypeScript
// server.ts
import express from 'express';
import {z} from 'zod';
import {createContract, registerContracts, generateOpenApi} from 'express-api-contracts';

// --- 1. Define your Contract ---
const createUserContract = createContract({
    path: '/users',
    method: 'post',
    request: {
        body: z.object({
            email: z.string().email(),
            name: z.string().min(2),
        }),
    },
    responses: {
        201: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string(),
        }),
    },
    handler: async ({body}) => {
        // `body` is fully typed here!
        console.log('Creating user:', body.name);
        const newUser = {id: 'user-123', ...body};
        return {status: 201, body: newUser};
    },
});

// --- 2. Create and Register with Express ---
const app = express();
app.use(express.json());

registerContracts(app, [createUserContract]);

// --- 3. (Optional) Generate and serve your OpenAPI docs ---
const openApiSpec = generateOpenApi([createUserContract], {
    title: 'My Awesome API',
    version: '1.0.0',
});

app.get('/openapi.json', (req, res) => {
    res.json(openApiSpec);
});

// --- 4. Start the server ---
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
    console.log('API docs at http://localhost:3000/openapi.json');
});
```

Now you can run a POST request to http://localhost:3000/users and see the magic!

### Why use this?

express-api-contracts makes you faster and your code more reliable. It brings the safety and developer experience of
modern frameworks like tRPC and FastAPI to the massive, stable ecosystem of Express.js.

### License

MIT