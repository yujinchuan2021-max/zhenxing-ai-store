# Perplexity Comet download was rejected after an official redirect

## User-visible failure

The managed Comet installer would stop at the client security boundary because the official Perplexity endpoint redirected to a Cloudflare R2 bucket that was not present in the client-owned host whitelist.

## Reproduction evidence

- The official entrypoint returned HTTP 206.
- Its final signed URL used `pplx-browser-binaries.a0adf9b772aecba4fa8883581f3c9180.r2.cloudflarestorage.com`.
- The object store declared `text/html; charset=utf-8`, but the first 16 bytes were `4d5a7800010000000400000000000000`, which is a Windows MZ executable.
- Perplexity's current Comet page and help center continue to identify Windows as a supported download platform.

## Root cause

The reviewed download profile only allowed `www.perplexity.ai`, and the pre-release checks did not automatically test the final redirect host or inspect a small payload signature. The object store's incorrect MIME type made a content-type-only check insufficient.

## Fix

- Added the exact official R2 bucket host to the local Comet whitelist; no wildcard or backend-controlled host expansion was introduced.
- Added a shared desktop source audit that checks HTTP status, HTTPS, final host, content type, curl failures, and the first 16 bytes.
- A page-like MIME type remains rejected unless the sampled payload has Windows MZ magic and the final host is already locally reviewed.
- Added an npm audit command that checks every reviewed Windows desktop source without downloading full installers.

## Verification

- The source audit passed 26/26 reviewed Windows desktop products.
- Comet returned HTTP 206 from the reviewed R2 host and matched MZ executable magic.
- Unit coverage includes redirect-host rejection, HTML rejection, MZ override, curl range behavior, and response metadata parsing.
