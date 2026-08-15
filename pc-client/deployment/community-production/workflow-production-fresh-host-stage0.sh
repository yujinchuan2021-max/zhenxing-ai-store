#!/bin/bash
set -euo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C
unset APT_CONFIG http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
LOGIN_USER='admin'
HOST='47.236.62.189'
HOST_KEY_FINGERPRINT='SHA256:q4aNRJbw9Pday5Wfq9W1bVErTe1b4Yz6nn7aM+gLDrI'
ADMIN_USER='admin'
ADMIN_UID='1000'
ADMIN_GID='1000'
APT_PACKAGES=(bash ca-certificates coreutils docker-compose-v2 docker.io iproute2 openssl util-linux)
DIRECTORIES=(
  /opt/zhenxing-ai /opt/zhenxing-ai/releases /opt/zhenxing-ai/staging /opt/zhenxing-ai/shared
  /opt/zhenxing-ai/shared/backups /opt/zhenxing-ai/shared/admin/data
  /opt/zhenxing-ai/shared/admin/published /opt/zhenxing-ai/shared/admin/output
  /opt/zhenxing-ai/shared/data/identity-postgres /opt/zhenxing-ai/shared/data/community-mariadb
  /opt/zhenxing-ai/shared/data/community-config /opt/zhenxing-ai/shared/data/community-storage
  /opt/zhenxing-ai/shared/data/community-assets
  /opt/zhenxing-ai/shared/secrets/community-production
  /opt/zhenxing-ai/shared/secrets/workflow-production
)

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ $# -eq 1 ]] || fail FRESH_HOST_ARGUMENT_INVALID
case "$1" in preflight|apply|verify) phase="$1" ;; *) fail FRESH_HOST_ARGUMENT_INVALID ;; esac
printf '%s\n' '@@AIHUB_FRESH_HOST_STAGE0_V1@@'
[[ "${EUID:-$(id -u)}" == 0 ]] || fail FRESH_HOST_ROOT_REQUIRED
[[ "$LOGIN_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ && "$LOGIN_USER" != *REQUIRED* ]] || fail FRESH_HOST_LOGIN_IDENTITY_NOT_FROZEN
[[ "${SUDO_USER:-root}" == "$LOGIN_USER" || "$(id -un)" == "$LOGIN_USER" ]] || fail FRESH_HOST_LOGIN_IDENTITY_DRIFT

source /etc/os-release
[[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 ]] || fail FRESH_HOST_OS_DRIFT
[[ "$(uname -m)" == x86_64 && "$(ps -p 1 -o comm= | tr -d ' ')" == systemd ]] || fail FRESH_HOST_PLATFORM_DRIFT
kernel="$(uname -r | cut -d- -f1)"
glibc="$(getconf GNU_LIBC_VERSION | awk '{print $2}')"
dpkg --compare-versions "$kernel" ge 5.15 || fail FRESH_HOST_KERNEL_DRIFT
dpkg --compare-versions "$glibc" ge 2.35 || fail FRESH_HOST_GLIBC_DRIFT
[[ "$(nproc)" -ge 2 ]] || fail FRESH_HOST_CPU_UNDERSIZED
read -r _ total_kib _ available_kib _ < <(df -Pk /opt 2>/dev/null | awk 'NR==2 {print $1,$2,$3,$4,$5}')
[[ "$total_kib" =~ ^[0-9]+$ && "$available_kib" =~ ^[0-9]+$ && "$total_kib" -ge 47185920 && "$available_kib" -ge 31457280 ]] || fail FRESH_HOST_DISK_UNDERSIZED

for conflict in docker-ce docker-ce-cli containerd.io podman-docker; do
  dpkg-query -W -f='${Status}' "$conflict" 2>/dev/null | grep -Fxq 'install ok installed' && fail FRESH_HOST_PACKAGE_CONFLICT
done
package_count=0
for package in "${APT_PACKAGES[@]}"; do
  dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -Fxq 'install ok installed' && package_count=$((package_count+1))
done
docker_package_count=0
for package in docker-compose-v2 docker.io; do
  dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -Fxq 'install ok installed' && docker_package_count=$((docker_package_count+1))
done
[[ "$docker_package_count" == 0 || "$docker_package_count" == 2 ]] || fail FRESH_HOST_PACKAGE_CONFLICT

admin_exact=0
if getent passwd "$ADMIN_USER" >/dev/null || getent passwd "$ADMIN_UID" >/dev/null || getent group "$ADMIN_USER" >/dev/null || getent group "$ADMIN_GID" >/dev/null; then
  [[ "$(getent passwd "$ADMIN_USER")" == "$ADMIN_USER:x:$ADMIN_UID:$ADMIN_GID:"* &&
     "$(getent passwd "$ADMIN_UID")" == "$ADMIN_USER:x:$ADMIN_UID:$ADMIN_GID:"* &&
     "$(getent group "$ADMIN_USER")" == "$ADMIN_USER:x:$ADMIN_GID:"* &&
     "$(getent group "$ADMIN_GID")" == "$ADMIN_USER:x:$ADMIN_GID:"* ]] || fail FRESH_HOST_IDENTITY_CONFLICT
  admin_exact=1
fi

directory_count=0
for directory in "${DIRECTORIES[@]}"; do [[ -e "$directory" || -L "$directory" ]] && directory_count=$((directory_count+1)); done
[[ "$directory_count" == 0 || "$directory_count" == "${#DIRECTORIES[@]}" ]] || fail FRESH_HOST_DIRECTORY_CONFLICT
if [[ "$directory_count" != 0 ]]; then
  for directory in "${DIRECTORIES[@]}"; do [[ -d "$directory" && ! -L "$directory" ]] || fail FRESH_HOST_DIRECTORY_CONFLICT; done
fi

port_is_listening() {
  local hexadecimal
  printf -v hexadecimal '%04X' "$1"
  awk -v suffix=":$hexadecimal" 'NR > 1 && $4 == "0A" && substr($2, length($2) - 4) == suffix { found=1 } END { exit(found ? 0 : 1) }' \
    /proc/net/tcp /proc/net/tcp6
}
for port in 80 443 4173 4174; do port_is_listening "$port" && fail FRESH_HOST_PORT_CONFLICT; done
for host in zhenxingai.com community.zhenxingai.com; do
  getent ahostsv4 "$host" | awk -v ip="$HOST" '$1 == ip { found=1 } END { exit(found ? 0 : 1) }' || fail FRESH_HOST_DNS_DRIFT
done

verify_installed() {
  [[ "$admin_exact" == 1 && "$package_count" == "${#APT_PACKAGES[@]}" && "$directory_count" == "${#DIRECTORIES[@]}" ]] || fail FRESH_HOST_PARTIAL_INSTALL
  [[ "$(stat -c '%u:%g:%a:%h' /opt/zhenxing-ai)" == '0:0:755:2' || "$(stat -c '%u:%g:%a' /opt/zhenxing-ai)" == '0:0:755' ]] || fail FRESH_HOST_DIRECTORY_CONFLICT
  for directory in "${DIRECTORIES[@]:1}"; do
    [[ "$(stat -c '%u:%g' "$directory")" == "$ADMIN_UID:$ADMIN_GID" ]] || fail FRESH_HOST_DIRECTORY_CONFLICT
  done
  [[ "$(stat -c '%a' /opt/zhenxing-ai/shared/backups)" == 700 ]] || fail FRESH_HOST_DIRECTORY_CONFLICT
  [[ "$(stat -c '%a' /opt/zhenxing-ai/shared/secrets/community-production)" == 700 ]] || fail FRESH_HOST_DIRECTORY_CONFLICT
  [[ "$(stat -c '%a' /opt/zhenxing-ai/shared/secrets/workflow-production)" == 700 ]] || fail FRESH_HOST_DIRECTORY_CONFLICT
  systemctl is-enabled --quiet docker || fail FRESH_HOST_DOCKER_NOT_READY
  systemctl is-active --quiet docker || fail FRESH_HOST_DOCKER_NOT_READY
  docker info >/dev/null || fail FRESH_HOST_DOCKER_NOT_READY
  docker info --format '{{json .SecurityOptions}}' | grep -Fq 'name=rootless' && fail FRESH_HOST_DOCKER_NOT_ROOTFUL
  docker_version="$(docker version --format '{{.Server.Version}}')"
  compose_version="$(docker compose version --short)"
  dpkg --compare-versions "$docker_version" ge 26 || fail FRESH_HOST_DOCKER_VERSION_DRIFT
  dpkg --compare-versions "$compose_version" ge 2 || fail FRESH_HOST_COMPOSE_VERSION_DRIFT
}

case "$phase" in
  preflight)
    if [[ "$package_count" == "${#APT_PACKAGES[@]}" && "$directory_count" == "${#DIRECTORIES[@]}" ]]; then verify_installed
    else [[ "$docker_package_count" == 0 && "$directory_count" == 0 ]] || fail FRESH_HOST_PARTIAL_INSTALL; fi
    ;;
  apply)
    if [[ "$admin_exact" == 1 && "$package_count" == "${#APT_PACKAGES[@]}" && "$directory_count" == "${#DIRECTORIES[@]}" ]]; then verify_installed; exit 0; fi
    [[ "$docker_package_count" == 0 && "$directory_count" == 0 ]] || fail FRESH_HOST_PARTIAL_INSTALL
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${APT_PACKAGES[@]}"
    if [[ "$admin_exact" == 0 ]]; then
      groupadd --gid 1000 admin
      useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash admin
    fi
    install -d -m 0755 -o root -g root /opt/zhenxing-ai
    for directory in "${DIRECTORIES[@]:1}"; do install -d -m 0755 -o 1000 -g 1000 "$directory"; done
    chmod 0700 /opt/zhenxing-ai/shared/backups /opt/zhenxing-ai/shared/secrets/community-production /opt/zhenxing-ai/shared/secrets/workflow-production
    systemctl enable --now docker
    package_count="${#APT_PACKAGES[@]}"
    docker_package_count=2
    admin_exact=1
    directory_count="${#DIRECTORIES[@]}"
    verify_installed
    ;;
  verify) verify_installed ;;
esac
printf '%s\n' '{"schema":"aihub-workflow-production-fresh-host-stage0-v1","status":"pass","eligibleForTransfer":true,"prepareAuthorized":false,"launchAuthorized":false}'
