#!/usr/bin/env sh
# Post-deploy smoke test. Usage: sh scripts/smoke.sh [https://perks.tofoapp.com]
set -u
BASE="${1:-https://perks.tofoapp.com}"
fail=0
check() { # name, url, expected status
  code=$(curl -s -o /dev/null -w '%{http_code}' "$2")
  if [ "$code" = "$3" ]; then echo "ok   $1 ($code)"; else echo "FAIL $1: got $code, want $3"; fail=1; fi
}
check "health"            "$BASE/healthz"                         200
check "home"              "$BASE/"                                200
check "privacy"           "$BASE/privacy"                         200
check "unknown page"      "$BASE/nope"                            404
check "stale embedded url" "$BASE/nope?shop=x.myshopify.com"      302
exit $fail
