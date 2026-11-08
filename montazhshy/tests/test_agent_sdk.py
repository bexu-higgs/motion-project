"""Агенттің нақты Anthropic SDK арқылы жіберетін сұранысын жергілікті жалған серверде тексеру."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from montazhshy.agent.agent import FALLBACK_BETA, EditorAgent


def _sse(events: list[dict]) -> bytes:
    out = []
    for e in events:
        out.append(f"event: {e['type']}\ndata: {json.dumps(e)}\n\n")
    return "".join(out).encode()


def _tool_turn() -> bytes:
    return _sse([
        {"type": "message_start", "message": {"id": "msg_1", "type": "message", "role": "assistant",
                                              "model": "claude-opus-5-5", "content": [], "stop_reason": None,
                                              "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 1}}},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Жобаны қараймын."}},
        {"type": "content_block_stop", "index": 0},
        {"type": "content_block_start", "index": 1,
         "content_block": {"type": "tool_use", "id": "toolu_1", "name": "project_overview", "input": {}}},
        {"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": "{}"}},
        {"type": "content_block_stop", "index": 1},
        {"type": "message_delta", "delta": {"stop_reason": "tool_use", "stop_sequence": None},
         "usage": {"output_tokens": 20}},
        {"type": "message_stop"},
    ])


def _final_turn() -> bytes:
    return _sse([
        {"type": "message_start", "message": {"id": "msg_2", "type": "message", "role": "assistant",
                                              "model": "claude-opus-5-5", "content": [], "stop_reason": None,
                                              "stop_sequence": None, "usage": {"input_tokens": 12, "output_tokens": 1}}},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Дайын."}},
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None},
         "usage": {"output_tokens": 5}},
        {"type": "message_stop"},
    ])


@pytest.fixture()
def fake_api():
    seen: list[tuple[dict, dict]] = []

    class H(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            seen.append((dict(self.headers), body))
            payload = _tool_turn() if len(seen) == 1 else _final_turn()
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *a):
            pass

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    yield f"http://127.0.0.1:{srv.server_address[1]}", seen
    srv.shutdown()


def test_agent_request_shape(fake_api, demo_project, monkeypatch):
    url, seen = fake_api
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", url)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    events: list[dict] = []
    agent = EditorAgent(demo_project, emit=events.append)
    out = agent.run("Монтаж жаса")
    assert out == "Дайын."
    assert len(seen) == 2
    headers, body = seen[0]
    assert body["model"] == "claude-opus-5-5"
    assert body["stream"] is True
    assert body["thinking"] == {"type": "adaptive", "display": "summarized"}
    assert body["output_config"]["effort"] == "high"
    assert body["fallbacks"] == "default"
    assert FALLBACK_BETA in headers.get("anthropic-beta", headers.get("Anthropic-Beta", ""))
    assert body["cache_control"] == {"type": "ephemeral"}
    assert all(t.get("eager_input_streaming") is True for t in body["tools"])
    assert "<project_overview>" in body["messages"][0]["content"]
    # екінші сұраныста құрал нәтижесі бар
    second = seen[1][1]["messages"]
    assert second[1]["role"] == "assistant"
    assert second[2]["content"][0]["type"] == "tool_result"
    assert second[2]["content"][0]["tool_use_id"] == "toolu_1"
    kinds = [e["type"] for e in events]
    assert "text_delta" in kinds and "tool" in kinds and kinds[-1] == "done"
