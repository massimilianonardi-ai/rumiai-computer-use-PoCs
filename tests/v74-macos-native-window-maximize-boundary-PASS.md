# v74 macOS Native Window Maximize Boundary — PASS

Date: 2026-08-25
Platform: physical macOS host
Status: PASS

Command executed:

```sh
./bin/nodejs/bin/node app/window-maximize-native-boundary-test.js
echo "boundary_exit=$?"
```

Exact output:

```text
required Swift helper compile: PASS
required AX application resolution: PASS
required AX windows enumeration: PASS
required exact title matching: PASS
required missing target failure: PASS
required ambiguous target failure: PASS
required AX position observation: PASS
required AX size observation: PASS
required bounds settable checks: PASS
required native bounds mutation: PASS
required visible screen frame: PASS
required AX coordinate conversion: PASS
required observe maximize set modes: PASS
forbidden keyboard shortcut: PASS
forbidden AppleScript: PASS
forbidden full-screen mutation: PASS
required production maximize capability deferred: PASS
required production maximizeWindow unsupported: PASS
forbidden premature public maximizeWindow facade: PASS
native-window-maximize-boundary=PASS
boundary_exit=0
```

Conclusion: the v74 native maximize boundary is satisfied. Physical bounds mutation remains pending and is not claimed by this result.
