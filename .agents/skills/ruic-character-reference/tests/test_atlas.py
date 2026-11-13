import binascii
import copy
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zlib


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/atlas.py"
SPEC = importlib.util.spec_from_file_location("atlas", SCRIPT)
atlas = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(atlas)


def png(width=4, height=5):
    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", binascii.crc32(kind + data) & 0xFFFFFFFF))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    pixels = (b"\x00" + b"\x40\x80\xc0" * width) * height
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b""))


def snapshot(root):
    return {p.relative_to(root).as_posix(): atlas.sha256(p.read_bytes())
            for p in root.rglob("*") if p.is_file()}


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.atlas_root = self.root / "RuiC-PoseAtlas"
        self.atlas_root.mkdir()
        self.project = self.root / "project data" / "test-drama"
        (self.project / "library").mkdir(parents=True)
        (self.project / "production").mkdir()
        (self.project / "project.json").write_text(json.dumps({"schemaVersion": 1, "name": "测试"}))
        (self.project / "production/story-index.v1.json").write_text(json.dumps({
            "characters": [{"id": "CHAR-001", "looks": []}], "episodes": []}))
        (self.project / "production/asset-bindings.v1.json").write_text('{"assets": []}')
        (self.repo / ".env.local").write_text('export MATERIAL_CENTER_WORKSPACE="../project data" # local\n')
        self.data = png()
        images = []
        for item_id, section, hair in [("f0001", "face", "long"), ("f0002", "styling", "short")]:
            item = {"id": item_id, "sec": section, "hair": hair, "style": "",
                    "w": 4, "h": 5, "bytes": len(self.data),
                    "thumb": f"portrait/thumbs/{item_id}.webp",
                    "full": f"portrait/img/{item_id}.png",
                    "full_remote": f"{atlas.ORIGIN}/img/full/{item_id}.png"}
            thumb = self.atlas_root / item["thumb"]
            thumb.parent.mkdir(parents=True, exist_ok=True)
            thumb.write_bytes(b"thumbnail-presence-fixture")
            images.append(item)
        self.catalog_data = {
            "schema": 1, "source": {"license": "CC0 1.0", "url": atlas.ORIGIN},
            "totals": {"images": 2, "face": 1, "styling": 1},
            "sections": [{"key": "face", "names": {"zh": "脸部", "en": "Face"}},
                         {"key": "styling", "names": {"zh": "造型", "en": "Styling"}}],
            "hairs": [{"key": "long", "names": {"zh": "长发", "en": "Long", "ja": "ロング"}},
                      {"key": "short", "names": {"zh": "短发", "en": "Short", "ja": "ショート"}}],
            "images": images,
        }
        self.write_catalog()
        self.options = dict(repo=self.repo, item_id="f0001", project_id="test-drama",
                            character_id="CHAR-001", look_id="LOOK-FIRST", role="face",
                            consumer="CHAR-001 / LOOK-FIRST 人物标准图", version="v01")

    def write_catalog(self):
        path = self.atlas_root / "data/faces.json"
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(self.catalog_data, ensure_ascii=False))

    def catalog(self):
        return atlas.Catalog(self.atlas_root)

    def local_original(self):
        path = self.atlas_root / self.catalog_data["images"][0]["full"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(self.data)
        return path

    def test_multilingual_search_only_matches_current_item_and_paginates(self):
        catalog = self.catalog()
        for query in ["长发", "LONG", "ロング"]:
            result = catalog.search(query=query)
            self.assertEqual([i["id"] for i in result["items"]], ["f0001"])
        self.assertEqual(catalog.search(query="贵气")["totalMatches"], 0)
        self.assertEqual(catalog.search(section="face", hair="short")["totalMatches"], 0)
        page = catalog.search(offset=1, limit=1)
        self.assertEqual(page["totalMatches"], 2)
        self.assertEqual([i["id"] for i in page["items"]], ["f0002"])

    def test_preview_and_lookup_do_not_write_or_download(self):
        before = snapshot(self.root)
        with patch.object(atlas, "download_original", side_effect=AssertionError("unexpected network")):
            catalog = self.catalog()
            self.assertEqual(catalog.doctor()["missingOriginals"], 2)
            self.assertFalse(catalog.summary(catalog.get("f0001"))["fullExists"])
            preview = atlas.import_reference(catalog, **self.options, allow_download=True)
        self.assertEqual(preview["status"], "PREVIEW")
        self.assertEqual(preview["sourceMode"], "download-required")
        self.assertEqual(snapshot(self.root), before)

    def test_local_import_is_self_contained_and_preserves_sources_and_indexes(self):
        source = self.local_original()
        before_source = snapshot(self.atlas_root)
        before_index = snapshot(self.project / "production")
        with patch.object(atlas, "download_original", side_effect=AssertionError("unexpected network")):
            result = atlas.import_reference(self.catalog(), **self.options, apply=True)
        target = self.project / result["path"]
        self.assertEqual(target.read_bytes(), source.read_bytes())
        self.assertIn("test-drama-CHAR-001-LOOK-FIRST", target.name)
        record = json.loads((self.project / result["manifest"]).read_text())
        self.assertEqual(record["asset"]["status"], "DRAFT")
        self.assertEqual(record["asset"]["visualReview"], "NOT_REVIEWED")
        self.assertEqual(record["asset"]["sha256"], atlas.sha256(self.data))
        self.assertNotIn(str(self.atlas_root), json.dumps(record))
        self.assertEqual(snapshot(self.atlas_root), before_source)
        self.assertEqual(snapshot(self.project / "production"), before_index)
        before_retry = snapshot(self.project)
        with self.assertRaisesRegex(atlas.AtlasError, "不覆盖"):
            atlas.import_reference(self.catalog(), **self.options, apply=True)
        self.assertEqual(snapshot(self.project), before_retry)

    def test_missing_original_needs_explicit_download_option(self):
        before = snapshot(self.root)
        with patch.object(atlas, "download_original", side_effect=AssertionError("unexpected network")):
            with self.assertRaisesRegex(atlas.AtlasError, "缺少全尺寸原图"):
                atlas.import_reference(self.catalog(), **self.options, apply=True)
        self.assertEqual(snapshot(self.root), before)

    def test_download_only_requests_selected_original_and_leaves_atlas_untouched(self):
        before = snapshot(self.atlas_root)
        with patch.object(atlas, "download_original", return_value=self.data) as download:
            result = atlas.import_reference(self.catalog(), **self.options, apply=True, allow_download=True)
        download.assert_called_once_with(self.catalog_data["images"][0])
        self.assertEqual((self.project / result["path"]).read_bytes(), self.data)
        self.assertEqual(snapshot(self.atlas_root), before)

    def test_corrupt_download_or_wrong_size_is_rejected_before_writing(self):
        corrupt = bytearray(self.data)
        corrupt[45] ^= 1
        for data in (self.data[:-1], bytes(corrupt), png(5, 4)):
            before = snapshot(self.root)
            with patch.object(atlas, "download_original", return_value=data):
                with self.assertRaises(atlas.AtlasError):
                    atlas.import_reference(self.catalog(), **self.options, apply=True, allow_download=True)
            self.assertEqual(snapshot(self.root), before)

    def test_catalog_rejects_traversal_and_untrusted_original_urls(self):
        original = copy.deepcopy(self.catalog_data)
        for field, value in [("full", "../escape.png"),
                             ("full_remote", "https://example.invalid/f0001.png")]:
            self.catalog_data = copy.deepcopy(original)
            self.catalog_data["images"][0][field] = value
            self.write_catalog()
            with self.assertRaises(atlas.AtlasError):
                self.catalog()

    def test_import_refuses_unknown_character_and_unsafe_project_or_look(self):
        before = snapshot(self.root)
        for overrides in ({"character_id": "CHAR-999"}, {"project_id": "../other-drama"},
                          {"look_id": "../LOOK-FIRST"}):
            with self.assertRaises(atlas.AtlasError):
                atlas.import_reference(self.catalog(), **{**self.options, **overrides}, apply=True)
        self.assertEqual(snapshot(self.root), before)

    def test_import_refuses_symlink_destination(self):
        self.local_original()
        external = self.root / "external"
        external.mkdir()
        (self.project / "library/图片").symlink_to(external, target_is_directory=True)
        with self.assertRaisesRegex(atlas.AtlasError, "符号链接"):
            atlas.import_reference(self.catalog(), **self.options, apply=True)
        self.assertEqual(list(external.iterdir()), [])

    def test_catalog_refuses_symlink_source(self):
        original = self.local_original()
        external = self.root / "external.png"
        original.rename(external)
        original.symlink_to(external)
        with self.assertRaisesRegex(atlas.AtlasError, "符号链接"):
            self.catalog()


if __name__ == "__main__":
    unittest.main()
