/**
 * @internal Metadata for OpenAPI `info` object.
 * Provides title, version, and optional description, contact, license, etc.
 */
export type OpenApiMetadata = {
    title: string;
    version: string;
    description?: string;
    summary?: string;
    termsOfService?: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string };
};