#!/bin/bash
set -euo pipefail

if [[ $# -ne 5 ]]; then
  echo "usage: $0 ABSOLUTE_BASE_COMPOSE ABSOLUTE_PRODUCTION_OVERLAY ABSOLUTE_BACKUP_ROOT ABSOLUTE_EVIDENCE_ROOT PREPARED_IDENTITY_IMAGE_TAR" >&2
  exit 2
fi

base="$1"
overlay="$2"
backup_root="$3"
evidence_root="$4"
identity_archive_argument="$5"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/workflow-cutover-admin-origin.sh"
source "$script_dir/workflow-cutover-reviewer-origin.sh"
source "$script_dir/workflow-cutover-compose-files.sh"
source "$script_dir/workflow-node-runtime.sh"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence=""
old_identity_image=""
old_admin_image=""
reviewer_provision_pid=""
reviewer_provision_ready=0
reviewer_status_fd=""
reviewer_control_fd=""
official_bootstrap_started=0
official_bootstrap_complete=0
catalog_activation_backup=""
catalog_activated=0
catalog_store=""

fail() { echo "$1" >&2; exit 1; }
for value in "$base" "$overlay" "$backup_root" "$evidence_root"; do
  [[ "$value" == /* ]] || fail "workflow production cutover paths must be absolute"
done
[[ -f "$base" && -f "$overlay" ]] || fail "workflow production compose is missing"
[[ "$(basename -- "$overlay")" == "compose.workflow-production.yaml" ]] || fail "workflow production overlay is invalid"
[[ "${AIHUB_WORKFLOW_PRODUCTION_TEMPORARY_ACCEPTANCE:-0}" == "1" ]] ||
  fail "TEMPORARY_ACCEPTANCE_REQUIRES_EXPLICIT_AUTHORIZATION"
admin_origin="$(resolve_workflow_cutover_admin_origin)" || exit $?
reviewer_origin="$(resolve_workflow_cutover_reviewer_origin)" || exit $?
resolve_workflow_cutover_compose_files "$base" "$overlay" || exit $?
preflight_workflow_node_runtime
workflow_node="$(prepare_workflow_node_runtime)"
release_root="$(cd "$script_dir/../.." && pwd -P)"
"$workflow_node" "$script_dir/workflow-production-release-bundle.cjs" verify-prepared "$release_root" >/dev/null
identity_image="zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e"
identity_image_id="sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748"
identity_source_digest="2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7"
identity_image_user="node"
identity_archive="$release_root/artifacts/identity-r11-image.tar"
rollback_identity_archive="$release_root/artifacts/identity-19a-rollback-image.tar"
old_admin_archive="$release_root/artifacts/admin-old-b6ea4c5bd0e9.tar"
if [[ "${AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE:-0}" == "1" && "$identity_archive_argument" == "-" ]]; then
  : # The disposable repository harness resolves '-' to this verified prepared artifact.
else
  [[ "$identity_archive_argument" == "$identity_archive" ]] || fail "Identity image archive must be the prepared release artifact"
fi
[[ -f "$identity_archive" && ! -L "$identity_archive" ]] || fail "candidate Identity image archive is missing"
[[ -f "$rollback_identity_archive" && ! -L "$rollback_identity_archive" ]] ||
  fail "Identity rollback image archive is missing"
[[ -f "$old_admin_archive" && ! -L "$old_admin_archive" ]] ||
  fail "Admin rollback image archive is missing"
admin_image="zhenxing-ai/admin:0.1.40-src-186ff057efd3"
admin_image_id="sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd"
admin_archive="$release_root/artifacts/admin-active7-image.tar"
[[ -f "$admin_archive" && ! -L "$admin_archive" ]] || fail "Admin active7 image archive is missing"
expected_old_identity_image="zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392"
expected_old_identity_image_id="sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567"
expected_old_admin_image="zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9"
expected_old_admin_image_id="sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2"
expected_active6_state_sha256="abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9"
compose_args=()
for compose_file in "${workflow_cutover_compose_files[@]}"; do
  compose_args+=(-f "$compose_file")
done
catalog_v2_endpoint="$admin_origin/channels/v2/catalog-release.json"
catalog_endpoint="$admin_origin/catalog-release.json"
reviewer_probe_endpoint="$reviewer_origin/v1/community/workflow-store/reviewer/probe"
compose() { docker compose "${compose_args[@]}" "$@"; }

mkdir -p "$evidence_root"
evidence="$evidence_root/workflow-production-cutover-$stamp"
mkdir "$evidence"

validate_reviewer_provision_message() {
  local expected="$1"
  "$workflow_node" -e '
    let input="";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const value=JSON.parse(input);
      const expected=process.argv[1];
      if(value.phase!==expected)process.exit(1);
      const keys=Object.keys(value).sort();
      const allowed=expected==="ready"
        ? ["identityCreated","identityMigrationCreated","phase","workflowMigrationCreated"]
        : expected==="preflight"
          ? ["identityMigrationPresent","identityPresent","phase","provisionable","workflowMigrationPresent"]
          : ["phase"];
      if(JSON.stringify(keys)!==JSON.stringify(allowed))process.exit(1);
      for(const key of keys.filter(key=>key!=="phase"))if(typeof value[key]!=="boolean")process.exit(1);
      if(expected==="preflight"&&value.provisionable!==true)process.exit(1);
    });
  ' "$expected"
}

run_reviewer_preflight() {
  local message
  message="$(compose --profile workflow-reviewer-provision run --rm -T \
    -e AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=preflight workflow-reviewer-provision \
    2> "$evidence/reviewer-service-identity-preflight.stderr")" ||
    fail "Workflow reviewer service identity preflight failed"
  printf '%s' "$message" | validate_reviewer_provision_message preflight ||
    fail "Workflow reviewer service identity preflight returned an invalid status"
  printf '%s\n' "$message" > "$evidence/reviewer-service-identity-preflight.json"
}

verify_existing_workflow_state() {
  local db_container schema_state state_file service service_container service_health old_identity_image_id old_admin_image_id official_source_marker_discussions
  for service in admin identity-database identity community-database community caddy; do
    service_container="$(compose ps -q "$service")"
    [[ -n "$service_container" ]] || fail "Workflow baseline service is unavailable"
    [[ "$(docker inspect --format '{{.State.Status}}' "$service_container")" == "running" ]] ||
      fail "Workflow baseline service is not running"
    service_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$service_container")"
    [[ "$service_health" == "healthy" ]] || fail "Workflow baseline service is not healthy"
  done
  old_identity_image_id="$(docker inspect --format '{{.Image}}' "$identity_id")"
  old_admin_image_id="$(docker inspect --format '{{.Image}}' "$admin_id")"
  [[ "$old_identity_image" == "$expected_old_identity_image" && "$old_identity_image_id" == "$expected_old_identity_image_id" ]] ||
    fail "Workflow baseline Identity image is not the exact prior image"
  [[ "$old_admin_image" == "$expected_old_admin_image" && "$old_admin_image_id" == "$expected_old_admin_image_id" ]] ||
    fail "Workflow baseline Admin image is not the exact prior image"
  : "${AIHUB_ADMIN_PUBLISHED_DIR:?set signed catalog state path}"
  state_file="$AIHUB_ADMIN_PUBLISHED_DIR/catalog-store/state.json"
  [[ -f "$state_file" && ! -L "$state_file" ]] || fail "Workflow baseline catalog state is unavailable"
  [[ "$("$workflow_node" -e 'const fs=require("node:fs"),crypto=require("node:crypto");process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"))' "$state_file")" == "$expected_active6_state_sha256" ]] ||
    fail "Workflow baseline catalog state is not exact active6"
  db_container="$(compose ps -q identity-database)"
  [[ -n "$db_container" ]] || fail "Identity database container is unavailable"
  schema_state="$(docker exec "$db_container" psql -X -v ON_ERROR_STOP=1 -U aihub -d aihub -At -c "SELECT CASE WHEN to_regclass('community_workflow.events') IS NULL THEN 'absent' ELSE 'present' END || '|' || CASE WHEN to_regclass('community_workflow.event_head') IS NULL THEN 'absent' ELSE 'present' END || '|' || CASE WHEN to_regclass('community_workflow.idempotency') IS NULL THEN 'absent' ELSE 'present' END")" || fail "Workflow schema preflight query failed"
  [[ "$schema_state" == "present|present|present" ]] || fail "Workflow schema is not the existing applied schema"
  official_source_marker_discussions="$(printf '%s\n' "SELECT COUNT(*) FROM discussions WHERE title LIKE '% [AIHUBWFOS%V1]';" |
    compose exec -T community-database sh -ec 'MYSQL_PWD="$(cat /run/secrets/forum_db_password)" exec mariadb -u aihub_forum -N -B aihub_forum')" ||
    fail "Workflow source post count readback failed"
  [[ "$official_source_marker_discussions" =~ ^[0-9]+$ ]] || fail "Workflow source post count readback is invalid"
  docker exec "$db_container" psql -X -v ON_ERROR_STOP=1 -U aihub -d aihub -At -c "SELECT json_build_object(
    'schemaState', 'present|present|present',
    'appendOnlyTriggers', (SELECT count(*)::int FROM pg_trigger WHERE tgname='community_workflow_events_append_only' AND NOT tgisinternal),
    'eventHeadRows', (SELECT count(*)::int FROM community_workflow.event_head WHERE singleton=true),
    'eventHead', (SELECT last_sequence::int FROM community_workflow.event_head WHERE singleton=true),
    'reviewerExact', (SELECT count(*)::int FROM public.users WHERE id='5f16d5ac-6663-5905-b920-c2140ac6769c'
      AND identity_kind='workflow-reviewer-service' AND status='disabled'
      AND email IS NULL AND normalized_email IS NULL AND phone IS NULL AND normalized_phone IS NULL
      AND password_hash IS NULL AND username='__workflow_reviewer_service__'
      AND normalized_username='__workflow_reviewer_service__'
      AND community_username='zx_5f16d5ac66635905b920c2140ac'),
    'reviewerForbiddenRelations',
      (SELECT count(*)::int FROM public.community_profiles WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c') +
      (SELECT count(*)::int FROM public.profile_avatars WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c') +
      (SELECT count(*)::int FROM public.devices WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c') +
      (SELECT count(*)::int FROM public.sessions WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c') +
      (SELECT count(*)::int FROM public.community_handoffs WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c') +
      (SELECT count(*)::int FROM public.email_change_challenges WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c'),
    'publisherExact', (SELECT count(*)::int FROM public.users WHERE id='46564566-f5f4-599c-8ce5-0609069f5148'
      AND identity_kind='workflow-official-publisher-service' AND status='disabled'
      AND email IS NULL AND normalized_email IS NULL AND phone IS NULL AND normalized_phone IS NULL
      AND password_hash IS NULL AND username='__workflow_official_publisher_service__'
      AND normalized_username='__workflow_official_publisher_service__'
      AND community_username='zx_46564566f5f4599c8ce50609069'),
    'publisherForbiddenRelations',
      (SELECT count(*)::int FROM public.community_profiles WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148') +
      (SELECT count(*)::int FROM public.profile_avatars WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148') +
      (SELECT count(*)::int FROM public.devices WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148') +
      (SELECT count(*)::int FROM public.sessions WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148') +
      (SELECT count(*)::int FROM public.community_handoffs WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148') +
      (SELECT count(*)::int FROM public.email_change_challenges WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148'),
    'officialSourceMarkerDiscussions', $official_source_marker_discussions,
    'events', COALESCE((SELECT json_agg(json_build_object(
      'sequence', e.sequence::int,
      'operation', e.operation,
      'actorIdentityId', e.actor_identity_id::text,
      'eventData', e.event_data,
      'timestampExact', e.created_at=(e.event_data->>'at')::timestamptz
    ) ORDER BY e.sequence) FROM community_workflow.events e), '[]'::json),
    'idempotency', COALESCE((SELECT json_agg(json_build_object(
      'actorIdentityId', i.actor_identity_id::text,
      'keyHash', i.key_hash::text,
      'requestHash', i.request_hash::text,
      'response', i.response,
      'eventSequence', i.event_sequence::int
    ) ORDER BY i.event_sequence) FROM community_workflow.idempotency i), '[]'::json)
  )::text" > "$evidence/workflow-existing-database.json" || fail "Workflow state readback failed"
  "$workflow_node" "$script_dir/workflow-production-existing-state.cjs" source-post-program |
    compose --profile workflow-official-bootstrap run --no-deps --rm -T --entrypoint /usr/local/bin/node workflow-official-bootstrap - \
      > "$evidence/workflow-existing-source-posts.json" || fail "Workflow source post readback failed"
  "$workflow_node" "$script_dir/workflow-production-existing-state.cjs" verify \
    "$evidence/workflow-existing-database.json" "$evidence/identity-before.json" \
    "$evidence/workflow-existing-source-posts.json" > "$evidence/workflow-existing-state.json" ||
    fail "Workflow state is not an enumerated production baseline"
}

start_reviewer_provision() {
  local message
  coproc REVIEWER_PROVISION {
    compose --profile workflow-reviewer-provision run --rm -T workflow-reviewer-provision \
      2> "$evidence/reviewer-service-identity.stderr"
  }
  reviewer_provision_pid="$REVIEWER_PROVISION_PID"
  exec {reviewer_status_fd}<&"${REVIEWER_PROVISION[0]}"
  exec {reviewer_control_fd}>&"${REVIEWER_PROVISION[1]}"
  read -r -t 120 message <&"$reviewer_status_fd" || fail "Workflow reviewer service identity provision did not become ready"
  printf '%s' "$message" | validate_reviewer_provision_message ready || fail "Workflow reviewer service identity provision returned an invalid status"
  printf '%s\n' "$message" > "$evidence/reviewer-service-identity-ready.json"
  reviewer_provision_ready=1
}

finish_reviewer_provision() {
  local action="$1" message=""
  [[ "$reviewer_provision_ready" == "1" ]] || return 0
  printf '%s\n' "$action" >&"$reviewer_control_fd" || true
  if read -r -t 120 message <&"$reviewer_status_fd"; then
    printf '%s\n' "$message" > "$evidence/reviewer-service-identity-$action.json"
    printf '%s' "$message" | validate_reviewer_provision_message "$([[ "$action" == "commit" ]] && echo committed || echo rolled-back)" || true
  fi
  if [[ "$action" == "commit" ]]; then
    wait "$reviewer_provision_pid" || fail "Workflow reviewer service identity commit failed"
    printf '%s' "$message" | validate_reviewer_provision_message committed || fail "Workflow reviewer service identity commit returned an invalid status"
  else
    wait "$reviewer_provision_pid" || true
  fi
  reviewer_provision_ready=0
  exec {reviewer_status_fd}<&-
  exec {reviewer_control_fd}>&-
}

restore_disabled_base() {
  status=$?
  trap - EXIT HUP INT TERM
  if [[ "$status" -ne 0 ]]; then
    finish_reviewer_provision rollback || true
  fi
  if [[ "$status" -ne 0 && "$catalog_activated" == "1" ]]; then
    "$workflow_node" "$script_dir/catalog-active7-state-activation.cjs" rollback \
      "$catalog_store" "$catalog_activation_backup" || true
  fi
  if [[ "$status" -ne 0 && "$official_bootstrap_started" == "1" && "$official_bootstrap_complete" != "1" ]]; then
    # The wrapper only uses the append-only state machine.  Its own same-process
    # compensation removes only unreferenced source posts/publisher rows; if it
    # reached Workflow events, restore the disabled base rather than deleting.
    bash "$script_dir/workflow-production-emergency-disable.sh" "$base" "$overlay" "$evidence" || true
  fi
  if [[ "$status" -ne 0 && -n "$old_identity_image" ]]; then
    printf 'services:\n  identity:\n    image: %s\n' "$old_identity_image" > "$evidence/rollback-identity.yaml"
    rollback_args=("${compose_args[@]}")
    rollback_args[3]="$evidence/rollback-identity.yaml"
    AIHUB_IDENTITY_IMAGE="$old_identity_image" docker compose "${rollback_args[@]}" up -d --no-build identity caddy || true
  fi
  if [[ "$status" -ne 0 && -n "$old_admin_image" ]]; then
    AIHUB_ADMIN_CMS_IMAGE="$old_admin_image" docker compose "${compose_args[@]}" up -d --no-build admin || true
  fi
  # This rollback never tears down durable volumes or prunes Docker resources.
  exit "$status"
}
trap restore_disabled_base EXIT HUP INT TERM

"$workflow_node" "$script_dir/verify-manifest.cjs"
"$workflow_node" "$script_dir/identity-source-manifest.cjs" > "$evidence/identity-source-manifest.json"
"$workflow_node" -e 'process.stdout.write(JSON.stringify({version:process.version,platform:process.platform,arch:process.arch})+"\n")' > "$evidence/node-runtime.json"
"$workflow_node" "$script_dir/workflow-image-archive.cjs" verify-rollback "$rollback_identity_archive" >/dev/null
docker load -i "$rollback_identity_archive" > "$evidence/rollback-identity-docker-load.txt"
[[ "$(docker image inspect --format '{{.Id}}' "$expected_old_identity_image")" == "$expected_old_identity_image_id" ]] ||
  fail "Identity rollback image ID drifted"
[[ "$(docker image inspect --format '{{ index .Config.Labels "com.aihub.source-content-sha256" }}' "$expected_old_identity_image")" == "19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c" ]] ||
  fail "Identity rollback source label drifted"
[[ "$(docker image inspect --format '{{ index .Config.Labels "com.aihub.release-version" }}' "$expected_old_identity_image")" == "workflow-reviewer-service-identity-candidate-2026-08-08" ]] ||
  fail "Identity rollback release label drifted"
[[ "$(docker image inspect --format '{{.Config.User}}' "$expected_old_identity_image")" == "node" ]] ||
  fail "Identity rollback Config.User drifted"
"$workflow_node" "$script_dir/workflow-image-archive.cjs" verify-old-admin "$old_admin_archive" >/dev/null
docker load -i "$old_admin_archive" > "$evidence/old-admin-docker-load.txt"
[[ "$(docker image inspect --format '{{.Id}}' "$expected_old_admin_image")" == "$expected_old_admin_image_id" ]] ||
  fail "Admin rollback image ID drifted"
[[ "$(docker image inspect --format '{{ index .Config.Labels "com.aihub.source-content-sha256" }}' "$expected_old_admin_image")" == "b6ea4c5bd0e9517579a3c4380fcf2c1617975f1ff6a2c6024a703a71ed4620de" ]] ||
  fail "Admin rollback source label drifted"
[[ "$(docker image inspect --format '{{ index .Config.Labels "com.aihub.release-version" }}' "$expected_old_admin_image")" == "0.1.40" ]] ||
  fail "Admin rollback release label drifted"
[[ "$(docker image inspect --format '{{.Config.User}}' "$expected_old_admin_image")" == "node" ]] ||
  fail "Admin rollback Config.User drifted"
docker load -i "$identity_archive" > "$evidence/identity-docker-load.txt"
docker image inspect "$identity_image" > "$evidence/identity-image-inspect.json"
[[ "$(docker image inspect --format '{{.Id}}' "$identity_image")" == "$identity_image_id" ]] || fail "candidate Identity image ID drifted"
[[ "$(docker image inspect --format '{{ index .Config.Labels "com.aihub.source-content-sha256" }}' "$identity_image")" == "$identity_source_digest" ]] || fail "candidate Identity source label drifted"
[[ "$(docker image inspect --format '{{.Config.User}}' "$identity_image")" == "$identity_image_user" ]] || fail "candidate Identity Config.User drifted"
docker load -i "$admin_archive" > "$evidence/admin-docker-load.txt"
docker image inspect "$admin_image" > "$evidence/admin-image-inspect.json"
docker image inspect "$admin_image" | grep -q "$admin_image_id" || fail "Admin active7 image identity drifted"
export AIHUB_ADMIN_CMS_IMAGE="$admin_image"
compose config --no-interpolate > "$evidence/compose.resolved.yaml"
compose config --images > "$evidence/images.txt"

identity_id="$(compose ps -q identity)"
[[ -n "$identity_id" ]] || fail "current Identity container is unavailable"
old_identity_image="$(docker inspect --format '{{.Config.Image}}' "$identity_id")"
admin_id="$(compose ps -q admin)"
[[ -n "$admin_id" ]] || fail "current Admin container is unavailable"
old_admin_image="$(docker inspect --format '{{.Config.Image}}' "$admin_id")"
docker inspect "$identity_id" > "$evidence/identity-before.json"
docker inspect "$admin_id" > "$evidence/admin-before.json"

curl --fail --silent --show-error "$catalog_v2_endpoint" > "$evidence/catalog-v2-before.json"
"$workflow_node" - "$evidence/catalog-v2-before.json" <<'NODE'
const fs=require("node:fs");const value=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));const p=value.payload||{};if(p.releaseId!=="catalog-v00000006-567e671621f1-3dcee587"||p.catalogVersion!==6||p.catalogSha256!=="567e671621f14d7788ecdbe642be738aa5133d9688d45bbae4d0f7760a926d9f")process.exit(1);
NODE
[[ "$?" == "0" ]] || fail "active v2 catalog metadata is not the expected active6 release"
run_reviewer_preflight
verify_existing_workflow_state
backup="$(bash "$script_dir/backup.sh" "$base" "$overlay" "$backup_root")"
start_reviewer_provision

compose stop admin identity caddy
compose up -d --no-build admin identity caddy

deadline=$((SECONDS + 90))
while (( SECONDS < deadline )); do
  identity_new="$(compose ps -q identity)"
  caddy_new="$(compose ps -q caddy)"
  admin_new="$(compose ps -q admin)"
  if [[ -n "$identity_new" && -n "$caddy_new" && -n "$admin_new" ]] &&
     [[ "$(docker inspect --format '{{.State.Health.Status}}' "$identity_new")" == "healthy" ]] &&
     [[ "$(docker inspect --format '{{.State.Health.Status}}' "$caddy_new")" == "healthy" ]] &&
     [[ "$(docker inspect --format '{{.State.Health.Status}}' "$admin_new")" == "healthy" ]]; then
    break
  fi
  sleep 2
done
[[ "${identity_new:-}" ]] && [[ "$(docker inspect --format '{{.State.Health.Status}}' "$identity_new")" == "healthy" ]] || fail "Identity did not become healthy within 90 seconds"
[[ "${caddy_new:-}" ]] && [[ "$(docker inspect --format '{{.State.Health.Status}}' "$caddy_new")" == "healthy" ]] || fail "Caddy did not become healthy within 90 seconds"
[[ "${admin_new:-}" ]] && [[ "$(docker inspect --format '{{.State.Health.Status}}' "$admin_new")" == "healthy" ]] || fail "Admin did not become healthy within 90 seconds"

if [[ "${AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE:-0}" == "1" && -z "${AIHUB_ADMIN_PUBLISHED_DIR:-}" ]]; then
  catalog_store="$evidence/isolated-catalog-store"
else
  : "${AIHUB_ADMIN_PUBLISHED_DIR:?set signed catalog state path}"
  catalog_store="$AIHUB_ADMIN_PUBLISHED_DIR/catalog-store"
fi
catalog_activation_backup="$evidence/catalog-state-activation-backup"
"$workflow_node" "$script_dir/catalog-active7-state-activation.cjs" activate \
  "$catalog_store" "$catalog_activation_backup" "$evidence"
catalog_activated=1

docker inspect "$identity_new" "$caddy_new" > "$evidence/runtime-inspect.json"
caddy_process_status="$(docker exec "$caddy_new" sh -ec 'awk "/^Uid:|^Gid:|^CapEff:/ { print }" /proc/1/status')"
grep -Eq '^Uid:[[:space:]]+65534[[:space:]]+65534[[:space:]]+65534[[:space:]]+65534$' <<< "$caddy_process_status" || fail "Caddy PID1 identity is not nobody"
grep -Eq '^Gid:[[:space:]]+65534[[:space:]]+65534[[:space:]]+65534[[:space:]]+65534$' <<< "$caddy_process_status" || fail "Caddy PID1 group is not nobody"
grep -Eq '^CapEff:[[:space:]]+0+$' <<< "$caddy_process_status" || fail "Caddy runtime capabilities are not empty"
curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$reviewer_probe_endpoint" |
  grep -qx '404' || fail "Caddy exposed reviewer route"
curl --fail --silent --show-error "$catalog_endpoint" > "$evidence/catalog-v1-after.json"
"$workflow_node" - "$evidence/catalog-v1-after.json" <<'NODE'
const fs=require("node:fs");const value=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));const p=value.payload||{};if(p.releaseId!=="catalog-v00000072-e286516335da-a8b62a49"||p.catalogVersion!==72)process.exit(1);
NODE
[[ "$?" == "0" ]] || fail "active v1 catalog metadata changed during active7 state activation"
curl --fail --silent --show-error "$catalog_v2_endpoint" > "$evidence/catalog-v2-after.json"
"$workflow_node" - "$evidence/catalog-v2-after.json" <<'NODE'
const fs=require("node:fs");const value=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));const p=value.payload||{};if(p.releaseId!=="catalog-v00000007-8c49e1972186-0cec5335"||p.catalogVersion!==7||p.catalogSha256!=="8c49e1972186f841dca9cea8f26074fe27aed9a140e4f5687cf7f23d134f034c"||p.parentReleaseId!=="catalog-v00000006-567e671621f1-3dcee587")process.exit(1);
NODE
[[ "$?" == "0" ]] || fail "active v2 catalog metadata is not the expected active7 release"

# The repository runner creates and destroys its own isolated Identity,
# PostgreSQL, MariaDB, Flarum and Caddy project. It never writes acceptance
# fixtures to the production services checked above. Pinning the path here
# removes the former arbitrary executable environment seam.
"$workflow_node" "$script_dir/workflow-production-temporary-acceptance.cjs" "$base" "$overlay" "$evidence"
"$workflow_node" - "$evidence/workflow-temporary-acceptance-report.json" <<'NODE'
const fs=require("node:fs");
const report=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(report.status!=="pass"||report.finalized!==true||report.cleanup?.completed!==true)process.exit(1);
NODE
[[ "$?" == "0" ]] || fail "Workflow temporary acceptance final report is invalid"
official_bootstrap_started=1
"$workflow_node" "$script_dir/workflow-official-bootstrap-production-wrapper.cjs" \
  "$evidence" "$admin_origin" "$AIHUB_PUBLIC_HOST" "${workflow_cutover_compose_files[@]}"
official_bootstrap_complete=1
finish_reviewer_provision commit

trap - EXIT HUP INT TERM
echo "$evidence"
