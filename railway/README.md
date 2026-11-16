# Railway owner-private deployment (prepared, not deployed)

This is a separate Node 24 runtime. It does not alter the Sites worker, D1/R2, or existing data. Configure Dockerfile `railway/Dockerfile`; health endpoint `/healthz`; one replica only. No npm install or framework build is needed. Runtime reuses the exact existing DOM app and API handlers.

Required variables: `ATLAS_OWNER_EMAIL` (Basic login username), `ATLAS_OWNER_PASSWORD` (random >=24 characters), stable `ATLAS_OWNER_ID` (3-80 alphanumeric/underscore/hyphen), canonical HTTPS `ATLAS_PUBLIC_ORIGIN`, stable base64 32-byte `ATLAS_ENCRYPTION_KEY`, `ATLAS_DATA_DIR` pointing to a persistent writable mounted volume. `PORT` supplied by Railway. Missing config fails closed. Do not use `ATLAS_LOCAL_TEST` in production.

Every page, static asset and API requires owner authentication except minimal `/healthz`. Incoming `oai-*` headers are discarded; identity is derived only after credential verification. This single-owner deployment is not a public multi-user service. Basic credentials are sent only over HTTPS; password rotation is server-side. Do not reuse existing passwords.

SQLite WAL stores records; immutable filesystem objects replace R2. Volume must be writable by UID1000. Never deploy onto an ephemeral filesystem. Back up database via SQLite online backup and object directory together before upgrades. No automatic import from Sites, no user data overwritten. Existing Sites accounts/data remain there; migration needs an explicit validated export/import workflow, not copying identities or keys.

Before deployment: approve new resource budget; provision volume and secrets through approved account settings; confirm HTTPS origin and health; verify unauthenticated access denied, spoofed identity denied, persistence across restart, API and UI smoke. GitHub push alone does not deploy Railway. Multiple replicas / shared NFS SQLite are unsupported.
