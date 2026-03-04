import { copyFile, mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const targetDir = path.join(rootDir, "public", "pdfs");
const manifestPath = path.join(targetDir, "manifest.json");

function isPdf(fileName) {
  return /\.pdf$/i.test(fileName);
}

function relevanceScore(fileName) {
  const lower = fileName.toLowerCase();
  let score = 0;
  if (lower.includes("ksei")) score += 8;
  if (lower.includes("semua emiten")) score += 6;
  if (lower.includes("pengumuman bursa")) score += 6;
  if (lower.includes("lamp")) score += 3;
  return score;
}

async function readRootPdfs() {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const pdfNames = entries
    .filter((entry) => entry.isFile() && isPdf(entry.name))
    .map((entry) => entry.name);

  const withStats = [];
  for (const fileName of pdfNames) {
    const sourcePath = path.join(rootDir, fileName);
    const fileStat = await stat(sourcePath);
    withStats.push({
      fileName,
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      score: relevanceScore(fileName),
    });
  }

  withStats.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.size !== a.size) return b.size - a.size;
    return a.fileName.localeCompare(b.fileName);
  });

  const defaultFileName = withStats[0]?.fileName ?? null;

  const manifest = [];
  for (const item of withStats) {
    const fileName = item.fileName;
    const sourcePath = path.join(rootDir, fileName);
    const targetPath = path.join(targetDir, fileName);
    await copyFile(sourcePath, targetPath);
    manifest.push({
      fileName,
      publicPath: `/pdfs/${fileName}`,
      size: item.size,
      mtimeMs: item.mtimeMs,
      isDefault: fileName === defaultFileName,
      relevanceScore: item.score,
    });
  }
  return { pdfNames, manifest, defaultFileName };
}

async function cleanupRemovedPdfs(validNames) {
  const existing = await readdir(targetDir, { withFileTypes: true });
  const validSet = new Set(validNames);
  const stale = existing.filter((entry) => entry.isFile() && isPdf(entry.name) && !validSet.has(entry.name));
  await Promise.all(stale.map((entry) => unlink(path.join(targetDir, entry.name))));
  return stale.length;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  const { pdfNames, manifest, defaultFileName } = await readRootPdfs();
  const removedCount = await cleanupRemovedPdfs(pdfNames);
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        defaultFileName,
        files: manifest,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(
    `[sync:pdfs] synced=${manifest.length}, removed=${removedCount}, default=${defaultFileName ?? "-"}, manifest=${path.relative(rootDir, manifestPath)}`,
  );
}

main().catch((error) => {
  console.error("[sync:pdfs] failed:", error);
  process.exitCode = 1;
});
