#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MIN_BUILD_TOOLS_VERSION = '35.0.0';
const REQUIRED_LOAD_ALIGNMENT_POWER = 14;
const ARCH_64_BIT = new Set(['arm64-v8a', 'x86_64']);

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function compareVersions(a, b) {
  const left = String(a).split(/[^\d]+/).filter(Boolean).map(Number);
  const right = String(b).split(/[^\d]+/).filter(Boolean).map(Number);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}` +
        (output ? `\n${output}` : ''),
    );
  }

  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}

function canRun(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return !result.error && result.status === 0;
}

function executableName(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function hostPrebuiltDir() {
  if (process.platform === 'win32') {
    return 'windows-x86_64';
  }
  if (process.platform === 'darwin') {
    return 'darwin-x86_64';
  }
  return 'linux-x86_64';
}

function candidateSdkRoots() {
  const candidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
  ];

  if (process.platform === 'win32') {
    candidates.push(
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
        : undefined,
    );
  } else {
    candidates.push(
      process.env.HOME ? path.join(process.env.HOME, 'Android', 'Sdk') : undefined,
      process.env.HOME ? path.join(process.env.HOME, 'Library', 'Android', 'sdk') : undefined,
    );
  }

  return candidates.filter(Boolean);
}

function findSdkRoot() {
  const sdkRoot = candidateSdkRoots().find((candidate) => fs.existsSync(candidate));

  if (!sdkRoot) {
    fail('Android SDK not found. Set ANDROID_SDK_ROOT or ANDROID_HOME.');
  }

  return sdkRoot;
}

function sortedVersionDirs(parentDir) {
  if (!fs.existsSync(parentDir)) {
    return [];
  }

  return fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => compareVersions(b, a))
    .map((name) => path.join(parentDir, name));
}

function findZipalign(sdkRoot) {
  const buildToolsDir = path.join(sdkRoot, 'build-tools');
  const zipalignName = executableName('zipalign');

  for (const dir of sortedVersionDirs(buildToolsDir)) {
    const version = path.basename(dir);
    const zipalign = path.join(dir, zipalignName);
    if (fs.existsSync(zipalign)) {
      if (compareVersions(version, MIN_BUILD_TOOLS_VERSION) < 0) {
        fail(
          `found ${zipalign}, but Android SDK Build-Tools ${MIN_BUILD_TOOLS_VERSION}+ is required`,
        );
      }
      return zipalign;
    }
  }

  fail(`zipalign not found under ${buildToolsDir}`);
}

function findLlvmObjdump(sdkRoot) {
  const objdumpName = executableName('llvm-objdump');
  const suffix = path.join('toolchains', 'llvm', 'prebuilt', hostPrebuiltDir(), 'bin', objdumpName);
  const candidates = [
    process.env.ANDROID_NDK_ROOT,
    process.env.ANDROID_NDK_HOME,
    process.env.NDK_HOME,
  ]
    .filter(Boolean)
    .map((ndkRoot) => path.join(ndkRoot, suffix));

  const ndkDir = path.join(sdkRoot, 'ndk');
  for (const dir of sortedVersionDirs(ndkDir)) {
    candidates.push(path.join(dir, suffix));
  }

  const objdump = candidates.find((candidate) => fs.existsSync(candidate));
  if (!objdump) {
    fail('llvm-objdump not found. Install the Android NDK or set ANDROID_NDK_ROOT.');
  }

  return objdump;
}

function collectFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, results);
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function extractArchive(artifactPath, destination) {
  try {
    run('unzip', ['-q', artifactPath, '-d', destination]);
    return;
  } catch (unzipError) {
    try {
      run('tar', ['-xf', artifactPath, '-C', destination]);
      return;
    } catch (tarError) {
      throw new Error(
        `could not extract ${artifactPath} with unzip or tar\n` +
          `unzip: ${unzipError.message}\n` +
          `tar: ${tarError.message}`,
      );
    }
  }
}

function verifyZipAlignment(apkPath, zipalign) {
  run(zipalign, ['-v', '-c', '-P', '16', '4', apkPath]);
  console.log(`ok: ${apkPath} is ZIP-aligned for 16 KB pages`);
}

function getSharedLibraryAbi(archiveRoot, libraryPath) {
  const parts = path.relative(archiveRoot, libraryPath).split(path.sep);
  const libIndex = parts.lastIndexOf('lib');

  if (libIndex === -1 || libIndex + 1 >= parts.length) {
    return null;
  }

  return parts[libIndex + 1];
}

function verifyElfAlignment(artifactPath, objdump) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'android-16kb-'));

  try {
    extractArchive(artifactPath, tempDir);
    const sharedLibraries = collectFiles(tempDir, (file) => file.endsWith('.so'));
    const targetLibraries = sharedLibraries.filter((file) => {
      return ARCH_64_BIT.has(getSharedLibraryAbi(tempDir, file));
    });

    if (targetLibraries.length === 0) {
      console.log(`ok: ${artifactPath} has no 64-bit shared libraries to check`);
      return;
    }

    const badSegments = [];

    for (const library of targetLibraries.sort()) {
      const output = run(objdump, ['-p', library]);
      const loadLines = output.split(/\r?\n/).filter((line) => /\bLOAD\b/.test(line));

      for (const line of loadLines) {
        const match = line.match(/align\s+2\*\*(\d+)/);
        const power = match ? Number(match[1]) : NaN;
        if (!Number.isFinite(power) || power < REQUIRED_LOAD_ALIGNMENT_POWER) {
          badSegments.push({
            library: path.relative(tempDir, library),
            alignment: match ? `2**${power}` : 'unknown',
            line: line.trim(),
          });
        }
      }
    }

    if (badSegments.length > 0) {
      for (const segment of badSegments) {
        console.error(`${segment.library}: ${segment.alignment}: ${segment.line}`);
      }
      fail(`found ${badSegments.length} ELF LOAD segment(s) below 2**14 alignment`);
    }

    console.log(
      `ok: ${artifactPath} has ${targetLibraries.length} 64-bit shared libraries with 2**14+ ELF LOAD alignment`,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function bundletoolCommand() {
  if (process.env.BUNDLETOOL_JAR) {
    const bundletoolJar = path.resolve(process.env.BUNDLETOOL_JAR);
    if (!fs.existsSync(bundletoolJar)) {
      fail(`BUNDLETOOL_JAR does not exist: ${bundletoolJar}`);
    }
    return { command: 'java', argsPrefix: ['-jar', bundletoolJar] };
  }

  if (canRun('bundletool', ['version'])) {
    return { command: 'bundletool', argsPrefix: [] };
  }

  fail('bundletool not found. Set BUNDLETOOL_JAR or add bundletool to PATH.');
}

function verifyBundlePageAlignment(aabPath) {
  const { command, argsPrefix } = bundletoolCommand();
  const output = run(command, [
    ...argsPrefix,
    'dump',
    'config',
    `--bundle=${aabPath}`,
  ]);

  if (output.includes('PAGE_ALIGNMENT_16K')) {
    console.log(`ok: ${aabPath} requests PAGE_ALIGNMENT_16K`);
    return;
  }

  if (output.includes('PAGE_ALIGNMENT_4K')) {
    fail(`${aabPath} requests PAGE_ALIGNMENT_4K`);
  }

  fail(`${aabPath} does not expose PAGE_ALIGNMENT_16K in bundletool dump config output`);
}

function defaultArtifacts() {
  return [
    path.join('android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    path.join('android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'),
    path.join('play-store', 'app-release.apk'),
  ].filter((artifact) => fs.existsSync(artifact));
}

const artifacts = process.argv.slice(2);
const requestedArtifacts = artifacts.length > 0 ? artifacts : defaultArtifacts();

if (requestedArtifacts.length === 0) {
  fail(
    'no artifacts found. Usage: node scripts/verify-android-16kb-page-size.mjs app-release.apk [app-release.aab]',
  );
}

let sdkRoot;
let zipalign;
let objdump;

for (const artifact of requestedArtifacts) {
  const artifactPath = path.resolve(artifact);
  if (!fs.existsSync(artifactPath)) {
    fail(`artifact not found: ${artifactPath}`);
  }

  if (artifactPath.endsWith('.apk')) {
    sdkRoot ??= findSdkRoot();
    zipalign ??= findZipalign(sdkRoot);
    objdump ??= findLlvmObjdump(sdkRoot);
    verifyZipAlignment(artifactPath, zipalign);
    verifyElfAlignment(artifactPath, objdump);
  } else if (artifactPath.endsWith('.aab')) {
    verifyBundlePageAlignment(artifactPath);
    sdkRoot ??= findSdkRoot();
    objdump ??= findLlvmObjdump(sdkRoot);
    verifyElfAlignment(artifactPath, objdump);
  } else {
    fail(`unsupported artifact type: ${artifactPath}`);
  }
}
