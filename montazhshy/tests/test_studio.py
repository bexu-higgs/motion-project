"""Студия серверінің негізгі API-ін тексеру."""

from __future__ import annotations

import json
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer

from montazhshy.studio.server import Hub, make_handler, safe_name


def _req(base, path, data=None, method=None, raw=None, headers=None):
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    r = urllib.request.Request(base + path, data=body, method=method or ("POST" if body is not None else "GET"),
                               headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return resp.status, resp.read()


def _wait_job(base, timeout=120):
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = json.loads(_req(base, "/api/state")[1])
        if st["job"] is None or st["job"]["done"]:
            return st
        time.sleep(0.3)
    raise AssertionError("job timeout")


def test_studio_flow(demo_project, tmp_path):
    hub = Hub(demo_project.root.parent, demo_project.root)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(hub))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    try:
        st = _wait_job(base)
        assert st["project"]["name"] == demo_project.root.name
        assert {m["role"] for m in st["media"]} >= {"footage", "music"}
        code, html = _req(base, "/")
        assert code == 200 and "Монтажшы" in html.decode()
        _req(base, "/api/settings", {"style": "dynamic", "aspect": "9:16", "script": "1. Таң\n2. Түн"})
        st = json.loads(_req(base, "/api/state")[1])
        assert st["settings"]["style"] == "dynamic" and st["output"]["width"] < st["output"]["height"]
        # сценарийді .txt ретінде жүктеу
        _req(base, "/api/upload?name=scenariy.txt", raw="# Атау\n1. Бір".encode(), method="PUT")
        assert json.loads(_req(base, "/api/state")[1])["settings"]["script"].startswith("# Атау")
        # автомонтаж + превью
        assert json.loads(_req(base, "/api/auto", {})[1])["ok"]
        st = _wait_job(base, 300)
        assert st["job"]["error"] is None, st["job"]
        assert st["timeline"]["clips"] and "preview" in st["renders"]
        code, chunk = _req(base, "/files/renders/preview.mp4", headers={"Range": "bytes=0-99"})
        assert code == 206 and len(chunk) == 100
        # жоба қалтасынан тыс файлдарға рұқсат жоқ
        try:
            _req(base, "/files/../../etc/passwd")
            raise AssertionError("path traversal")
        except urllib.error.HTTPError as e:
            assert e.code in (403, 404)
    finally:
        srv.shutdown()


def test_safe_name():
    assert safe_name("../../evil.mp4") == "evil.mp4"
    assert safe_name("Той видео: 1?.mov").endswith(".mov")
    assert safe_name("Қала_түні.mp4") == "Қала_түні.mp4"
