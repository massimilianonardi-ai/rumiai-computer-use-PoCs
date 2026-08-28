"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const {decodePng,largestComponent} = require("./helpers/png-raster");

const pocRoot = path.resolve(__dirname, "../../..");
const productRoot = process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot, "RUMIAI_COMPUTER_USE_ROOT required");

const perceptionSource = fs.readFileSync(path.join(productRoot,"app","perception.js"),"utf8");
const docs = fs.readFileSync(path.join(productRoot,"docs","perception.md"),"utf8");
const harness = fs.readFileSync(path.join(__dirname,"physical-tests","perception-p1b-coordinate-mapping-discovery.js"),"utf8");
const fixture = fs.readFileSync(path.join(__dirname,"physical-tests","helpers","macos-perception-p1b-marker-fixture.swift"),"utf8");

assert.match(docs,/P1A[\s\S]*PHYSICALLY_VALIDATED/);
assert.match(docs,/P1B[\s\S]*PENDING_PHYSICAL_DISCOVERY/);
assert.match(docs,/equality of capture and display dimensions alone is not sufficient evidence/i);
assert.match(perceptionSource,/actionCoordinateMapping:\s*\{[\s\S]*state:"UNRESOLVED"/);
assert.doesNotMatch(perceptionSource,/resolvePrimaryActionCoordinateMapping|mapCapturePointToPrimaryLogical/);

assert.match(harness,/computerControl\.listDisplays\(\)/);
assert.match(harness,/perception\.acquirePrimaryVisualFrame\(\)/);
assert.match(harness,/stableDisplay\(before, after\)/);
assert.match(harness,/largestComponent/);
assert.match(harness,/pixelToLogicalX\s*=\s*logicalWidth\s*\/\s*pixelWidth/);
assert.match(harness,/pixelToLogicalY\s*=\s*logicalHeight\s*\/\s*pixelHeight/);
assert.match(harness,/identityAssumed=false/);
assert.match(harness,/mappingState=UNRESOLVED/);
assert.doesNotMatch(harness,/movePointer\(|clickPointer\(|dragPointer\(|wheelPointer\(|pressKey\(/);
assert.match(fixture,/ignoresMouseEvents\s*=\s*true/);
assert.match(fixture,/marker\.y/);
assert.match(fixture,/screenFrame\.maxY\s*-\s*marker\.y\s*-\s*marker\.height/);

function chunk(type,data){const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);out.write(type,4,"ascii");data.copy(out,8);out.writeUInt32BE(0,8+data.length);return out;}
const signature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(2,4);ihdr[8]=8;ihdr[9]=2;
const raw=Buffer.from([
  0, 255,0,255, 0,0,0,
  0, 0,255,255, 0,0,0,
]);
const png=Buffer.concat([signature,chunk("IHDR",ihdr),chunk("IDAT",zlib.deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]);
const raster=decodePng(png);
assert.deepEqual(raster.pixel(0,0),{r:255,g:0,b:255,a:255},"PNG row zero must be top capture row");
assert.deepEqual(raster.pixel(0,1),{r:0,g:255,b:255,a:255},"PNG row one must remain below row zero");
const magenta=largestComponent(raster,p=>p.r>200&&p.g<50&&p.b>200);
assert.deepEqual(magenta,{area:1,x:0,y:0,width:1,height:1});

console.log("perception-p1b-coordinate-mapping-discovery-contract=PASS");
