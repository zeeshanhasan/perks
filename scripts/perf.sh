#!/bin/sh
# Times the live public pages, split into network and server parts.
#   sh scripts/perf.sh                    # perks.tofoapp.com, 5 runs each
#   BASE=https://dev-perks.tofoapp.com RUNS=3 sh scripts/perf.sh
#
# "wait" = time from the request being sent to the first byte back: our server plus
# Cloudflare/Railway in between. It's the part we control; the budget is 300 ms.
# The embedded app pages (/app/*) need a Shopify session, so they're measured from the
# server's own log lines instead:  railway logs | grep "\[perks\] timing"

BASE="${BASE:-https://perks.tofoapp.com}"
RUNS="${RUNS:-5}"
BUDGET_MS="${BUDGET_MS:-300}"
fail=0

printf "%-14s %8s %8s %8s %8s  %s\n" page connect tls wait total "(median of $RUNS, ms)"
for path in /healthz / /privacy /terms /llms.txt; do
  lines=""
  i=0
  while [ "$i" -lt "$RUNS" ]; do
    lines="$lines$(curl -s -o /dev/null -w '%{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total}' "$BASE$path")
"
    i=$((i + 1))
  done
  # Median of each column, in ms.
  med() { printf "%s" "$lines" | awk -v c="$1" 'NF{print $c*1000}' | sort -n | awk '{a[NR]=$1} END{printf "%d", a[int((NR+1)/2)]}'; }
  connect=$(med 1); tls=$(med 2); ttfb=$(med 3); total=$(med 4)
  wait=$((ttfb - tls))
  flag=""
  if [ "$wait" -gt "$BUDGET_MS" ]; then flag="  over ${BUDGET_MS}ms"; fail=1; fi
  printf "%-14s %8s %8s %8s %8s%s\n" "$path" "$connect" "$tls" "$wait" "$total" "$flag"
done
exit $fail
