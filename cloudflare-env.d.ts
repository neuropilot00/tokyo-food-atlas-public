declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ASSETS?: Fetcher;
    ATLAS_OWNER_EMAIL?: string;
    ATLAS_ENCRYPTION_KEY?: string;
    ATLAS_IMPORT_SECRET?: string;
  }
}
