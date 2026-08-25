#!/bin/sh
set -eu

portable_root=$(CDPATH= cd -- "$(dirname -- "$0")/../../../../../.." && pwd)
root=${RUMIAI_COMPUTER_CONTROL_ROOT:-"$portable_root/lib/computer-control"}

required_paths="
contract/VERSION
CHANGELOG.md
contract/schemas/common.schema.json
contract/schemas/runtime-info.schema.json
contract/schemas/operation-result.schema.json
contract/schemas/set-text.params.schema.json
contract/schemas/snapshot.params.schema.json
contract/schemas/find.params.schema.json
contract/schemas/application.params.schema.json
contract/schemas/element-observation.params.schema.json
contract/schemas/describe.params.schema.json
contract/schemas/control-description.schema.json
contract/schemas/interaction.params.schema.json
contract/schemas/clipboard.params.schema.json
contract/schemas/synchronization.params.schema.json
contract/schemas/window.params.schema.json
runtime/README.md
runtime/src/server.js
runtime/src/router.js
backends/macos/README.md
backends/macos/backend.js
backends/macos/runtime/app/computer-control/index.js
backends/macos/runtime/app/computer-control/desktop/plugins/macos-current-window.js
backends/windows/README.md
backends/linux/README.md
adapters/mcp/README.md
adapters/rumiai/compat.js
scripts/install.sh
scripts/rumiai-computer-control
docs/installation.md
sdk/typescript/src/index.js
sdk/typescript/src/sync-call.js
docs/architecture.md
docs/api.md
docs/native-controls-roadmap.md
docs/versioning.md
docs/security.md
"

for relative_path in $required_paths; do
  test -f "$root/$relative_path"
done

for schema in "$root"/contract/schemas/*.json "$root"/contract/examples/*.json; do
  python3 -m json.tool "$schema" >/dev/null
done

echo "computer-control-structure=PASS"
