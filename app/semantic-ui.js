"use strict";

const { find } = require("./computer-control");

const EDITABLE_ROLES = new Set(["search-box", "text-field", "text-area", "textarea", "combobox"]);
const DIRECT_CLICK_ROLES = new Set([
  "button", "radio", "checkbox", "menu-item", "link",
  "cell", "text-field", "search-box", "combobox"
]);

function snapshotForModel(snapshot) {
  // Refs are execution details. The LLM reasons over semantics only.
  return String(snapshot || "")
    .split("\n")
    .map(line => line.replace(/@(?:e|s)\d+\s+/g, ""))
    .join("\n");
}

let lastParsedSnapshotText = null;
let lastParsedSnapshotNodes = null;

function parseSnapshot(snapshot) {
  const text = String(snapshot || "");
  if (text === lastParsedSnapshotText && lastParsedSnapshotNodes) {
    return lastParsedSnapshotNodes;
  }

  const nodes = [];
  const stack = [];

  for (const raw of text.split("\n")) {
    if (!raw.trim() || raw.startsWith("#")) continue;

    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    const m = raw.match(/^\s*(?:(@(?:e|s)\d+)\s+)?([^\s]+)(?:\s+"([^"]*)")?/);
    if (!m) continue;

    const ref = m[1] || null;
    const role = m[2] || "";
    const name = m[3] || "";
    const disabled = /\[disabled\]/.test(raw);
    const selected = /\[selected\]/.test(raw);
    const focused = /\[focused\]/.test(raw);

    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack.length ? stack[stack.length - 1] : null;

    const node = {
      indent, ref, role, name, disabled, selected, focused,
      parent,
      raw
    };
    nodes.push(node);
    stack.push(node);
  }

  lastParsedSnapshotText = text;
  lastParsedSnapshotNodes = nodes;
  return nodes;
}

