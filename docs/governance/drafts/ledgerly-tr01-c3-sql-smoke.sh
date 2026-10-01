#!/bin/sh
set -eu
umask 077

OUT=/tmp/ledgerly-c3-sql-smoke
REPO=/home/runner/workspace
C3=1c26be19295902a38e1939b56ff99ae9a195d3de
IMAGE='postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825'
IMAGE_DIGEST='postgres@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825'
SAFE_PATH=${PATH:-/usr/bin:/bin}
SAFE_HOME="$OUT/docker-home"
mkdir -p "$SAFE_HOME"

run_safe() {
  limit=$1
  shift
  env -i PATH="$SAFE_PATH" HOME="$SAFE_HOME" timeout --signal=TERM "${limit}s" "$@"
}
docker_safe() { limit=$1; shift; run_safe "$limit" docker "$@"; }
docker_with_password() {
  limit=$1
  shift
  env -i PATH="$SAFE_PATH" HOME="$SAFE_HOME" POSTGRES_PASSWORD="$PGPW" timeout --signal=TERM "${limit}s" docker "$@"
}

CONTAINER_NAME=
CONTAINER_TOKEN=
CONTAINER_CREATED=0
PGPW=
CLEANUP_FAILED=0
cleanup() {
  original_rc=$?
  trap - EXIT HUP INT TERM
  if [ -n "$CONTAINER_NAME" ] && [ "$CONTAINER_CREATED" -eq 1 ]; then
    owned=no
    label_value=$(docker_safe 15 inspect --format '{{index .Config.Labels "ledgerly-c3-sql-smoke"}}' "$CONTAINER_NAME" 2>/dev/null) || label_value=
    if [ "$label_value" = "$CONTAINER_TOKEN" ]; then owned=yes; fi
    if [ "$owned" = yes ]; then
      volumes=$(docker_safe 15 inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}{{"\n"}}{{end}}{{end}}' "$CONTAINER_NAME" 2>/dev/null) || volumes=
      printf 'Cleanup: removing only the labeled disposable container with docker rm -fv.\n'
      if ! docker_safe 30 rm -fv "$CONTAINER_NAME"; then
        printf 'FAIL cleanup: docker rm -fv did not complete.\n'
        CLEANUP_FAILED=1
      fi
      if names=$(docker_safe 15 container ls -a --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}' 2>/dev/null); then
        if [ -n "$names" ]; then
          printf 'FAIL cleanup: matching named container remains: %s\n' "$names"
          CLEANUP_FAILED=1
        else
          printf 'PASS cleanup: no container named %s remains.\n' "$CONTAINER_NAME"
        fi
      else
        printf 'FAIL cleanup: could not verify container absence.\n'
        CLEANUP_FAILED=1
      fi
      if [ -n "$volumes" ]; then
        printf '%s\n' "$volumes" | while IFS= read -r volume; do
          [ -n "$volume" ] || continue
          if volume_name=$(docker_safe 15 volume inspect --format '{{.Name}}' "$volume" 2>/dev/null); then
            printf 'FAIL cleanup: associated anonymous volume remains: %s\n' "$volume_name"
            exit 1
          else
            printf 'PASS cleanup: associated anonymous volume %s is absent.\n' "$volume"
          fi
        done || CLEANUP_FAILED=1
      else
        printf 'Cleanup: container reported no Docker-managed anonymous volumes.\n'
      fi
    else
      printf 'No labeled test container found to remove; no pre-existing container was touched.\n'
    fi
  fi
  PGPW=
  if [ "$CLEANUP_FAILED" -ne 0 ]; then original_rc=1; fi
  exit "$original_rc"
}
trap cleanup EXIT HUP INT TERM

printf 'NON-QUALIFICATION disposable SQL constraint smoke; no GitHub calls or qualification evidence.\n'
printf 'C3 source: %s:scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql\n' "$C3"
run_safe 10 git -C "$REPO" show "$C3:scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql" > "$OUT/run-control.sql"
printf 'PASS: exact source read by local git show. SHA256: '
run_safe 10 sha256sum "$OUT/run-control.sql"
printf 'Docker daemon check: '
docker_safe 15 version --format '{{.Client.Version}} {{.Server.Version}}'
if ! image_identity=$(docker_safe 15 image inspect "$IMAGE" --format '{{.Id}} {{json .RepoDigests}}' 2>/dev/null); then
  printf 'Pinned image absent locally; pulling only requested digest (bounded to 180s).\n'
  docker_safe 180 pull "$IMAGE"
  image_identity=$(docker_safe 15 image inspect "$IMAGE" --format '{{.Id}} {{json .RepoDigests}}')
fi
case "$image_identity" in
  *"$IMAGE_DIGEST"*) printf 'PASS image identity: %s\n' "$image_identity" ;;
  *) printf 'FAIL image identity mismatch: %s\n' "$image_identity"; exit 1 ;;
esac

{
  printf 'BEGIN;\nCREATE ROLE ledgerly_api NOLOGIN;\nCREATE ROLE ledgerly_canonical_owner NOLOGIN;\n'
  cat "$OUT/run-control.sql"
  cat "$OUT/predicate-tests.sql"
} > "$OUT/smoke.sql"
PGPW=$(run_safe 10 openssl rand -hex 32)
[ "${#PGPW}" -eq 64 ] || { printf 'FAIL unable to generate ephemeral password.\n'; exit 1; }

