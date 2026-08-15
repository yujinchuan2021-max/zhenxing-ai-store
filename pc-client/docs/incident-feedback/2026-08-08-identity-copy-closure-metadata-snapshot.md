# Identity candidate closure drift after Skill metadata schema work

## Symptom

The independent Workflow production candidate run passed its isolated runtime
gates, but its frozen Identity image still carried source digest
`9b9dc7798519cec0df73bbfb91408622f698b54ef28d65590657355ef5dfa1c4`.
The current canonical Identity source manifest instead resolved to
`5ea9d2f2dd15852db3631c979624227a1e83833a3b9df1b6073e7a534153096b`.

## Root cause

The completed, data-only Skill metadata snapshot allowlist changed the exact
Identity Docker dependency `shared/ecosystem-resources.cjs`. The 60-input
comparison found exactly one difference: the file changed from 10,002 bytes,
SHA-256 `fb54ba812bc1c7db0eb81b1c1ba7199eb79587c2fa78026027ea251ed1f552f3`,
to 10,261 bytes, SHA-256
`0f754cc7c22bc56b93edae35dc29a4716b36a118db5b27365a941216beb14ac0`.

## Fix and verification

Do not revert the reviewed Skill work for image compatibility. Rebuild the
candidate from the frozen closure and pin all three Identity roles to
`zhenxing-ai/identity:workflow-readiness-candidate-5ea9d2f2dd15` (image ID
`sha256:0d407be9c34f75b9c729266ff80fa03e4e9a82c0eb72720bfdbe791af5e56883`).
The image label equals the source digest. The image closure gate compares all
58 actual Docker COPY inputs by bytes and SHA-256 and rejects image `.env`,
PEM, and key-shaped paths. The deployment set is
`a48fdd5129030d9482b4fafe099aa7a81e0bae9baba350e1241b9105d6b53dd7`;
the checked-in manifest SHA-256 is
`47edd4d10ecf10cd6aa89c7579e14f192e1fd32753a750d0d264618ee50fc8d0`.

## Remaining acceptance

This only closes source-to-image-to-deployment provenance. It does not replace
a new, independent full isolated A-E run, current Electron evidence, or an
explicit server cutover authorization. The candidate remains disabled and
`deployable=false`; no catalog, state, signature, server, or package changes
are authorized by this repair.
