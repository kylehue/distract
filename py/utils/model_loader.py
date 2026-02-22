import json
import os
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Tuple

import joblib
import requests

REPO_OWNER = "kylehue"
REPO_NAME = "distract-model"
GITHUB_API_BASE = "https://api.github.com"

IF_MODEL_FILE = "if_model.pkl"
RF_MODEL_FILE = "rf_model.pkl"
MODEL_FILES = (IF_MODEL_FILE, RF_MODEL_FILE)

_SESSION = requests.Session()
_SESSION.headers.update(
    {
        "Accept": "application/vnd.github+json",
        "User-Agent": "distract-model-loader",
        "X-GitHub-Api-Version": "2022-11-28",
    }
)

_MODEL_LOCKS: Dict[str, Lock] = {name: Lock() for name in MODEL_FILES}
_METADATA_LOCK = Lock()
_RELEASE_LOCK = Lock()
_LOADED_MODELS: Dict[str, Any] = {}
_METADATA_CACHE: Dict[str, Dict[str, str]] | None = None
_LATEST_RELEASE_CACHE: Dict[str, Any] | None = None


def _cache_dir() -> Path:
    local_app_data = os.getenv("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "distract" / "models"
    return Path.home() / ".cache" / "distract" / "models"


def _metadata_path() -> Path:
    return _cache_dir() / "metadata.json"


def _latest_release_api_url() -> str:
    return f"{GITHUB_API_BASE}/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"


def _ensure_cache_dir() -> None:
    _cache_dir().mkdir(parents=True, exist_ok=True)


def _load_metadata() -> Dict[str, Dict[str, str]]:
    global _METADATA_CACHE
    if _METADATA_CACHE is not None:
        return _METADATA_CACHE

    with _METADATA_LOCK:
        if _METADATA_CACHE is not None:
            return _METADATA_CACHE

        path = _metadata_path()
        if not path.exists():
            _METADATA_CACHE = {}
            return _METADATA_CACHE

        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            _METADATA_CACHE = loaded if isinstance(loaded, dict) else {}
        except (OSError, json.JSONDecodeError):
            _METADATA_CACHE = {}

        return _METADATA_CACHE


def _save_metadata(metadata: Dict[str, Dict[str, str]]) -> None:
    with _METADATA_LOCK:
        _ensure_cache_dir()
        path = _metadata_path()
        tmp_path = path.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(metadata), encoding="utf-8")
        tmp_path.replace(path)


def _cache_path(file_name: str) -> Path:
    return _cache_dir() / file_name


def _fetch_latest_release_info() -> Dict[str, Any]:
    global _LATEST_RELEASE_CACHE
    with _RELEASE_LOCK:
        request_headers: Dict[str, str] = {}
        if _LATEST_RELEASE_CACHE:
            etag = _LATEST_RELEASE_CACHE.get("etag")
            if etag:
                request_headers["If-None-Match"] = etag

        response = _SESSION.get(
            _latest_release_api_url(),
            headers=request_headers,
            timeout=(3, 20),
        )
        if response.status_code == 304:
            cached_release = (
                _LATEST_RELEASE_CACHE.get("release") if _LATEST_RELEASE_CACHE else None
            )
            if cached_release is not None:
                return cached_release
            response = _SESSION.get(_latest_release_api_url(), timeout=(3, 20))

        response.raise_for_status()
        payload = response.json()
        tag_name = payload.get("tag_name")
        if not tag_name:
            raise RuntimeError("Missing latest release tag_name")

        assets: Dict[str, Dict[str, str]] = {}
        for asset in payload.get("assets", []):
            asset_name = asset.get("name")
            asset_id = asset.get("id")
            asset_api_url = asset.get("url")
            if not asset_name or asset_id is None or not asset_api_url:
                continue
            assets[asset_name] = {
                "asset_id": str(asset_id),
                "asset_api_url": str(asset_api_url),
            }

        release_info = {
            "version": str(tag_name),
            "assets": assets,
        }
        _LATEST_RELEASE_CACHE = {
            "etag": response.headers.get("ETag"),
            "release": release_info,
        }
        return release_info


def _download_release_asset(file_name: str, asset_api_url: str) -> None:
    with _SESSION.get(
        asset_api_url,
        headers={"Accept": "application/octet-stream"},
        stream=True,
        timeout=(3, 60),
    ) as response:
        response.raise_for_status()
        _store_response_to_disk(response, file_name)


def _store_response_to_disk(response: requests.Response, file_name: str) -> None:
    path = _cache_path(file_name)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("wb") as model_file:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                model_file.write(chunk)
    tmp_path.replace(path)


def _load_from_disk(file_name: str) -> Any:
    return joblib.load(_cache_path(file_name))


def _load_model(file_name: str) -> Any:
    if file_name not in _MODEL_LOCKS:
        raise ValueError(f"Unsupported model file: {file_name}")

    with _MODEL_LOCKS[file_name]:
        _ensure_cache_dir()
        metadata = _load_metadata()
        entry = metadata.get(file_name, {})
        local_version = entry.get("version")
        local_asset_id = entry.get("asset_id")
        path = _cache_path(file_name)

        try:
            latest_release_info = _fetch_latest_release_info()
            remote_version = latest_release_info["version"]
            remote_asset = latest_release_info["assets"].get(file_name)
            if not remote_asset:
                raise RuntimeError(
                    f"Latest release is missing required asset: {file_name}"
                )
            remote_asset_id = remote_asset["asset_id"]

            if (
                local_version == remote_version
                and local_asset_id == remote_asset_id
                and path.exists()
            ):
                model = _LOADED_MODELS.get(file_name)
                if model is not None:
                    return model
                try:
                    model = _load_from_disk(file_name)
                    _LOADED_MODELS[file_name] = model
                    return model
                except Exception:
                    pass

            _download_release_asset(file_name, remote_asset["asset_api_url"])
            metadata[file_name] = {
                "version": remote_version,
                "asset_id": remote_asset_id,
            }
            _save_metadata(metadata)

            model = _load_from_disk(file_name)
            _LOADED_MODELS[file_name] = model
            return model
        except (requests.RequestException, RuntimeError):
            model = _LOADED_MODELS.get(file_name)
            if model is not None:
                return model
            if path.exists():
                try:
                    model = _load_from_disk(file_name)
                    _LOADED_MODELS[file_name] = model
                    return model
                except Exception:
                    pass
            raise RuntimeError(f"Unable to download or load model: {file_name}")


def load_if_model() -> Any:
    return _load_model(IF_MODEL_FILE)


def load_rf_model() -> Any:
    return _load_model(RF_MODEL_FILE)


def load_models() -> Tuple[Any, Any]:
    return load_if_model(), load_rf_model()


def clear_model_cache() -> None:
    global _LATEST_RELEASE_CACHE
    for file_name in MODEL_FILES:
        _LOADED_MODELS.pop(file_name, None)
    _LATEST_RELEASE_CACHE = None