attempt=0
while [ "$attempt" -lt 5 ]; do
  CONTAINER_TOKEN=$(run_safe 10 openssl rand -hex 16)
  CONTAINER_NAME="ledgerly-c3-sql-smoke-$CONTAINER_TOKEN"
  existing=$(docker_safe 10 container ls -a --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}')
  [ -z "$existing" ] && break
  attempt=$((attempt + 1))
done
[ "$attempt" -lt 5 ] || { printf 'FAIL could not select an unused container name.\n'; exit 1; }
CONTAINER_CREATED=1
printf 'Disposable container name: %s\n' "$CONTAINER_NAME"
printf 'Starting exact pinned image with --network none, no published ports, and no explicit mounts.\n'
docker_with_password 30 run --detach --name "$CONTAINER_NAME" --label "ledgerly-c3-sql-smoke=$CONTAINER_TOKEN" --network none --pull=never --env POSTGRES_PASSWORD "$IMAGE" bash -c 'while [ ! -f /tmp/c3-bootstrap.sh ]; do sleep 1; done; exec bash /tmp/c3-bootstrap.sh'

network_mode=$(docker_safe 15 inspect --format '{{.HostConfig.NetworkMode}}' "$CONTAINER_NAME")
port_bindings=$(docker_safe 15 inspect --format '{{json .HostConfig.PortBindings}}' "$CONTAINER_NAME")
host_binds=$(docker_safe 15 inspect --format '{{json .HostConfig.Binds}}' "$CONTAINER_NAME")
mounts=$(docker_safe 15 inspect --format '{{range .Mounts}}{{.Type}}:{{.Destination}}:{{.Name}}{{"\n"}}{{end}}' "$CONTAINER_NAME")
[ "$network_mode" = none ] || { printf 'FAIL network mode is %s, not none.\n' "$network_mode"; exit 1; }
case "$port_bindings" in null|'{}'|'[]') : ;; *) printf 'FAIL published port bindings: %s\n' "$port_bindings"; exit 1 ;; esac
case "$host_binds" in null|'[]') : ;; *) printf 'FAIL explicit host binds: %s\n' "$host_binds"; exit 1 ;; esac
case "$mounts" in *bind:*) printf 'FAIL bind mount detected: %s\n' "$mounts"; exit 1 ;; esac
printf 'PASS isolation: network_mode=%s port_bindings=%s host_binds=%s mounts=%s\n' "$network_mode" "$port_bindings" "$host_binds" "${mounts:-none}"

docker_safe 20 cp "$OUT/container-bootstrap.sh" "$CONTAINER_NAME:/tmp/c3-bootstrap.sh" >/dev/null
ready=0
i=0
while [ "$i" -lt 60 ]; do
  if docker_safe 10 cp "$CONTAINER_NAME:/tmp/c3-ready" "$OUT/container-ready" >/dev/null 2>&1; then ready=1; break; fi
  state=$(docker_safe 10 inspect --format '{{.State.Status}}' "$CONTAINER_NAME")
  [ "$state" != exited ] || break
  i=$((i + 1))
  run_safe 3 sleep 1
done
[ "$ready" -eq 1 ] || { printf 'FAIL isolated PostgreSQL bootstrap did not become ready within 60 seconds.\n'; exit 1; }
printf 'PASS PostgreSQL initialized and ready inside isolated container.\n'
docker_safe 20 cp "$OUT/smoke.sql" "$CONTAINER_NAME:/tmp/c3-smoke.sql" >/dev/null

finished=0
i=0
state=
exit_code=
while [ "$i" -lt 180 ]; do
  state_info=$(docker_safe 10 inspect --format '{{.State.Status}}|{{.State.ExitCode}}|{{.State.Error}}' "$CONTAINER_NAME")
  state=${state_info%%|*}
  rest=${state_info#*|}
  exit_code=${rest%%|*}
  if [ "$state" = exited ]; then finished=1; break; fi
  i=$((i + 1))
  run_safe 3 sleep 1
done
[ "$finished" -eq 1 ] || { printf 'FAIL SQL smoke container did not finish within 180 seconds.\n'; exit 1; }
if docker_safe 20 cp "$CONTAINER_NAME:/tmp/c3-container-result.txt" "$OUT/container-result.txt" >/dev/null 2>&1; then
  run_safe 5 cat "$OUT/container-result.txt"
else
  printf 'FAIL could not retrieve PostgreSQL test result from disposable container.\n'
fi
[ "$exit_code" = 0 ] || { printf 'FAIL container SQL smoke exit code: %s\n' "$exit_code"; exit 1; }
printf 'PASS: all C3 run_identity SQL predicate assertions completed and transaction rolled back.\n'
printf 'NON-QUALIFICATION: SQL predicate verification only; not canonical posting, DB qualification, or identity status.\n'
printf 'Artifacts: %s/run-smoke.sh %s/predicate-tests.sql %s/run-control.sql %s/smoke.sql %s/container-result.txt\n' "$OUT" "$OUT" "$OUT" "$OUT" "$OUT"
