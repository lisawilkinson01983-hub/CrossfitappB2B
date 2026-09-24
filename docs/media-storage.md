# Media storage

How uploaded photos and videos are processed, stored and served, and how to
set up the storage bucket on Railway.

## What happens on upload

| | Before | Now |
|---|---|---|
| Photos | Stored as uploaded (up to 5 MB) | Resized to max 1600 px, auto-rotated, converted to WebP (typically 50–300 KB) |
| Videos | Stored as uploaded (often 20–45 MB HEVC `.mov`, which Android and Chrome often can't play) | Transcoded to 720p, max 30 fps, H.264/AAC `.mp4` that plays everywhere (typically 1–5 MB). iPhone HDR is tone-mapped so it doesn't look washed out. |
| Metadata | Kept, including the GPS location the photo or video was taken at | Stripped |
| Videos over 10 MB | Silently truncated by Next.js middleware and rejected as "Invalid request body" | Accepted (limit raised to 160 MB) |

Code: `src/lib/mediaProcessing.ts` (sharp and ffmpeg) and `src/lib/uploads.ts`
(validation). If compression fails for an unexpected reason, the original
file is stored instead, so an upload is never lost.

Transcoding takes about 2 s for a typical 1080p clip and up to about 15 s for
a 4K 60 fps HDR clip. Videos are processed one at a time, so a burst of uploads
queues rather than overloading the server.

## Where files are stored

`src/lib/mediaStorage.ts` picks the backend from env vars:

- **`MEDIA_BUCKET` set** → an S3-compatible bucket (Railway Storage Bucket or
  Cloudflare R2): about $0.015/GB-month with **free egress**.
- **Not set** → local disk (`UPLOADS_DIR`, default `./uploads`), as before.
  On Railway that's the volume: $0.15/GB-month plus $0.05/GB egress each time
  a file is viewed.

The DB always stores `/media/<filename>`, so switching backends needs no DB
changes. The `/media/[filename]` route:

1. serves the file from local disk if it's there, with HTTP range support so
   videos play in iOS Safari;
2. otherwise **redirects** to the bucket, using a signed link valid for up to
   2 hours or a public CDN URL. Bytes go straight from the bucket to the
   browser and never pass through (or get billed to) the app server.

## Setting up a Railway bucket

1. In the Railway project: **+ New → Bucket**.
2. On the **web service's Variables**, add references to the bucket's
   credentials. Check the bucket's Credentials/Variables tab for the exact
   names, and swap `Bucket` for your bucket service's name:
   ```
   MEDIA_BUCKET=${{Bucket.BUCKET}}
   MEDIA_S3_ENDPOINT=${{Bucket.ENDPOINT}}
   MEDIA_S3_REGION=${{Bucket.REGION}}
   MEDIA_S3_ACCESS_KEY_ID=${{Bucket.ACCESS_KEY_ID}}
   MEDIA_S3_SECRET_ACCESS_KEY=${{Bucket.SECRET_ACCESS_KEY}}
   ```
   Keep `UPLOADS_DIR` and the volume: the SQLite DB lives there, and old
   uploads keep being served from it until they're migrated.
3. Deploy. New uploads now go to the bucket.
4. Move existing uploads across from a shell on the service (`railway ssh`):
   ```
   npm run media:migrate                    # copy volume → bucket (safe to re-run)
   npm run media:migrate -- --delete-local  # then free the volume
   ```

**Cloudflare R2 instead:** create a bucket and an API token, then set
`MEDIA_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` and the
key/secret. Optionally enable a public custom domain and set
`MEDIA_PUBLIC_URL` to it, so media is served straight from Cloudflare's CDN.

## Cleaning up unused files

Replaced profile photos, deleted posts and workouts, rejected submissions and
deleted accounts leave files behind. To find and remove them:

```
npm run media:cleanup               # dry run: reports orphaned files and size
npm run media:cleanup -- --delete   # deletes them
```

The script works by checking what the DB still references, rather than
deleting on each delete route, because one file can be shared (a workout's
photo is reused by its "share to feed" post). Files less than 24 hours old
are skipped. Running it monthly is plenty.

## ffmpeg

`ffmpeg-static` downloads an ffmpeg binary during `npm install`. If that
download is ever blocked on a build machine, set `FFMPEG_PATH` to a system
ffmpeg (version 7 or later) instead.
