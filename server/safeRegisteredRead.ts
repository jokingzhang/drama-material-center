import { lstat, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";

export type RegisteredReadErrorCode =
  | "invalid_registered_path"
  | "registered_file_not_found";

export class RegisteredReadError extends Error {
  constructor(
    readonly code: RegisteredReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RegisteredReadError";
  }
}

const sensitiveQueryKeys = [
  "accesskeyid",
  "auth",
  "credential",
  "expires",
  "key",
  "policy",
  "security-token",
  "sig",
  "signature",
  "token",
];

function isSensitiveQueryKey(value: string) {
  const normalized = value.toLowerCase();
  return normalized.startsWith("x-amz-")
    || sensitiveQueryKeys.some((key) => normalized === key || normalized.endsWith(key));
}

export function sanitizePublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.username = "";
    url.password = "";
    if ([...url.searchParams.keys()].some(isSensitiveQueryKey)) {
      url.search = "";
      url.hash = "";
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function sanitizePublicText(value: string) {
  return value
    .replace(/https?:\/\/[^\s<>"'()[\]{}，。！？；：、]+/gu, (candidate) => sanitizePublicUrl(candidate) ?? "[远程链接已隐藏]")
    .replace(/(?:\/Users|\/home|\/private\/var|\/var\/folders)\/[^\s<>"'()[\]{}，。！？；：、]+/gu, "[本机路径已隐藏]")
    .replace(/[A-Za-z]:\\Users\\[^\s<>"'()[\]{}，。！？；：、]+/gu, "[本机路径已隐藏]");
}

export async function resolveRegisteredFile(
  root: string,
  relativePath: string,
  allowedExtensions: readonly string[],
) {
  if (!relativePath || isAbsolute(relativePath)) {
    throw new RegisteredReadError("invalid_registered_path", "登记文件路径无效。");
  }

  const candidate = resolve(root, relativePath);
  const lexicalBoundary = relative(resolve(root), candidate);
  if (lexicalBoundary.startsWith("..") || isAbsolute(lexicalBoundary)) {
    throw new RegisteredReadError("invalid_registered_path", "登记文件路径超出允许范围。");
  }
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extname(candidate).toLowerCase())) {
    throw new RegisteredReadError("invalid_registered_path", "登记文件类型不受支持。");
  }

  try {
    const [resolvedRoot, resolvedCandidate, candidateStat] = await Promise.all([
      realpath(root),
      realpath(candidate),
      lstat(candidate),
    ]);
    const realBoundary = relative(resolvedRoot, resolvedCandidate);
    if (realBoundary.startsWith("..") || isAbsolute(realBoundary) || !candidateStat.isFile()) {
      throw new RegisteredReadError("invalid_registered_path", "登记文件路径超出允许范围。");
    }
    return resolvedCandidate;
  } catch (error) {
    if (error instanceof RegisteredReadError) throw error;
    throw new RegisteredReadError("registered_file_not_found", "登记文件不存在。");
  }
}

export async function resolveRegisteredDirectory(root: string, relativePath: string) {
  if (!relativePath || isAbsolute(relativePath)) {
    throw new RegisteredReadError("invalid_registered_path", "登记目录路径无效。");
  }
  const candidate = resolve(root, relativePath);
  const lexicalBoundary = relative(resolve(root), candidate);
  if (lexicalBoundary.startsWith("..") || isAbsolute(lexicalBoundary)) {
    throw new RegisteredReadError("invalid_registered_path", "登记目录路径超出允许范围。");
  }
  try {
    const [resolvedRoot, resolvedCandidate, candidateStat] = await Promise.all([
      realpath(root),
      realpath(candidate),
      lstat(candidate),
    ]);
    const realBoundary = relative(resolvedRoot, resolvedCandidate);
    if (realBoundary.startsWith("..") || isAbsolute(realBoundary) || !candidateStat.isDirectory()) {
      throw new RegisteredReadError("invalid_registered_path", "登记目录路径超出允许范围。");
    }
    return resolvedCandidate;
  } catch (error) {
    if (error instanceof RegisteredReadError) throw error;
    throw new RegisteredReadError("registered_file_not_found", "登记目录不存在。");
  }
}
