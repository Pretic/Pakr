"""Create an isolated debug-build fixture without changing production templates."""
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit("Usage: python Scripts/prepare_ci_android.py OUTPUT_DIRECTORY")
target = Path(sys.argv[1]).resolve()
if target == root or root in target.parents or target.exists():
    raise SystemExit("Output must be a new directory outside the source tree")
shutil.copytree(root, target, ignore=shutil.ignore_patterns(".git", ".gradle", ".maintenance", "local.properties"))
values = {
    "APP_URL": "https://example.invalid/pakr-qa", "APP_PACKAGE": "com.pakr.maintenanceqa",
    "APP_NAME": "Pakr QA", "VERSION_NAME": "1.0.0", "VERSION_CODE": "1",
    "NO_SCREENSHOT": "false", "WINDOW_MODE": "false", "UA_MODE": "auto", "SHOW_DISCLAIMER": "false",
}
for path in (target / "app").rglob("*"):
    if not path.is_file() or path.suffix not in {".kt", ".xml", ".gradle"}:
        continue
    text = path.read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    if path.suffix == ".xml":
        text = text.replace("@mipmap/ic_launcher_round", "@android:drawable/sym_def_app_icon")
        text = text.replace("@mipmap/ic_launcher", "@android:drawable/sym_def_app_icon")
    path.write_text(text, encoding="utf-8")
print(target)
