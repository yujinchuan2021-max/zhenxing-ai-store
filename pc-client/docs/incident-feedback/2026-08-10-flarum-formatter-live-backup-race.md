# Flarum live backup raced generated formatter cache

## Symptom and evidence

The only fresh r10 four-quadrant run passed empty success and empty failure,
then retained-success failed before the fixed temporary acceptance runner while
`backup.sh` archived the live Community mounts. GNU tar reported:

```text
var/www/html/storage/formatter/Renderer_d4f9aac184f5c941a34775f649c9e55ac4833119.php: File shrank by 10916 bytes; padding with zeros
```

The outer report SHA-256 is
`28ab65e0088cec0535a3db8141c33bbd228ead99506ca611feedc5396e69e5f5`;
the retained-success report SHA-256 is
`c7ece735c81d499bdad24d7c74786cee088786362042a1db015f869a97a6a9cd`.
The failed scenario cleaned its runner-owned containers, networks and volumes.
It was not retried and retained-failure was not started.

## Root cause and rejected alternatives

The frozen Flarum image wires `Flarum\Formatter\Formatter` to
`storage/formatter`. Its s9e PHP renderer generator writes
`Renderer_<sha1>.php` with `file_put_contents`, which truncates and rewrites the
same generated file. The live Community Apache/PHP process can therefore
change it while tar has already observed its former size. The Community
healthcheck itself makes a root-page request every ten seconds. Caddy does not
mount Community storage, the backup process only reads it, and the separate
Flarum migration job is not running at this pre-cutover backup stage.

Flarum's own `cache:clear` command describes these as temporary/generated files
and explicitly unlinks `storage/formatter/*`. The migration entrypoint then
recreates and assigns the formatter directory before runtime. Historical
`community-files.tar` evidence contains this renderer alongside authoritative
`config.php`, ordinary storage, uploaded/avatar assets and extension assets.
Only the formatter subtree is disposable.

Stopping Community is not the minimum correction. To produce a consistent
quiesced backup it would have to happen before both database dumps and the file
archive, introducing public downtime and a larger restart/rollback boundary.
That option remains reserved for evidence of concurrent mutation in an
authoritative file; no such evidence exists in this incident. Ignoring tar
warnings, retrying, sleeping, or accepting padded bytes is prohibited.

## Fix

`backup.sh` now carries a manifest-controlled `COMMUNITY-FILES.json` contract
and excludes exactly `var/www/html/storage/formatter`. It still archives all
of `/var/lib/flarum`, the rest of `/var/www/html/storage`, and all of
`/var/www/html/public/assets`. It rejects missing/non-directory roots,
formatter type drift, and any symlink in those roots. It validates the archive
roots, entry types and formatter absence before hashing the result.

`restore-drill.sh` requires the exact release contract, validates the archive
SHA, roots, paths and entry types, rejects every member outside the three
contract roots and rejects duplicate member paths, rejects any formatter member,
and proves the restored tree has no formatter cache. The existing explicit Flarum migration
continues to run `cache:clear`, recreate/chown the formatter directory, and the
frozen s9e generator recreates a non-empty renderer from an empty cache.

## Verification and remaining gate

The focused Docker backup/restore gate continuously rewrites the generated
renderer while backing up, preserves config, ordinary storage, assets and an
avatar, restores both databases, regenerates a renderer with the frozen Flarum
image, and rejects a checksum-valid altered contract, unexpected regular member,
duplicate member path, unsafe archive symlink, and live source symlink. Its
current report SHA-256 is recorded by the frozen deployment handoff; matching
containers, networks and volumes reached zero.

Because the deployment payload changes, the candidate must be re-frozen and
must pass fresh true-Linux, durable systemd/HUP, official-bootstrap D and all
four production-shaped C scenarios before independent Test/Release. This local
repair does not authorize server access, upload, packaging or catalog/state/
signature changes.
