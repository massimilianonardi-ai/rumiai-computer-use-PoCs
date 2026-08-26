#!/bin/bash
set -u
set -o pipefail

SESSION_ID="cc-phase8a-text-selection-s01"
EXPECTED_PRODUCT_SHA="0bf774ecfe77d6924f079bf098bd429e007a1c7b"
TEST_SOURCE_SHA="5ce2dea747a78acd9cf1b0a665318d25be453263"
SESSION_REL="tests/products/computer-control/sessions/${SESSION_ID}"
LOG_REL="${SESSION_REL}/session.log"
RESULT_REL="${SESSION_REL}/session-result.json"
POC_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
PRODUCT_ROOT="${RUMIAI_COMPUTER_CONTROL_ROOT:-/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control}"
NODE="${RUMIAI_CC_NODE:-/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node}"
AGENT_CTRL="${AGENT_CTRL:-/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl}"

fail_preflight() { printf 'SESSION_PREFLIGHT=BLOCKED\n%s\n' "$1" >&2; exit 2; }
[ -n "$POC_ROOT" ] || fail_preflight "not inside the PoC git repository"
cd "$POC_ROOT" || fail_preflight "cannot enter PoC repository"
[ "$(uname -s)" = "Darwin" ] || fail_preflight "physical macOS session required"
[ -d "$PRODUCT_ROOT/.git" ] || fail_preflight "product checkout missing: $PRODUCT_ROOT"
[ -x "$NODE" ] || fail_preflight "portable Node missing: $NODE"
[ -x "$AGENT_CTRL" ] || fail_preflight "portable agent-ctrl missing: $AGENT_CTRL"
[ ! -e "$LOG_REL" ] || fail_preflight "session.log already exists; session IDs are immutable"
[ ! -e "$RESULT_REL" ] || fail_preflight "session-result.json already exists; session IDs are immutable"

