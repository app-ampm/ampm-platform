-- Upload serialization (feature 9.3 slice 5c): a nullable claim timestamp on a media asset. An upload
-- acquires it with a compare-and-swap (only when null or older than the stale-steal TTL) and releases it
-- when the upload settles, so concurrent uploads to one asset cannot interleave and tear its rendition set.
ALTER TABLE "media_assets" ADD COLUMN "upload_started_at" TIMESTAMPTZ(6);
