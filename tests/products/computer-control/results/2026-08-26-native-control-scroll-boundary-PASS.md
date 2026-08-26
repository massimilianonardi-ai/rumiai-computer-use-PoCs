# Native scroll controls — boundary result

Result: **PASS**

Product commit: `6ef8634fb3db6098438f33c0bf906549945f1348`
PoC commit tested: `25e8190c6b703a826637af44a732435efb382176`
GitHub Actions run: `32965077895`
Environment: macOS 26.5.2 arm64, Node.js `v26.7.0`

Commands:

```sh
sh tests/products/computer-control/contract-tests/check-structure.sh
"/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node" \
  --test tests/products/computer-control/contract-tests/*.test.js
```

Observed summary:

```text
computer-control-structure=PASS
tests 31
pass 31
fail 0
cancelled 0
skipped 0
todo 0
GitHub Actions product-tests=success
```

Boundary evidence only. `ui.scroll` and `ui.scrollIntoView` remain
`IMPLEMENTED`; physical macOS validation is `NOT_RUN_PHYSICALLY`.