function normText(x) {
  return String(x || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    // Visually equivalent Unicode dashes are common in localized macOS labels
    // (for example Wi‑Fi uses a non-ASCII hyphen). Collapse them so semantic
    // resolution compares meaning rather than typography.
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSemanticTarget(snapshot, target, roleHint, kind, app = null) {
  const wanted = normText(target);
  if (!wanted) {
    return { ok: false, error: "empty semantic target" };
  }

  const nodes = parseSnapshot(snapshot);
  let candidates = [];
  let locatorMethod = null;
  let locatorDetail = null;

  // Primary generic locator through the RumiAI Computer Control boundary.
  // The resolver never calls agent-ctrl directly.
  if (app) {
    const located = find({
      app,
      query:String(target),
      role:roleHint || null,
      first:true,
      snapshot,
    });

    if (located.ok) {
      const byRef = nodes.find(n =>
        n.ref === located.ref &&
        !n.disabled
      );

      if (byRef) {
        candidates = [byRef];
        locatorMethod = "computer-control.find";
        locatorDetail = located.method;
      }
    }
  }

  if (!app && !candidates.length) {
    candidates = nodes.filter(n =>
      n.ref &&
      n.ref.startsWith("@e") &&
      !n.disabled &&
      n.name &&
      normText(n.name) === wanted
    );

    if (!candidates.length) {
      candidates = nodes.filter(n =>
        n.ref &&
        n.ref.startsWith("@e") &&
        !n.disabled &&
        n.name &&
        normText(n.name).includes(wanted)
      );
    }

    if (candidates.length) {
      locatorMethod = "legacy-snapshot-no-app";
      locatorDetail = "no application identity supplied";
    }
  }

  if (roleHint) {
    const byRole = candidates.filter(n => normText(n.role) === normText(roleHint));
    if (byRole.length) candidates = byRole;
  } else if (kind === "FILL" || kind === "FOCUS") {
    const editable = candidates.filter(n => EDITABLE_ROLES.has(n.role));
    if (editable.length) candidates = editable;
  }

  if (!candidates.length) {
    return { ok: false, error: `no semantic match for "${target}"` };
  }

  let chosen = candidates[0];
  const matched = chosen;

  // For navigation clicks, AX often exposes the visible text as a child
  // "region" while the enclosing "cell" is the real row action target.
  // Promote only for CLICK-like actions, never for editable fields.
  if (kind === "CLICK") {
    if (!DIRECT_CLICK_ROLES.has(chosen.role)) {
      let a = chosen.parent;
      while (a) {
        if (
          a.ref &&
          a.ref.startsWith("@e") &&
          !a.disabled &&
          (a.role === "cell" || a.role === "row")
        ) {
          chosen = a;
          break;
        }
        a = a.parent;
      }
    }
  }

  return {
    ok:true,
    ref:chosen.ref,
    role:chosen.role,
    label:matched.name,
    matchedRef:matched.ref,
    matchedRole:matched.role,
    promoted:chosen.ref !== matched.ref,
    method:
      chosen.ref !== matched.ref
        ? `${locatorMethod || "snapshot-semantic"} + hierarchy-promotion`
        : (locatorMethod || "snapshot-semantic"),
    locatorDetail,
  };
}

function findEditableControl(snapshot) {
  const nodes = parseSnapshot(snapshot).filter(n =>
    n.ref && n.ref.startsWith("@e") && !n.disabled
  );

  const focused = nodes.find(n => n.focused && EDITABLE_ROLES.has(n.role));
  if (focused) return focused;

  const nonSearch = nodes.find(n =>
    EDITABLE_ROLES.has(n.role) &&
    n.role !== "search-box" &&
    !/\b(cerca|search|ricerca|address|indirizz)\b/i.test(n.name || "")
  );
  if (nonSearch) return nonSearch;

  return nodes.find(n => EDITABLE_ROLES.has(n.role)) || null;
}

function findSearchControl(snapshot) {
  const nodes = parseSnapshot(snapshot).filter(n =>
    n.ref && n.ref.startsWith("@e") && !n.disabled
  );

  const searchBoxes = nodes.filter(n => n.role === "search-box");
  if (searchBoxes.length) return searchBoxes[0];

  const namedFields = nodes.filter(n =>
    (n.role === "text-field" || n.role === "combobox") &&
    /\b(cerca|search|ricerca)\b/i.test(n.name || "")
  );
  if (namedFields.length) return namedFields[0];

  const anyField = nodes.filter(n =>
    n.role === "text-field" || n.role === "combobox"
  );
  return anyField[0] || null;
}

function semanticTargetSelected(snapshot, target) {
  const wanted = normText(target);
  if (!wanted) return false;

  const nodes = parseSnapshot(snapshot);
  const matches = nodes.filter(n =>
    n.name && normText(n.name) === wanted
  );

  for (const n of matches) {
    if (n.selected) return true;
    let p = n.parent;
    while (p) {
      if (p.selected) return true;
      p = p.parent;
    }
  }
  return false;
}


function isInsideChrome(node) {
  let p = node.parent;
  while (p) {
    if (
      p.role === "toolbar" ||
      p.role === "tab-list" ||
      p.role === "menubar" ||
      p.role === "menu"
    ) return true;
    p = p.parent;
  }
  return false;
}

function resultCandidates(snapshot) {
  const nodes = parseSnapshot(snapshot);

  // Primary representation for web/search results: accessible links in document
  // content, excluding browser chrome/toolbars.
  let links = nodes.filter(n =>
    n.ref &&
    n.ref.startsWith("@e") &&
    !n.disabled &&
    n.role === "link" &&
    n.name &&
    !isInsideChrome(n)
  );

  if (links.length) return links;

  // Fallback for result UIs exposed as buttons/cells instead of AX links.
  return nodes.filter(n =>
    n.ref &&
    n.ref.startsWith("@e") &&
    !n.disabled &&
    n.name &&
    !isInsideChrome(n) &&
    (n.role === "button" || n.role === "cell")
  );
}


module.exports = {
  snapshotForModel,
  parseSnapshot,
  normText,
  resolveSemanticTarget,
  findEditableControl,
  findSearchControl,
  semanticTargetSelected,
  isInsideChrome,
  resultCandidates,
};
