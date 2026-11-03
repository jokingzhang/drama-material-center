import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/sync_project.py"
spec = importlib.util.spec_from_file_location("sync_project", SCRIPT)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class ProjectSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.source, self.target = self.root / "source/demo", self.root / "target/demo"
        for folder in (self.source, self.target):
            folder.mkdir(parents=True)
            (folder / "library").mkdir()
            self.write(folder, "project.json", '{"schemaVersion":1,"name":"测试"}')

    def write(self, root, rel, body, mtime=1700000000):
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body.encode() if isinstance(body, str) else body)
        os.utime(path, (mtime, mtime))
        return path

    def test_preview_is_read_only_and_counts_missing(self):
        self.write(self.source, "library/new.txt", "hello")
        before = sync.scan(self.target)
        result = sync.sync_project(self.source, self.target)
        self.assertEqual(result["newFiles"], 1)
        self.assertEqual(result["copyBytes"], 5)
        self.assertEqual(before, sync.scan(self.target))
        self.assertFalse((self.target / "生产记录").exists())

    def test_copy_preserves_local_only_and_source_and_empty_directories(self):
        rel = "library/中文 空格/带\n换行.txt"
        self.write(self.source, rel, "新增内容")
        self.write(self.target, "library/local-only.txt", "keep")
        (self.source / "library/空目录/子目录").mkdir(parents=True)
        source_before = sync.scan(self.source)
        result = sync.sync_project(self.source, self.target, apply=True)
        self.assertEqual(result["status"], "SYNC_COMPLETE")
        self.assertEqual((self.source / rel).read_bytes(), (self.target / rel).read_bytes())
        self.assertTrue((self.target / "library/空目录/子目录").is_dir())
        self.assertEqual((self.target / "library/local-only.txt").read_text(), "keep")
        self.assertEqual(source_before, sync.scan(self.source))
        before = sync.scan(self.target)
        self.assertEqual(sync.sync_project(self.source, self.target, apply=True)["status"], "NO_CHANGES")
        self.assertEqual(before, sync.scan(self.target))

    def test_newer_source_replaces_only_after_verified_backup(self):
        self.write(self.source, "library/same.txt", "new", 1700000002)
        self.write(self.target, "library/same.txt", "old")
        result = sync.sync_project(self.source, self.target, apply=True)
        item = next(c for c in result["files"] if c["action"] == "REPLACE")
        self.assertEqual((self.target / item["backup"]).read_text(), "old")
        self.assertEqual((self.target / "library/same.txt").read_text(), "new")
        self.assertEqual(result["verification"]["backupSha256Checked"], 1)

    def test_newer_target_blocks_all_writes_unless_source_authoritative(self):
        self.write(self.source, "library/new.txt", "missing")
        self.write(self.source, "library/conflict.txt", "old")
        self.write(self.target, "library/conflict.txt", "new", 1700000002)
        before = sync.scan(self.target)
        with self.assertRaises(sync.SyncError):
            sync.sync_project(self.source, self.target, apply=True)
        self.assertEqual(before, sync.scan(self.target))
        result = sync.sync_project(self.source, self.target, apply=True, source_wins=True)
        self.assertEqual(result["status"], "SYNC_COMPLETE")
        self.assertEqual((self.target / "library/conflict.txt").read_text(), "old")

    def test_full_checksum_catches_same_size_same_time_edit(self):
        self.write(self.source, "library/same.txt", "AAA")
        self.write(self.target, "library/same.txt", "BBB")
        self.assertEqual(sync.sync_project(self.source, self.target)["replacedFiles"], 0)
        self.assertEqual(sync.sync_project(self.source, self.target, checksum=True)["replacedFiles"], 1)
        result = sync.sync_project(self.source, self.target, apply=True, checksum=True, source_wins=True)
        self.assertTrue(result["verification"]["fullContentVerified"])
        self.assertEqual((self.target / "library/same.txt").read_text(), "AAA")

    def test_identical_bytes_with_different_times_are_not_replaced(self):
        self.write(self.source, "library/same.txt", "AAA", 1700000002)
        self.write(self.target, "library/same.txt", "AAA")
        result = sync.sync_project(self.source, self.target, apply=True)
        self.assertEqual(result["status"], "NO_CHANGES")

    def test_only_confirmed_system_files_excluded(self):
        self.write(self.source, "library/._metadata", b"\x00\x05\x16\x07metadata")
        self.write(self.source, "library/._real-file", "ordinary")
        self.write(self.source, "library/.DS_Store", "finder")
        self.write(self.source, ".libtv/project.json", "{}")
        result = sync.sync_project(self.source, self.target, apply=True)
        self.assertEqual(result["newFiles"], 2)
        self.assertFalse((self.target / "library/._metadata").exists())
        self.assertTrue((self.target / "library/._real-file").exists())
        self.assertTrue((self.target / ".libtv/project.json").exists())

    def test_symlink_and_file_directory_conflicts_rejected(self):
        (self.source / "library/link").symlink_to(self.root)
        with self.assertRaises(sync.SyncError):
            sync.sync_project(self.source, self.target)
        (self.source / "library/link").unlink()
        self.write(self.source, "library/collision", "file")
        (self.target / "library/collision").mkdir()
        with self.assertRaises(sync.SyncError):
            sync.sync_project(self.source, self.target)

    def test_case_collision_between_roots_rejected(self):
        self.write(self.source, "library/Test.txt", "same")
        self.write(self.target, "library/test.txt", "same")
        with self.assertRaises(sync.SyncError):
            sync.sync_project(self.source, self.target)

    def test_rsync_failure_keeps_backup_and_failed_manifest(self):
        self.write(self.source, "library/same.txt", "new", 1700000002)
        self.write(self.target, "library/same.txt", "old")
        failed = subprocess.CompletedProcess([], 23, b"", b"simulated failure")
        with patch.object(sync.subprocess, "run", return_value=failed):
            with self.assertRaises(sync.SyncError):
                sync.sync_project(self.source, self.target, apply=True)
        import json
        manifest_path = next(self.target.rglob("SYNC-MANIFEST-v01.json"))
        result = json.loads(manifest_path.read_text())
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual((self.target / result["files"][0]["backup"]).read_text(), "old")

    def test_workspace_override_and_missing_mount(self):
        (self.root / ".env.local").write_text('export MATERIAL_CENTER_WORKSPACE="assets with spaces" # comment\n')
        self.assertEqual(sync.workspace_root(self.root), self.root / "assets with spaces")
        with self.assertRaises(sync.SyncError):
            sync.resolve_projects(self.root, "../escape", "push", self.root / "target")
        with self.assertRaises(sync.SyncError):
            sync.resolve_projects(self.root, "demo", "push", self.root / "target")

    def test_resolves_both_directions_with_external_workspace(self):
        (self.root / ".env.local").write_text(f'MATERIAL_CENTER_WORKSPACE="{self.source.parent}"\n')
        with patch.object(Path, "is_mount", return_value=True):
            self.assertEqual(sync.resolve_projects(self.root, "demo", "push", self.target.parent),
                             (self.source.resolve(), self.target.resolve()))
            self.assertEqual(sync.resolve_projects(self.root, "demo", "pull", self.target.parent),
                             (self.target.resolve(), self.source.resolve()))


if __name__ == "__main__":
    unittest.main()
