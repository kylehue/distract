# -*- mode: python -*-

import sys
from PyInstaller.utils.hooks import collect_data_files

# Collect all data files from mediapipe modules and models dir
mediapipe_datas = collect_data_files("mediapipe", include_py_files=True)
datas = []
datas += mediapipe_datas
datas += [
    ("models", "models"),
]

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'], # current folder
    binaries=[],
    datas=datas,
    hiddenimports=[
        'mediapipe.python.solutions.face_mesh',
        'sklearn',
        'sklearn.tree'
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='main',
    debug=False,
    strip=False,
    upx=True,
    console=True  # True because we want stdout/stderr visible
)
