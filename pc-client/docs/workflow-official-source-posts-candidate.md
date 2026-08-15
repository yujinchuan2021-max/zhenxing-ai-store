# Workflow official source posts candidate

This is a local, candidate-only community seam for three readable Flarum discussions used as provenance for future Workflow releases. It does not create an Identity publisher account, profile, session, handoff, or browser relationship.

`community/workflow-official-source-posts.cjs` validates the fixed manifest, searches by a deterministic title marker, creates each discussion through Flarum's normal JSON:API (`POST /api/discussions`) using the existing governed admin API-key path, and verifies the returned first post with an exact `GET /api/posts/{id}`. A same-process opaque receipt permits rollback by deleting only discussions created by that invocation. Re-running after a successful create finds the marker and creates zero additional discussions; drift is rejected closed.

The local acceptance script uses a fresh Flarum candidate image and fresh database/volumes, then performs migration, runtime API create, exact GET, retry-count assertions, and controlled cleanup. The observed candidate IDs were `1/1`, `2/2`, and `3/3` for discussion/post pairs in that disposable database; these IDs are evidence only and are not production references.

Production remains disabled. A future manifest-controlled one-shot runner must use an approved official community publication credential/path, create new real posts, exact-GET them, freeze the returned IDs, and record idempotency and rollback evidence. It must not use the Workflow publisher service identity, acceptance fixture IDs, direct database INSERT, mock, mapping, or production writes.
