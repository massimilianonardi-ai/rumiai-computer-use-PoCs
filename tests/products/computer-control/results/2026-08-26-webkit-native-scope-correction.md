# Scope correction — Safari/WebKit evidence is not AppKit validation

Status: **CORRECTED_SCOPE**

The physical results previously recorded on 2026-08-26 for Phase 3–7 used HTML/ARIA controls hosted by Safari. Those runs remain valid evidence that the Computer Control semantics can interact with controls exposed by WebKit through macOS Accessibility, but browser document controls are outside the native Cocoa/AppKit milestone.

The prior PASS/FAIL files are intentionally preserved unchanged as historical evidence. They must not be interpreted as `PHYSICALLY_VALIDATED` evidence for native AppKit controls.

Product correction baseline: `5ab34056030c7fa89a2d845124c4c4beee92a7c1` and later native-backend corrections.

Native revalidation must use a Cocoa/AppKit fixture or another unambiguously native macOS application surface. Until then Phase 3–7 capabilities remain `IMPLEMENTED`.
