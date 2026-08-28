#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=__dirname;
const harness=fs.readFileSync(path.join(root,"physical-tests","perception-p2a-local-ocr-discovery.js"),"utf8");
const helper=fs.readFileSync(path.join(root,"physical-tests","helpers","macos-perception-p2a-vision-ocr.swift"),"utf8");
const fixture=fs.readFileSync(path.join(root,"physical-tests","helpers","macos-perception-p2a-text-fixture.swift"),"utf8");

assert.match(helper,/import Vision/);
assert.match(helper,/VNRecognizeTextRequest/);
assert.match(helper,/recognitionLevel\s*=\s*\.accurate/);
assert.match(helper,/FileHandle\.standardInput\.readDataToEndOfFile/);
assert.match(helper,/y:\(1\.0-b\.maxY\)\*Double\(height\)/);
assert.doesNotMatch(helper,/URLSession|Network|NWConnection|http:\/\/|https:\/\//);
assert.doesNotMatch(helper,/write\(to:|FileManager|temporaryDirectory/);

assert.match(fixture,/RUMIAI ALPHA 731/);
assert.match(fixture,/RUMIAI BETA 942/);
assert.match(fixture,/ignoresMouseEvents=true/);
assert.match(harness,/acquireMappedPrimaryVisualFrame\(\)/);
assert.match(harness,/mapCapturePointToPrimaryLogical/);
assert.match(harness,/provider=macos-vision local=true networkUsed=false/);
assert.match(harness,/semanticIdentityClaimed=false/);
assert.match(harness,/textLogged=false/);
assert.match(harness,/persisted=false/);
assert.match(harness,/shutdownRuntime\(\)/);
assert.doesNotMatch(harness,/movePointer\(|clickPointer\(|dragPointer\(|wheelPointer\(|pressKey\(/);
assert.doesNotMatch(harness,/https?:\/\//);

console.log("perception-p2a-local-ocr-discovery-contract=PASS");
