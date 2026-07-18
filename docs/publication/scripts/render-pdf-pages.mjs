#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

globalThis.DOMMatrix = DOMMatrix;
globalThis.ImageData = ImageData;
globalThis.Path2D = Path2D;

const publicationDir = path.resolve(import.meta.dirname, "..");
const pdfPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(publicationDir, "generated/TaskManager Engineering Playbook - Repository Edition v2.0 - Draft 1.pdf");
const outputDir = path.join(publicationDir, ".build/qa-pages");
const contactsDir = path.join(publicationDir, ".build/qa-contact-sheets");
await fs.rm(outputDir, { recursive: true, force: true });
await fs.rm(contactsDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(contactsDir, { recursive: true });

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(await fs.readFile(pdfPath));
const standardFontDataUrl = `${path.resolve(publicationDir, "../../node_modules/pdfjs-dist/standard_fonts")}/`;
const doc = await pdfjs.getDocument({ data, disableWorker: true, standardFontDataUrl }).promise;
const thumbnails = [];
for (let number = 1; number <= doc.numPages; number++) {
  const page = await doc.getPage(number);
  const viewport = page.getViewport({ scale: 1.35 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  const file = path.join(outputDir, `page-${String(number).padStart(3, "0")}.png`);
  await fs.writeFile(file, canvas.toBuffer("image/png"));
  thumbnails.push({ number, canvas });
}

for (let start = 0; start < thumbnails.length; start += 12) {
  const group = thumbnails.slice(start, start + 12);
  const sheet = createCanvas(1200, 1600);
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#dfe4e8";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  for (let i = 0; i < group.length; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 20 + col * 395, y = 35 + row * 390;
    ctx.fillStyle = "#202833";
    ctx.font = "18px Arial";
    ctx.fillText(`Page ${group[i].number}`, x, y - 8);
    ctx.drawImage(group[i].canvas, x, y, 360, 360 * Math.SQRT2);
  }
  const end = group.at(-1).number;
  await fs.writeFile(path.join(contactsDir, `pages-${String(group[0].number).padStart(3, "0")}-${String(end).padStart(3, "0")}.png`), sheet.toBuffer("image/png"));
}
console.log(JSON.stringify({ pages: doc.numPages, pageImages: outputDir, contactSheets: contactsDir }, null, 2));
