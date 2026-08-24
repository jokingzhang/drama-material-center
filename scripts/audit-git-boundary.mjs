import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

const allowedWorkspaceFiles = new Set(["workspace/.gitkeep"]);
const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const trackedWorkspaceData = trackedFiles.filter(
  (path) => path.startsWith("workspace/") && !allowedWorkspaceFiles.has(path),
);

const oversizedFiles = trackedFiles.filter((path) => {
  try {
    return statSync(path).size > 5 * 1024 * 1024;
  } catch {
    return false;
  }
});

const ignoreProbes = [
  "workspace/example/project.json",
  "workspace/example/library/剧情/EP01.md",
  "workspace/example/library/图片/角色.png",
  "workspace/example/library/视频/EP01.mp4",
];
const ignoredProbeFailures = ignoreProbes.filter((path) => {
  try {
    execFileSync("git", ["check-ignore", "--quiet", path]);
    return false;
  } catch {
    return true;
  }
});

const errors = [];
if (trackedWorkspaceData.length) {
  errors.push(`workspace 中存在被 Git 跟踪的数据：\n${trackedWorkspaceData.join("\n")}`);
}
if (oversizedFiles.length) {
  errors.push(`仓库中存在超过 5 MB 的被跟踪文件：\n${oversizedFiles.join("\n")}`);
}
if (ignoredProbeFailures.length) {
  errors.push(`以下工作区样例没有被 .gitignore 覆盖：\n${ignoredProbeFailures.join("\n")}`);
}

if (errors.length) {
  console.error(errors.join("\n\n"));
  process.exitCode = 1;
} else {
  console.log("Git 边界检查通过：项目数据均被忽略，仓库中没有超大文件。");
}