git fetch origin main --quiet || fail_preflight "cannot fetch PoC origin/main"
POC_HEAD="$(git rev-parse HEAD)"
POC_REMOTE="$(git rev-parse origin/main)"
[ "$POC_HEAD" = "$POC_REMOTE" ] || fail_preflight "PoC local HEAD $POC_HEAD differs from origin/main $POC_REMOTE"
git merge-base --is-ancestor "$TEST_SOURCE_SHA" "$POC_HEAD" || fail_preflight "PoC HEAD does not descend from test-source checkpoint $TEST_SOURCE_SHA"
while IFS= read -r changed; do
  [ -z "$changed" ] && continue
  case "$changed" in
    "$SESSION_REL"/*) ;;
    *) fail_preflight "unexpected change after test-source checkpoint: $changed" ;;
  esac
done < <(git diff --name-only "$TEST_SOURCE_SHA..$POC_HEAD")
[ -z "$(git status --porcelain)" ] || fail_preflight "PoC working tree must be clean before execution"

git -C "$PRODUCT_ROOT" fetch origin main --quiet || fail_preflight "cannot fetch product origin/main"
PRODUCT_HEAD="$(git -C "$PRODUCT_ROOT" rev-parse HEAD)"
PRODUCT_REMOTE="$(git -C "$PRODUCT_ROOT" rev-parse origin/main)"
[ "$PRODUCT_HEAD" = "$EXPECTED_PRODUCT_SHA" ] || fail_preflight "product local HEAD $PRODUCT_HEAD != expected $EXPECTED_PRODUCT_SHA"
[ "$PRODUCT_REMOTE" = "$EXPECTED_PRODUCT_SHA" ] || fail_preflight "product origin/main $PRODUCT_REMOTE != expected $EXPECTED_PRODUCT_SHA"
[ -z "$(git -C "$PRODUCT_ROOT" status --porcelain)" ] || fail_preflight "product working tree must be clean before execution"

mkdir -p "$SESSION_REL"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/rumiai-${SESSION_ID}.XXXXXX")"
RESULTS_TSV="$TMP/results.tsv"
: > "$RESULTS_TSV"
STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
START_MS="$($NODE -e 'process.stdout.write(String(Date.now()))')"

{
  echo "RumiAI Computer Control physical session"
  echo "session_id=$SESSION_ID"
  echo "started_at=$STARTED_AT"
  echo "product_root=$PRODUCT_ROOT"
  echo "product_expected_sha=$EXPECTED_PRODUCT_SHA"
  echo "product_observed_sha=$PRODUCT_HEAD"
  echo "poc_root=$POC_ROOT"
  echo "test_source_sha=$TEST_SOURCE_SHA"
  echo "poc_tested_sha=$POC_HEAD"
  echo "poc_origin_main=$POC_REMOTE"
  echo "host=$(hostname)"
  echo "uname=$(uname -a)"
  echo "macos_version=$(sw_vers -productVersion 2>/dev/null || true)"
  echo "macos_build=$(sw_vers -buildVersion 2>/dev/null || true)"
  echo "node=$($NODE --version 2>&1)"
  echo "swift=$(/usr/bin/xcrun swiftc --version 2>&1 | tr '\n' ' ')"
  echo "agent_ctrl=$($AGENT_CTRL info 2>&1 | tr '\n' ' ' | head -c 2000)"
  echo
} > "$LOG_REL"

run_test() {
  local id="$1"; shift
  local command="$*"
  local safe_id="${id//[^A-Za-z0-9_.-]/_}"
  local out="$TMP/${safe_id}.stdout" err="$TMP/${safe_id}.stderr"
  local start_iso end_iso start_ms end_ms duration code result
  start_iso="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  start_ms="$($NODE -e 'process.stdout.write(String(Date.now()))')"
  /bin/bash -lc "$command" >"$out" 2>"$err"
  code=$?
  end_ms="$($NODE -e 'process.stdout.write(String(Date.now()))')"
  end_iso="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  duration=$((end_ms-start_ms))
  if grep -Eq '(^|[[:space:]])[^[:space:]=]+=BLOCKED([[:space:]]|$)' "$out" "$err"; then result="BLOCKED"
  elif grep -Eq '(^|[[:space:]])[^[:space:]=]+=FAIL([[:space:]]|$)' "$out" "$err"; then result="FAIL"
  elif [ "$code" -eq 0 ]; then result="PASS"
  else result="FAIL"
  fi
  {
    echo "================================================================================"
    echo "TEST: $id"
    echo "COMMAND: $command"
    echo "START: $start_iso"
    echo "--------------------------------------------------------------------------------"
    echo "STDOUT"
    echo "--------------------------------------------------------------------------------"
    cat "$out"
    echo
    echo "--------------------------------------------------------------------------------"
    echo "STDERR"
    echo "--------------------------------------------------------------------------------"
    cat "$err"
    echo
    echo "--------------------------------------------------------------------------------"
    echo "EXIT_CODE: $code"
    echo "DURATION_MS: $duration"
    echo "RESULT: $result"
    echo "END: $end_iso"
    echo "================================================================================"
    echo
  } >> "$LOG_REL"
  printf '%s\t%s\t%s\t%s\t%s\n' "$id" "$code" "$duration" "$result" "$command" >> "$RESULTS_TSV"
}

run_test "structure" "RUMIAI_COMPUTER_CONTROL_ROOT='$PRODUCT_ROOT' /bin/sh '$POC_ROOT/tests/products/computer-control/contract-tests/check-structure.sh'"
for test_file in "$POC_ROOT"/tests/products/computer-control/contract-tests/*.test.js; do
  id="contract:$(basename "$test_file")"
  run_test "$id" "RUMIAI_COMPUTER_CONTROL_ROOT='$PRODUCT_ROOT' '$NODE' --test '$test_file'"
done
run_test "physical:phase8a-text-selection" "AGENT_CTRL='$AGENT_CTRL' RUMIAI_COMPUTER_CONTROL_ROOT='$PRODUCT_ROOT' RUMIAI_CC_NODE='$NODE' '$NODE' '$POC_ROOT/tests/products/computer-control/physical-tests/macos-native-text-selection.js'"

ENDED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
END_MS="$($NODE -e 'process.stdout.write(String(Date.now()))')"
TOTAL_MS=$((END_MS-START_MS))

SESSION_ID="$SESSION_ID" STARTED_AT="$STARTED_AT" ENDED_AT="$ENDED_AT" TOTAL_MS="$TOTAL_MS" EXPECTED_PRODUCT_SHA="$EXPECTED_PRODUCT_SHA" PRODUCT_HEAD="$PRODUCT_HEAD" TEST_SOURCE_SHA="$TEST_SOURCE_SHA" POC_HEAD="$POC_HEAD" RESULTS_TSV="$RESULTS_TSV" RESULT_REL="$RESULT_REL" "$NODE" <<'NODE'
const fs=require('node:fs');
const rows=fs.readFileSync(process.env.RESULTS_TSV,'utf8').split(/\n/).filter(Boolean).map(line=>{const [id,exitCode,durationMs,result,...command]=line.split('\t');return{id,command:command.join('\t'),exitCode:Number(exitCode),durationMs:Number(durationMs),result};});
const summary={pass:rows.filter(x=>x.result==='PASS').length,fail:rows.filter(x=>x.result==='FAIL').length,blocked:rows.filter(x=>x.result==='BLOCKED').length,total:rows.length};
summary.overall=summary.fail?'FAIL':summary.blocked?'BLOCKED':'PASS';
const data={sessionId:process.env.SESSION_ID,startedAt:process.env.STARTED_AT,endedAt:process.env.ENDED_AT,durationMs:Number(process.env.TOTAL_MS),productShaExpected:process.env.EXPECTED_PRODUCT_SHA,productShaObserved:process.env.PRODUCT_HEAD,testSourceSha:process.env.TEST_SOURCE_SHA,pocShaTested:process.env.POC_HEAD,tests:rows,summary};
fs.writeFileSync(process.env.RESULT_REL,JSON.stringify(data,null,2)+'\n');
NODE

OVERALL="$($NODE -e "const r=require('./$RESULT_REL');process.stdout.write(r.summary.overall)")"
{
  echo "session_ended_at=$ENDED_AT"
  echo "session_duration_ms=$TOTAL_MS"
  echo "session_overall=$OVERALL"
} >> "$LOG_REL"

rm -rf "$TMP"

git add -f -- "$LOG_REL" "$RESULT_REL" || { echo "EVIDENCE_COMMIT=FAILED staging" >&2; exit 3; }
STAGED="$(git diff --cached --name-only)"
EXPECTED_STAGED="$(printf '%s\n%s\n' "$LOG_REL" "$RESULT_REL" | sort)"
[ "$(printf '%s\n' "$STAGED" | sort)" = "$EXPECTED_STAGED" ] || { git reset -- "$LOG_REL" "$RESULT_REL" >/dev/null 2>&1 || true; echo "EVIDENCE_COMMIT=BLOCKED unexpected staged files" >&2; exit 3; }

git commit -m "test: record ${SESSION_ID} evidence" >/dev/null || { echo "EVIDENCE_COMMIT=FAILED git commit" >&2; exit 3; }
EVIDENCE_COMMIT="$(git rev-parse HEAD)"
echo "EVIDENCE_COMMIT=$EVIDENCE_COMMIT"
if ! git push origin main; then
  echo "EVIDENCE_PUSH=FAILED local_commit=$EVIDENCE_COMMIT" >&2
  exit 4
fi
echo "EVIDENCE_PUSH=PASS"
echo "SESSION_RESULT=$OVERALL"
case "$OVERALL" in PASS) exit 0;; BLOCKED) exit 2;; *) exit 1;; esac
