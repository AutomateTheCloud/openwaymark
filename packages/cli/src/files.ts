// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// File access for the CLI. Bundles are read through a ByteSource over an open
// file handle, so the engine reads only the parts it needs instead of loading
// a whole archive into memory.

import { open, readdir, lstat, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { ByteSource, PackFile } from "@automatethecloud/openwaymark-engine";

export interface FileSource extends ByteSource {
  close(): Promise<void>;
}

export async function openFileSource(path: string): Promise<FileSource> {
  const handle = await open(path, "r");
  const { size } = await handle.stat();
  return {
    size,
    async read(offset, length) {
      const buffer = new Uint8Array(Math.max(0, Math.min(length, size - offset)));
      let filled = 0;
      while (filled < buffer.length) {
        const { bytesRead } = await handle.read(
          buffer,
          filled,
          buffer.length - filled,
          offset + filled,
        );
        if (bytesRead === 0) break;
        filled += bytesRead;
      }
      return buffer.subarray(0, filled);
    },
    close: () => handle.close(),
  };
}

export class SymbolicLinkError extends Error {}

/**
 * Reads every regular file under a folder, for packing. Paths use "/" on every
 * operating system. Symbolic links are refused rather than followed, so
 * packing can never pull in files from outside the folder.
 */
export async function readFolder(root: string): Promise<PackFile[]> {
  const files: PackFile[] = [];
  const walk = async (dir: string) => {
    for (const name of (await readdir(dir)).sort()) {
      const path = join(dir, name);
      const info = await lstat(path);
      if (info.isSymbolicLink())
        throw new SymbolicLinkError(
          `${relative(root, path)} is a symbolic link; bundles cannot contain links.`,
        );
      if (info.isDirectory()) await walk(path);
      else if (info.isFile())
        files.push({
          path: relative(root, path).split(sep).join("/"),
          bytes: new Uint8Array(await readFile(path)),
        });
    }
  };
  await walk(root);
  return files;
}
