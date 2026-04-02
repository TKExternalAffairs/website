import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const sourceRoot = path.resolve(process.cwd(), "src/assets/Images");
const outputRoot = path.resolve(process.cwd(), "src/assets/Webp");
const supportedExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp",
]);

const parsedQuality = Number.parseInt(process.env.WEBP_QUALITY ?? "80", 10);
const webpQuality = Number.isNaN(parsedQuality)
  ? 80
  : Math.min(100, Math.max(0, parsedQuality));

async function walkFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(entryPath);
      }

      return entry.isFile() ? [entryPath] : [];
    }),
  );

  return files.flat();
}

function isSupportedImage(filePath) {
  return supportedExtensions.has(path.extname(filePath).toLowerCase());
}

function toOutputPath(sourcePath) {
  const relativePath = path.relative(sourceRoot, sourcePath);
  const extension = path.extname(relativePath);

  return path.join(outputRoot, relativePath.slice(0, -extension.length) + ".webp");
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function removeEmptyDirectories(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => removeEmptyDirectories(path.join(directoryPath, entry.name))),
  );

  const remainingEntries = await fs.readdir(directoryPath);

  if (remainingEntries.length === 0 && directoryPath !== outputRoot) {
    await fs.rmdir(directoryPath);
  }
}

async function removeStaleOutputs(expectedOutputPaths) {
  try {
    await fs.access(outputRoot);
  } catch {
    return 0;
  }

  const existingFiles = (await walkFiles(outputRoot)).filter(
    (filePath) => path.extname(filePath).toLowerCase() === ".webp",
  );

  let removedCount = 0;

  for (const existingFile of existingFiles) {
    if (expectedOutputPaths.has(normalizePath(existingFile))) {
      continue;
    }

    await fs.unlink(existingFile);
    removedCount += 1;
  }

  await removeEmptyDirectories(outputRoot);

  return removedCount;
}

async function convertSourceImage(sourcePath) {
  const outputPath = toOutputPath(sourcePath);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath, { animated: true }).webp({ quality: webpQuality }).toFile(outputPath);

  return outputPath;
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true });

  let sourceFiles = [];

  try {
    sourceFiles = (await walkFiles(sourceRoot)).filter(isSupportedImage);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Source directory not found: ${sourceRoot}`);
    }

    throw error;
  }

  const convertedOutputPaths = new Set();

  for (const sourceFile of sourceFiles) {
    const outputPath = await convertSourceImage(sourceFile);
    convertedOutputPaths.add(normalizePath(outputPath));
  }

  const removedCount = await removeStaleOutputs(convertedOutputPaths);

  console.log(
    `Converted ${sourceFiles.length} image(s) to WebP in ${normalizePath(outputRoot)}. Removed ${removedCount} stale file(s).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});