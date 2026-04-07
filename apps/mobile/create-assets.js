/**
 * 用纯 Node.js 内置模块生成合法 PNG 文件（带正确 CRC32 校验）
 * 不依赖任何第三方库
 */
const fs = require('fs');
const zlib = require('zlib');

// CRC32 实现
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPNG(width, height, r, g, b) {
  // PNG 签名
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  // compression=0, filter=0, interlace=0 already zero

  // 原始图像数据：每行一个 filter byte(0) + RGB 像素
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize, 0);
  for (let y = 0; y < height; y++) {
    const base = y * rowSize;
    raw[base] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      raw[base + 1 + x * 3]     = r;
      raw[base + 1 + x * 3 + 1] = g;
      raw[base + 1 + x * 3 + 2] = b;
    }
  }

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// 生成 64x64 暖橙色图标（#FF8C69）
const icon = createPNG(64, 64, 255, 140, 105);
// 生成 64x64 暖米白色启动图（#FFF5F0）
const splash = createPNG(64, 64, 255, 245, 240);

if (!fs.existsSync('assets')) fs.mkdirSync('assets');
fs.writeFileSync('assets/icon.png', icon);
fs.writeFileSync('assets/adaptive-icon.png', icon);
fs.writeFileSync('assets/splash.png', splash);
fs.writeFileSync('assets/favicon.png', icon);

console.log('Assets created successfully! (valid PNG with correct CRC)');
