import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const userValues = sqliteTable('user_values', {
 owner:text('owner').notNull(),key:text('key').notNull(),valueJson:text('value_json'),
 version:integer('version').notNull().default(1),updatedAt:integer('updated_at').notNull(),
 deleted:integer('deleted').notNull().default(0),bytes:integer('bytes').notNull().default(0),
},t=>[primaryKey({columns:[t.owner,t.key]}),index('user_values_owner_updated').on(t.owner,t.updatedAt)]);
export const connectorCredentials=sqliteTable('connector_credentials',{
 owner:text('owner').notNull(),provider:text('provider').notNull(),ciphertext:text('ciphertext').notNull(),
 iv:text('iv').notNull(),optionsJson:text('options_json').notNull().default('{}'),
 updatedAt:integer('updated_at').notNull(),verifiedAt:integer('verified_at'),verification:text('verification').notNull().default('unverified'),
},t=>[primaryKey({columns:[t.owner,t.provider]})]);
export const marketCache=sqliteTable('market_cache',{
 key:text('key').primaryKey(),provider:text('provider').notNull(),payload:text('payload').notNull(),
 checkedAt:integer('checked_at').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('market_cache_expiry').on(t.expiresAt)]);
export const rateLimits=sqliteTable('rate_limits',{
 key:text('key').primaryKey(),hits:integer('hits').notNull().default(1),expiresAt:integer('expires_at').notNull(),
},t=>[index('rate_limits_expiry').on(t.expiresAt)]);
export const jobRuns=sqliteTable('job_runs',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),kind:text('kind').notNull(),status:text('status').notNull(),
 startedAt:integer('started_at').notNull(),finishedAt:integer('finished_at'),resultJson:text('result_json'),
},t=>[index('job_runs_owner_started').on(t.owner,t.startedAt)]);
export const dataImports=sqliteTable('data_imports',{
 id:text('id').primaryKey(),expectedCount:integer('expected_count').notNull(),status:text('status').notNull(),
 metadataJson:text('metadata_json').notNull(),createdAt:integer('created_at').notNull(),activatedAt:integer('activated_at'),
});
export const importFiles=sqliteTable('import_files',{
 importId:text('import_id').notNull(),path:text('path').notNull(),sha256:text('sha256').notNull(),bytes:integer('bytes').notNull(),
},t=>[primaryKey({columns:[t.importId,t.path]})]);
export const betaFeedback=sqliteTable('beta_feedback',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),message:text('message').notNull(),category:text('category').notNull(),createdAt:integer('created_at').notNull(),
});
