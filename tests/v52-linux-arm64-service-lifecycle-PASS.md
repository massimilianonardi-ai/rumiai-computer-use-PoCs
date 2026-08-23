# v52 — Linux ARM64 service lifecycle test

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on Ubuntu 26.04 ARM64

## Test

```text
git pull
./cmd/srv-start ollama
echo "start_exit=$?"
sleep 1
curl -fsS http://127.0.0.1:11434/api/version
echo
echo "api_exit=$?"
cat run/ollama.pid
ps -p "$(cat run/ollama.pid)" -o pid=,comm=
./cmd/srv-stop ollama
echo "stop_exit=$?"
sleep 1
curl -fsS http://127.0.0.1:11434/api/version
echo "after_stop_exit=$?"
```

## Observed result

```text
srv-start: starting SERVER 'ollama' PID=49276 owner=48290
start_exit=0
{"version":"0.32.15"}
api_exit=0
49276
  49276 ollama
srv-stop: stopping SERVER 'ollama' PID=49276
srv-stop: SERVER 'ollama' stopped
stop_exit=0
curl: (7) Failed to connect to 127.0.0.1 port 11434 after 0 ms: Could not connect to server
after_stop_exit=7
```

## Validation

- POSIX `srv-start` execution on Linux ARM64: PASS
- Ollama process launch and PID tracking: PASS
- Ollama API readiness after start: PASS (`0.32.15`)
- POSIX `srv-stop` execution on Linux ARM64: PASS
- Process/API unavailable after stop: PASS (`curl` exit 7)

The existing service lifecycle wrappers require no Linux-specific changes for Ubuntu ARM64.