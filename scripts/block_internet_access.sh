#!/bin/bash
# Blocks WAN access for the Pod, keeps LAN + NTP working, and makes the block survive reboots.
#
# Options (environment variables, remembered for later runs such as the re-block after an update):
#   ALLOW_SENTRY=true   Allow error logs to reach Sentry's ingestion servers (default: blocked)
#
# Usage:
#   sh block_internet_access.sh                 Apply, save and persist the rules
#   sh block_internet_access.sh --print-rules   Only print the rules that would be applied
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/firewall_common.sh"

PRINT_RULES_ONLY=false
if [ "${1:-}" = "--print-rules" ]; then
  PRINT_RULES_ONLY=true
fi

ALLOW_SENTRY=$(resolve_firewall_option ALLOW_SENTRY false)

# https://docs.sentry.io/security-legal-pii/security/ip-ranges/#event-ingestion
SENTRY_INGESTION_IPS="35.186.247.156 34.120.195.249 34.36.122.224 34.36.87.148 34.120.62.213 130.211.36.74"
PRIVATE_IPV4_RANGES="10.0.0.0/8 172.16.0.0/12 192.168.0.0/16"
PRIVATE_IPV6_RANGES="fe80::/10 fd00::/8"

# Prints the IPv4 ruleset in iptables-restore format. Loading it replaces the whole filter table
# in one step, so re-running this script never duplicates rules or leaves a half-open window.
build_ipv4_rules() {
  echo "*filter"
  echo ":INPUT ACCEPT [0:0]"
  echo ":FORWARD ACCEPT [0:0]"
  echo ":OUTPUT ACCEPT [0:0]"
  # NTP keeps the system clock (and therefore schedules) correct
  echo "-A INPUT -p udp --sport 123 -j ACCEPT"
  echo "-A OUTPUT -p udp --dport 123 -j ACCEPT"
  # Loopback lets local services talk to each other
  echo "-A INPUT -i lo -j ACCEPT"
  echo "-A OUTPUT -o lo -j ACCEPT"
  for private_range in $PRIVATE_IPV4_RANGES; do
    echo "-A INPUT -s $private_range -j ACCEPT"
    echo "-A OUTPUT -d $private_range -j ACCEPT"
  done
  if [ "$ALLOW_SENTRY" = "true" ]; then
    echo "-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT"
    for sentry_ip in $SENTRY_INGESTION_IPS; do
      echo "-A OUTPUT -d $sentry_ip -j ACCEPT"
    done
  fi
  echo "-A INPUT -j DROP"
  echo "-A OUTPUT -j DROP"
  echo "COMMIT"
}

# Prints the IPv6 ruleset in ip6tables-restore format.
build_ipv6_rules() {
  echo "*filter"
  echo ":INPUT ACCEPT [0:0]"
  echo ":FORWARD ACCEPT [0:0]"
  echo ":OUTPUT ACCEPT [0:0]"
  echo "-A INPUT -p udp --sport 123 -j ACCEPT"
  echo "-A OUTPUT -p udp --dport 123 -j ACCEPT"
  echo "-A INPUT -i lo -j ACCEPT"
  echo "-A OUTPUT -o lo -j ACCEPT"
  for private_range in $PRIVATE_IPV6_RANGES; do
    echo "-A INPUT -s $private_range -j ACCEPT"
    echo "-A OUTPUT -d $private_range -j ACCEPT"
  done
  echo "-A INPUT -j DROP"
  echo "-A OUTPUT -j DROP"
  echo "COMMIT"
}

if [ "$PRINT_RULES_ONLY" = "true" ]; then
  echo "# IPv4"
  build_ipv4_rules
  echo "# IPv6"
  build_ipv6_rules
  exit 0
fi

echo "Blocking internet access..."
if [ "$ALLOW_SENTRY" = "true" ]; then
  printf '\033[33m%s\033[0m\n' "Sentry servers are allowed (ALLOW_SENTRY=true)."
  printf '\033[33m%s\033[0m\n' "Error logs are only sent if error logging is enabled in the UI (off by default)."
  printf '\033[33m%s\033[0m\n' "To block Sentry again, run: 'ALLOW_SENTRY=false sh scripts/block_internet_access.sh'"
else
  echo "Sentry servers are blocked. To allow error logs, run: 'ALLOW_SENTRY=true sh scripts/block_internet_access.sh'"
fi

echo "Updating the timesyncd config"
cat > "$TIMESYNCD_CONFIG" <<EOF
[Time]
NTP=pool.ntp.org 0.pool.ntp.org 1.pool.ntp.org 2.pool.ntp.org 3.pool.ntp.org
FallbackNTP=time1.google.com time2.google.com time3.google.com time4.google.com
RootDistanceMaxSec=5
PollIntervalMinSec=32
PollIntervalMaxSec=2048
EOF
systemctl restart systemd-timesyncd || echo "WARNING: Unable to restart systemd-timesyncd" >&2

# Write the rules files first and load the live rules from them, so what runs now is
# exactly what gets restored at boot.
mkdir -p "$FIREWALL_RULES_DIR"
echo "Configuring IPv4 rules..."
build_ipv4_rules > "$FIREWALL_RULES_V4"
iptables-restore < "$FIREWALL_RULES_V4"

echo "Configuring IPv6 rules..."
build_ipv6_rules > "$FIREWALL_RULES_V6"
ip6tables-restore < "$FIREWALL_RULES_V6"

save_firewall_option ALLOW_SENTRY "$ALLOW_SENTRY"

# Restore the rules on every boot
sh "$SCRIPT_DIR/setup_firewall_service.sh"

echo "Blocked WAN internet access successfully!"
