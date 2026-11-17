"""Export only reviewed project files; never include user deployment records."""
from pathlib import Path
import sys,zipfile
root=Path(__file__).resolve().parent.parent
output=Path(sys.argv[1]).resolve()
items=['src','lib','tests','scripts','.github','package.json','build.mjs','cordis.patch.yml','README.md','PUBLISHING.md','CHANGELOG.md','PACKAGING-VERIFICATION.md','verification-evidence.json','LICENSE','VERIFICATION.md','preview.jpg','.gitignore','.gitattributes','install.ps1','install.cmd']
output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
 for item in items:
  path=root/item
  for file in sorted(path.rglob('*')) if path.is_dir() else [path]:
   if file.is_file() and '__pycache__' not in file.parts: archive.write(file,'dsh-codex-sidechat/'+file.relative_to(root).as_posix())
print(output)
