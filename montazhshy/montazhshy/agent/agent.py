"""Монтажшы ЖИ агенті: Claude + құралдар циклі.

Агент кадрларды контакт-парақтар арқылы «көреді», таймлайн жазады, рендерлейді, өз жұмысын тексереді
және түзетеді. Барлық оқиғалар (ойлау, мәтін, құрал шақыру, прогресс) ``emit`` арқылы UI-ға жіберіледі.
"""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Callable

from ..project import Project
from .prompts import SYSTEM_PROMPT, first_message
from .tools import TOOL_LABELS, TOOLS, ToolBox, ToolError, summarize_input

DEFAULT_MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_STEPS = 60

Emit = Callable[[dict], None]


class AgentUnavailable(RuntimeError):
    pass


def api_key_configured() -> bool:
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    # `ant auth login` профилі де жарайды
    cfg = Path.home() / ".config" / "anthropic"
    return cfg.exists() and any(cfg.iterdir())


class EditorAgent:
    def __init__(self, project: Project, *, model: str | None = None, effort: str | None = None,
                 emit: Emit | None = None):
        try:
            import anthropic  # noqa: F401
        except ImportError as e:  # pragma: no cover
            raise AgentUnavailable("`anthropic` кітапханасы орнатылмаған: pip install anthropic") from e
        import anthropic

        self.anthropic = anthropic
        self.client = anthropic.Anthropic()
        self.project = project
        self.model = model or os.environ.get("MONTAZH_MODEL") or DEFAULT_MODEL
        self.effort = effort or os.environ.get("MONTAZH_EFFORT") or "high"
        self.emit = emit or (lambda e: None)
        self.tools = ToolBox(project, self._emit)
        self.messages: list[dict] = []
        self.stop_flag = threading.Event()
        self.busy = False
        self.usage = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
        self.transcript_path = project.cache_dir / "chat.json"

    # ------------------------------------------------------------------ оқиғалар
    def _emit(self, ev: dict) -> None:
        ev.setdefault("t", time.time())
        try:
            self.emit(ev)
        except Exception:  # UI қатесі агентті тоқтатпауы керек
            pass

    def _log(self, role: str, text: str) -> None:
        try:
            hist = json.loads(self.transcript_path.read_text("utf-8")) if self.transcript_path.exists() else []
        except (OSError, json.JSONDecodeError):
            hist = []
        hist.append({"role": role, "text": text, "t": time.time()})
        self.transcript_path.parent.mkdir(parents=True, exist_ok=True)
        self.transcript_path.write_text(json.dumps(hist[-200:], ensure_ascii=False), "utf-8")

    def stop(self) -> None:
        self.stop_flag.set()

    # ------------------------------------------------------------------ сұраныс
    def _request(self) -> Any:
        tools = [dict(t, eager_input_streaming=True) for t in TOOLS]
        kwargs: dict[str, Any] = dict(
            model=self.model,
            max_tokens=64000,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=self.messages,
            thinking={"type": "adaptive", "display": "summarized"},
            output_config={"effort": self.effort},
            cache_control={"type": "ephemeral"},
        )
        # Қауіпсіздік сүзгісі сұранысты қабылдамаса, сервер оны өзі ұсынылған модельде қайталайды.
        if self.model.startswith(("claude-opus-5", "claude-fable-5", "claude-sonnet-5-5")):
            kwargs["betas"] = [FALLBACK_BETA]
            kwargs["fallbacks"] = "default"
        stream_cm = self.client.beta.messages.stream(**kwargs)
        with stream_cm as stream:
            for event in stream:
                if self.stop_flag.is_set():
                    break
                et = getattr(event, "type", "")
                if et == "text":
                    self._emit({"type": "text_delta", "text": event.text})
                elif et == "thinking":
                    self._emit({"type": "thinking_delta", "text": event.thinking})
            return stream.get_final_message()

    def run(self, user_text: str) -> str:
        """Пайдаланушы хабарын өңдеп, агент тоқтағанша құралдарды орындау. Соңғы мәтінді қайтарады."""
        if self.busy:
            raise RuntimeError("Агент әлі жұмыс істеп жатыр")
        self.busy = True
        self.stop_flag.clear()
        final_text = ""
        try:
            if not self.messages:
                overview = json.dumps(self.tools.overview(), ensure_ascii=False)
                content = first_message(overview, user_text)
            else:
                content = user_text
            self.messages.append({"role": "user", "content": content})
            self._log("user", user_text)
            self._emit({"type": "user", "text": user_text})
            for _step in range(MAX_STEPS):
                if self.stop_flag.is_set():
                    self._emit({"type": "stopped"})
                    break
                self._emit({"type": "thinking_start"})
                try:
                    msg = self._request()
                except self.anthropic.AuthenticationError:
                    self._emit({"type": "error", "text": "API кілті жарамсыз. «Баптау» бөлімінде кілтті тексеріңіз."})
                    raise
                except self.anthropic.RateLimitError:
                    self._emit({"type": "error", "text": "Сұраныс шегіне жеттік — бір минуттан кейін қайталаймын."})
                    time.sleep(30)
                    continue
                except self.anthropic.APIConnectionError:
                    self._emit({"type": "error", "text": "Интернет байланысы жоқ сияқты. Қайта көріңіз."})
                    raise
                u = msg.usage
                self.usage["input"] += u.input_tokens or 0
                self.usage["output"] += u.output_tokens or 0
                self.usage["cache_read"] += getattr(u, "cache_read_input_tokens", 0) or 0
                self.usage["cache_write"] += getattr(u, "cache_creation_input_tokens", 0) or 0
                self.messages.append({"role": "assistant", "content": msg.content})
                texts = [b.text for b in msg.content if getattr(b, "type", "") == "text" and b.text.strip()]
                for b in msg.content:
                    if getattr(b, "type", "") == "thinking" and getattr(b, "thinking", ""):
                        self._emit({"type": "thinking", "text": b.thinking})
                if texts:
                    final_text = "\n\n".join(texts)
                    self._emit({"type": "assistant", "text": final_text})
                if msg.stop_reason == "refusal":
                    self._emit({"type": "error", "text": "Модель бұл сұранысты орындамады. Сұранысты басқаша жазып көріңіз."})
                    break
                if msg.stop_reason == "pause_turn":
                    continue
                if msg.stop_reason == "max_tokens":
                    # аяқталмаған құрал шақыруын орындамаймыз — модельден жалғастыруды сұраймыз
                    pending = [b for b in msg.content if getattr(b, "type", "") == "tool_use"]
                    results = [{"type": "tool_result", "tool_use_id": b.id, "is_error": True,
                                "content": "Output was cut off (max_tokens). Send a smaller call."} for b in pending]
                    self.messages.append({"role": "user", "content": results or "Continue."})
                    continue
                uses = [b for b in msg.content if getattr(b, "type", "") == "tool_use"]
                if not uses:
                    break
                results = []
                for b in uses:
                    results.append(self._run_tool(b))
                self.messages.append({"role": "user", "content": results})
            if final_text:
                self._log("assistant", final_text)
            self._emit({"type": "done", "usage": dict(self.usage)})
            return final_text
        finally:
            self.busy = False

    def _run_tool(self, block: Any) -> dict:
        name = block.name
        args = block.input if isinstance(block.input, dict) else {}
        label = TOOL_LABELS.get(name, name)
        self._emit({"type": "tool", "name": name, "label": label, "detail": summarize_input(name, args)})
        t0 = time.time()
        try:
            out = self.tools.call(name, args)
            content: Any = out if isinstance(out, list) else [{"type": "text", "text": str(out)}]
            ok = True
            summary = ""
            for c in content:
                if c.get("type") == "text":
                    summary = c["text"].splitlines()[0][:160]
                    break
            self._emit({"type": "tool_done", "name": name, "label": label, "ok": True,
                        "seconds": round(time.time() - t0, 1), "summary": summary})
        except ToolError as e:
            content, ok = f"Error: {e}", False
        except Exception as e:  # құрал құласа да агент жұмысын жалғастырады
            content, ok = f"Error: {type(e).__name__}: {e}", False
        if not ok:
            self._emit({"type": "tool_done", "name": name, "label": label, "ok": False,
                        "seconds": round(time.time() - t0, 1), "summary": str(content)[:300]})
            return {"type": "tool_result", "tool_use_id": block.id, "content": str(content), "is_error": True}
        return {"type": "tool_result", "tool_use_id": block.id, "content": content}
