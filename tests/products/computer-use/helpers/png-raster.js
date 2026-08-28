"use strict";

const zlib = require("node:zlib");

const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

function paeth(a,b,c) {
  const p = a + b - c;
  const pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0,8).equals(PNG_SIGNATURE)) {
    throw new Error("PNG_SIGNATURE_INVALID");
  }
  let offset = 8;
  let ihdr = null;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset); offset += 4;
    const type = buffer.toString("ascii", offset, offset+4); offset += 4;
    if (offset + length + 4 > buffer.length) throw new Error("PNG_CHUNK_TRUNCATED");
    const data = buffer.subarray(offset, offset+length); offset += length;
    offset += 4; // CRC is covered by Computer Control's canonical PNG boundary; this decoder is test-only.
    if (type === "IHDR") ihdr = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
  }
  if (!ihdr || ihdr.length !== 13 || idat.length === 0) throw new Error("PNG_STRUCTURE_INVALID");
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8], colorType = ihdr[9], compression = ihdr[10], filterMethod = ihdr[11], interlace = ihdr[12];
  if (!width || !height || bitDepth !== 8 || ![2,6].includes(colorType) || compression !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error(`PNG_FORMAT_UNSUPPORTED bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  if (inflated.length !== height * (stride + 1)) throw new Error("PNG_SCANLINE_LENGTH_INVALID");
  const pixels = Buffer.alloc(width * height * bpp);
  let src = 0;
  for (let y=0; y<height; y++) {
    const filter = inflated[src++];
    const rowStart = y * stride;
    const prevStart = (y-1) * stride;
    for (let x=0; x<stride; x++) {
      const raw = inflated[src++];
      const left = x >= bpp ? pixels[rowStart + x - bpp] : 0;
      const up = y > 0 ? pixels[prevStart + x] : 0;
      const upLeft = y > 0 && x >= bpp ? pixels[prevStart + x - bpp] : 0;
      let value;
      switch (filter) {
        case 0: value = raw; break;
        case 1: value = raw + left; break;
        case 2: value = raw + up; break;
        case 3: value = raw + Math.floor((left + up) / 2); break;
        case 4: value = raw + paeth(left, up, upLeft); break;
        default: throw new Error(`PNG_FILTER_UNSUPPORTED ${filter}`);
      }
      pixels[rowStart + x] = value & 255;
    }
  }
  return {
    width, height, colorType, bpp, pixels,
    pixel(x,y) {
      if (!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height) return null;
      const i = (y*width+x)*bpp;
      return {r:pixels[i],g:pixels[i+1],b:pixels[i+2],a:bpp===4?pixels[i+3]:255};
    },
  };
}

function largestComponent(raster, predicate) {
  const {width,height} = raster;
  const visited = new Uint8Array(width*height);
  let best = null;
  const queue = [];
  for (let y=0; y<height; y++) {
    for (let x=0; x<width; x++) {
      const start = y*width+x;
      if (visited[start]) continue;
      const p = raster.pixel(x,y);
      if (!predicate(p)) { visited[start]=1; continue; }
      visited[start]=1;
      queue.length=0; queue.push(start);
      let head=0, area=0, minX=x, maxX=x, minY=y, maxY=y;
      while (head<queue.length) {
        const idx=queue[head++], cy=Math.floor(idx/width), cx=idx-cy*width;
        area++; if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;
        const neighbors=[[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
        for (const [nx,ny] of neighbors) {
          if(nx<0||ny<0||nx>=width||ny>=height) continue;
          const ni=ny*width+nx;
          if(visited[ni]) continue;
          const np=raster.pixel(nx,ny);
          if(!predicate(np)){visited[ni]=1;continue;}
          visited[ni]=1;queue.push(ni);
        }
      }
      const component={area,x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
      if(!best||component.area>best.area) best=component;
    }
  }
  return best;
}

module.exports={decodePng,largestComponent};
