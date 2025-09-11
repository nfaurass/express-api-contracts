/**
 * Entry point for `express-api-contracts` package.
 *
 * Re-exports all main functions for developer usage:
 * - `createContract`: Define type-safe API endpoints.
 * - `createMiddleware`: Define type-safe middlewares.
 * - `registerContracts`: Register contracts on an Express app.
 * - `generateOpenApi`: Generate OpenAPI 3 spec from contracts.
 */

export {createContract} from "./core/createContract";
export {createMiddleware} from "./core/createMiddleware";
export {registerContracts} from "./express/registerContracts";
export {generateOpenApi} from "./openapi/generateOpenApi";
