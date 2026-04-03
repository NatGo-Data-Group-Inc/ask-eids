#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Interactive AskSage terminal client.

This client is designed for a real-world enclave environment where:
- network / cert handling is already solved,
- AskSage API access is working,
- the Python client is currently usable for query() calls,
- but file upload is not yet supported by asksageclient.

What this client provides
-------------------------
1. Interactive terminal chat loop
2. Local conversation memory
3. Rolling summary to keep prompt size under control
4. Autosave of session transcript
5. Optional markdown rendering with Rich if installed
6. Fallback text rendering if Rich is not installed
7. Readline history / arrow-key editing if available
8. Local file "attach" support
   - files are staged locally
   - nothing is sent immediately
   - the user gets a chance to enter prompt instructions first
   - on the next prompt, attached text files are injected into the prompt

Important honesty note
----------------------
This client does NOT perform true server-side AskSage uploads because the
current asksageclient does not support them yet.  Instead, text-like files
are read locally and included in the prompt when the user actually sends
their next message.

That means:
- text / code / JSON / CSV / logs can work well
- binary formats are only represented by metadata unless you add extraction
  logic later

Usage examples
--------------
Run with defaults:
    python chatgenai.py

Run and stage files before first prompt:
    python chatgenai.py --attach-files /path/spec.md /path/errors.log

Override model:
    python chatgenai.py --model gpt-4.1

Useful slash commands inside the client:
    /help
    /files
    /attach /path/to/file.txt
    /model gpt-4.1-mini
    /summary
    /summarize
    /save /tmp/session.json
    /load /tmp/session.json
    /exit
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import textwrap
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

from asksageclient import AskSageClient

# Optional readline support.
# On most Linux systems this gives you:
# - up/down arrow history
# - left/right cursor movement
# - basic interactive line editing
try:
    import readline  # noqa: F401

    READLINE_AVAILABLE = True
except ImportError:
    readline = None
    READLINE_AVAILABLE = False

# Optional Rich support for better markdown rendering in the terminal.
# If Rich is not installed, the client still works and falls back to a simple renderer.
try:
    from rich.console import Console
    from rich.markdown import Markdown

    RICH_AVAILABLE = True
except ImportError:
    Console = None
    Markdown = None
    RICH_AVAILABLE = False


@dataclass
class ChatTurn:
    """Represents a single user or assistant message in local history."""
    role: str
    content: str
    timestamp: str = field(
        default_factory=lambda: datetime.utcnow().isoformat(timespec="seconds") + "Z"
    )


@dataclass
class AttachedFile:
    """
    Represents a locally staged file.

    This is NOT a true remote upload object.
    It is a local file whose content may be injected into the next prompt.
    """
    local_path: str
    name: str = ""
    mime_type: str = ""
    inline_text: str = ""
    was_truncated: bool = False
    included_in_prompt: bool = True


def setup_readline_history(history_path: str) -> None:
    """Initialize readline history if available."""
    if not READLINE_AVAILABLE:
        return

    try:
        readline.parse_and_bind("set editing-mode emacs")
        readline.parse_and_bind("tab: complete")
        if os.path.exists(history_path):
            readline.read_history_file(history_path)
    except Exception:
        # Readline is a convenience feature, not critical behavior.
        pass


def save_readline_history(history_path: str) -> None:
    """Persist readline history if available."""
    if not READLINE_AVAILABLE:
        return

    try:
        readline.write_history_file(history_path)
    except Exception:
        pass


class AskSageInteractiveChat:
    """
    Interactive terminal wrapper around AskSageClient.

    Because the current client appears to expose a single-turn query API,
    this wrapper preserves local state and rebuilds a multi-turn prompt
    on each request.
    """

    def __init__(
        self,
        client: AskSageClient,
        model: str,
        allowed_models: Optional[List[str]] = None,
        system_prompt: str = "",
        max_turns: int = 20,
        verbose: bool = False,
        autosave_path: str = "",
        summarize_every_n_turns: int = 6,
        summary_model: str = "gpt-4o",
        markdown_render: bool = True,
        max_file_chars: int = 50000,
        max_total_attachment_chars: int = 150000,
    ) -> None:
        self.client = client
        self.model = model
        self.allowed_models = allowed_models or []
        self.system_prompt = system_prompt.strip()
        self.max_turns = max_turns
        self.verbose = verbose
        self.autosave_path = autosave_path.strip()
        self.summarize_every_n_turns = summarize_every_n_turns
        self.summary_model = summary_model.strip() or model
        self.markdown_render = markdown_render

        # Local session state.
        self.history: List[ChatTurn] = []
        self.attached_files: List[AttachedFile] = []

        # Rolling summary of earlier conversation.
        self.session_summary = ""
        self._last_summary_turn_count = 0

        # Attachment budgets to avoid blowing up prompt size.
        self.max_file_chars = max_file_chars
        self.max_total_attachment_chars = max_total_attachment_chars

        # Optional Rich console for better terminal rendering.
        self.console = Console() if RICH_AVAILABLE else None

        if self.allowed_models and self.model not in self.allowed_models:
            raise ValueError(
                f"Initial model '{self.model}' is not in allowed models: "
                f"{', '.join(self.allowed_models)}"
            )

    # ------------------------------------------------------------------
    # Configuration / state helpers
    # ------------------------------------------------------------------

    def set_model(self, model: str) -> None:
        """Set the active model, enforcing allowed-model policy if configured."""
        if self.allowed_models and model not in self.allowed_models:
            raise ValueError(
                f"Model '{model}' is not allowed. Allowed: "
                f"{', '.join(self.allowed_models)}"
            )
        self.model = model

    def set_system_prompt(self, prompt: str) -> None:
        """Set or replace the system prompt."""
        self.system_prompt = prompt.strip()

    def clear_history(self) -> None:
        """Clear conversation history, summary, and staged attachments."""
        self.history.clear()
        self.attached_files.clear()
        self.session_summary = ""
        self._last_summary_turn_count = 0

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save_transcript(self, path: str) -> None:
        """Save all relevant local session state to JSON."""
        payload = {
            "saved_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "model": self.model,
            "allowed_models": self.allowed_models,
            "system_prompt": self.system_prompt,
            "max_turns": self.max_turns,
            "autosave_path": self.autosave_path,
            "summarize_every_n_turns": self.summarize_every_n_turns,
            "summary_model": self.summary_model,
            "markdown_render": self.markdown_render,
            "session_summary": self.session_summary,
            "max_file_chars": self.max_file_chars,
            "max_total_attachment_chars": self.max_total_attachment_chars,
            "history": [turn.__dict__ for turn in self.history],
            "attached_files": [item.__dict__ for item in self.attached_files],
        }

        with open(path, "w", encoding="utf-8") as outfile:
            json.dump(payload, outfile, indent=2)

    def load_transcript(self, path: str) -> None:
        """Load a previously saved local session JSON file."""
        with open(path, "r", encoding="utf-8") as infile:
            payload = json.load(infile)

        loaded_model = payload.get("model", self.model)
        loaded_allowed_models = payload.get("allowed_models", self.allowed_models)

        if loaded_allowed_models:
            self.allowed_models = loaded_allowed_models

        if self.allowed_models and loaded_model not in self.allowed_models:
            raise ValueError(
                f"Loaded model '{loaded_model}' is not in allowed models: "
                f"{', '.join(self.allowed_models)}"
            )

        self.model = loaded_model
        self.system_prompt = payload.get("system_prompt", self.system_prompt)
        self.max_turns = payload.get("max_turns", self.max_turns)
        self.autosave_path = payload.get("autosave_path", self.autosave_path)
        self.summarize_every_n_turns = payload.get(
            "summarize_every_n_turns",
            self.summarize_every_n_turns,
        )
        self.summary_model = payload.get("summary_model", self.summary_model)
        self.markdown_render = payload.get("markdown_render", self.markdown_render)
        self.session_summary = payload.get("session_summary", "")
        self.max_file_chars = payload.get("max_file_chars", self.max_file_chars)
        self.max_total_attachment_chars = payload.get(
            "max_total_attachment_chars",
            self.max_total_attachment_chars,
        )

        self.history = [
            ChatTurn(
                role=item["role"],
                content=item["content"],
                timestamp=item.get("timestamp", ""),
            )
            for item in payload.get("history", [])
        ]

        self.attached_files = [
            AttachedFile(
                local_path=item["local_path"],
                name=item.get("name", ""),
                mime_type=item.get("mime_type", ""),
                inline_text=item.get("inline_text", ""),
                was_truncated=item.get("was_truncated", False),
                included_in_prompt=item.get("included_in_prompt", True),
            )
            for item in payload.get("attached_files", [])
        ]

        self._last_summary_turn_count = len(
            [turn for turn in self.history if turn.role == "user"]
        )

    def _autosave_if_configured(self) -> None:
        """Autosave the session if an autosave path is configured."""
        if not self.autosave_path:
            return
        self.save_transcript(self.autosave_path)

    # ------------------------------------------------------------------
    # File attach support (local staging, not remote upload)
    # ------------------------------------------------------------------

    def _guess_mime_type(self, path: str) -> str:
        """Best-effort MIME type guess from filename."""
        mime_type, _ = mimetypes.guess_type(path)
        return mime_type or "application/octet-stream"

    def _is_probably_text_file(self, mime_type: str, path: str) -> bool:
        """
        Decide whether a file is likely safe to inline into the prompt as text.
        """
        if mime_type.startswith("text/"):
            return True

        text_extensions = {
            ".txt", ".md", ".rst", ".json", ".yaml", ".yml", ".xml",
            ".csv", ".log", ".ini", ".cfg", ".conf", ".py", ".sh",
            ".sql", ".ps1", ".java", ".js", ".ts", ".html", ".css",
        }
        return Path(path).suffix.lower() in text_extensions

    def attach_file(self, path: str) -> AttachedFile:
        """
        Stage one local file.

        Nothing is sent to AskSage at attach time.  The file is simply recorded
        and, if text-like, its contents are made available for later prompt
        injection when the user actually sends a message.
        """
        file_path = Path(path).expanduser().resolve()
        if not file_path.exists():
            raise FileNotFoundError(f"Attach file not found: {file_path}")

        mime_type = self._guess_mime_type(str(file_path))
        attached = AttachedFile(
            local_path=str(file_path),
            name=file_path.name,
            mime_type=mime_type,
        )

        if self._is_probably_text_file(mime_type, str(file_path)):
            raw_text = file_path.read_text(encoding="utf-8", errors="replace")
            if len(raw_text) > self.max_file_chars:
                attached.inline_text = raw_text[: self.max_file_chars]
                attached.was_truncated = True
            else:
                attached.inline_text = raw_text
        else:
            # Binary or unsupported file: keep metadata only.
            attached.included_in_prompt = False

        self.attached_files.append(attached)
        self._autosave_if_configured()
        return attached

    def attach_files(self, paths: List[str]) -> List[AttachedFile]:
        """Stage multiple local files."""
        results: List[AttachedFile] = []
        for path in paths:
            results.append(self.attach_file(path))
        return results

    def print_attached_files(self) -> None:
        """Display currently staged local files."""
        if not self.attached_files:
            print("[No attached files staged]")
            return

        print("[Attached files]")
        for item in self.attached_files:
            truncated = " | truncated" if item.was_truncated else ""
            mode = "inline" if item.included_in_prompt else "metadata-only"
            print(f"- {item.name} | {item.mime_type} | {mode}{truncated}")

    def format_attached_files_context(self) -> str:
        """
        Build the attachment block to inject into the next prompt.

        This happens only when the user sends a real message.  Attaching files
        alone does not call AskSage.
        """
        if not self.attached_files:
            return ""

        parts: List[str] = ["ATTACHED LOCAL FILES FOR THIS TURN:"]
        total_chars = 0

        for item in self.attached_files:
            parts.append(f"FILE: {item.name}")
            parts.append(f"PATH: {item.local_path}")
            parts.append(f"MIME: {item.mime_type}")

            if item.included_in_prompt and item.inline_text:
                remaining = self.max_total_attachment_chars - total_chars
                if remaining <= 0:
                    parts.append("CONTENT: [omitted: total attachment budget exceeded]")
                else:
                    content = item.inline_text[:remaining]
                    total_chars += len(content)
                    parts.append("CONTENT:")
                    parts.append(content)
                    if item.was_truncated or len(content) < len(item.inline_text):
                        parts.append("[content truncated]")
            else:
                parts.append("CONTENT: [not inlined: binary or unsupported text format]")

            parts.append("")

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Summary management
    # ------------------------------------------------------------------

    def _should_summarize(self) -> bool:
        """Determine whether it is time to refresh the rolling summary."""
        if self.summarize_every_n_turns <= 0:
            return False

        user_turns = len([turn for turn in self.history if turn.role == "user"])
        return user_turns - self._last_summary_turn_count >= self.summarize_every_n_turns

    def _generate_summary(self) -> str:
        """
        Ask the model to produce a compact running summary of the session.

        This helps keep context manageable across longer conversations.
        """
        if not self.history:
            return ""

        lines: List[str] = []

        if self.system_prompt:
            lines.append("SYSTEM INSTRUCTIONS:")
            lines.append(self.system_prompt)
            lines.append("")

        if self.session_summary:
            lines.append("PRIOR SUMMARY:")
            lines.append(self.session_summary)
            lines.append("")

        lines.append("CONVERSATION TO SUMMARIZE:")
        for turn in self.history:
            lines.append(f"{turn.role.upper()}: {turn.content}")

        lines.append("")
        lines.append(
            "TASK: Produce a concise but information-dense running summary of the "
            "conversation. Preserve user goals, constraints, decisions, open questions, "
            "technical details, filenames, commands, errors, and next steps. "
            "Do not invent facts."
        )

        prompt = "\n".join(lines)
        response = self.client.query(message=prompt, model=self.summary_model)
        return self._extract_message(response).strip()

    def maybe_refresh_summary(self) -> None:
        """Refresh the rolling summary if the configured threshold is reached."""
        if not self._should_summarize():
            return

        try:
            summary = self._generate_summary()
            if summary:
                self.session_summary = summary
                self._last_summary_turn_count = len(
                    [turn for turn in self.history if turn.role == "user"]
                )
                self._autosave_if_configured()
                print("[Session summary refreshed]")
        except Exception as exc:  # noqa: BLE001
            print(f"[Summary refresh failed] {exc}", file=sys.stderr)

    # ------------------------------------------------------------------
    # Prompt building and AskSage calls
    # ------------------------------------------------------------------

    def _build_message(self, user_message: str) -> str:
        """
        Build the actual message sent to AskSage.

        This reconstructs a multi-turn conversation using:
        - optional system prompt
        - attached local files
        - rolling summary
        - recent conversation history
        - the new user message
        """
        retained_history = self.history[-(self.max_turns * 2):]
        parts: List[str] = []

        if self.system_prompt:
            parts.append("SYSTEM INSTRUCTIONS:")
            parts.append(self.system_prompt)
            parts.append("")

        attached_context = self.format_attached_files_context()
        if attached_context:
            parts.append(attached_context)
            parts.append("")

        if self.session_summary:
            parts.append("SESSION SUMMARY:")
            parts.append(self.session_summary)
            parts.append("")

        if retained_history:
            parts.append("RECENT CONVERSATION:")
            for turn in retained_history:
                parts.append(f"{turn.role.upper()}: {turn.content}")
            parts.append("")

        parts.append("USER:")
        parts.append(user_message)
        parts.append("")
        parts.append("ASSISTANT:")

        return "\n".join(parts)

    @staticmethod
    def _extract_message(response: Any) -> str:
        """
        Extract assistant text from a defensive set of possible response shapes.
        """
        if response is None:
            return "[No response returned]"

        if isinstance(response, str):
            return response

        if isinstance(response, dict):
            for key in ("message", "response", "content", "answer", "text"):
                value = response.get(key)
                if isinstance(value, str):
                    return value
            return json.dumps(response, indent=2)

        return str(response)

    def ask(self, user_message: str) -> str:
        """
        Send the composed prompt to AskSage and store the resulting turn locally.
        """
        composed_message = self._build_message(user_message)

        if self.verbose:
            print("\n[debug] sending composed prompt:\n", file=sys.stderr)
            print(composed_message, file=sys.stderr)
            print("", file=sys.stderr)

        response = self.client.query(message=composed_message, model=self.model)
        assistant_text = self._extract_message(response)

        self.history.append(ChatTurn(role="user", content=user_message))
        self.history.append(ChatTurn(role="assistant", content=assistant_text))

        # After a prompt is actually sent, keep attachments staged unless you prefer
        # one-shot behavior later. For now, they remain attached until /clear or reload.
        self._autosave_if_configured()
        self.maybe_refresh_summary()

        return assistant_text

    # ------------------------------------------------------------------
    # Rendering helpers
    # ------------------------------------------------------------------

    def _render_markdownish_fallback(self, text: str) -> str:
        """
        Lightweight terminal-friendly fallback renderer.

        This is not full Markdown.  It simply keeps the output readable when
        Rich is not available.
        """
        lines = text.splitlines()
        rendered: List[str] = []
        in_code_block = False

        for line in lines:
            stripped = line.strip()

            if stripped.startswith("```"):
                in_code_block = not in_code_block
                rendered.append(line)
                continue

            if in_code_block:
                rendered.append(line)
                continue

            if stripped.startswith("#"):
                rendered.append(stripped)
                continue

            if stripped.startswith(("- ", "* ", "1. ", "2. ", "3. ", "4. ", "5. ")):
                rendered.append(stripped)
                continue

            if stripped:
                rendered.append(
                    textwrap.fill(
                        stripped,
                        width=100,
                        replace_whitespace=False,
                        drop_whitespace=False,
                    )
                )
            else:
                rendered.append("")

        return "\n".join(rendered)

    def _render_markdown(self, text: str) -> None:
        """
        Render output.

        If Rich is available, use real terminal markdown rendering.
        Otherwise use a simpler readable fallback.
        """
        if not self.markdown_render:
            print(text)
            return

        if RICH_AVAILABLE and self.console:
            self.console.print(Markdown(text))
            return

        print(self._render_markdownish_fallback(text))

    # ------------------------------------------------------------------
    # Slash commands
    # ------------------------------------------------------------------

    def print_help(self) -> None:
        """Display available slash commands."""
        help_text = """
Commands
--------
/help                         Show this help
/exit                         Exit chat
/quit                         Exit chat
/clear                        Clear local history, summary, and staged files
/model                        Show current model
/models                       Show allowed models
/model <name>                 Change model
/system                       Show current system prompt
/system <text>                Set system prompt
/save <path>                  Save transcript to JSON
/load <path>                  Load transcript from JSON
/history                      Show local transcript
/summary                      Show current rolling summary
/summarize                    Force refresh of rolling summary
/autosave                     Show autosave path
/autosave <path>              Set autosave path
/autosave off                 Disable autosave
/render                       Show markdown rendering state
/render on                    Enable markdown-ish / Rich rendering
/render off                   Disable markdown-ish / Rich rendering
/files                        Show currently staged local files
/attach <path>                Stage one local file for later prompt injection
"""
        print(help_text.strip())

    def print_history(self) -> None:
        """Print local conversation transcript."""
        if not self.history:
            print("[No history]")
            return

        for turn in self.history:
            print(f"{turn.role.upper()}: {turn.content}")

    def handle_command(self, line: str) -> bool:
        """
        Handle slash commands.

        Returns True if handled and no AskSage request should be made.
        """
        stripped = line.strip()

        if stripped in {"/exit", "/quit"}:
            raise SystemExit(0)

        if stripped == "/help":
            self.print_help()
            return True

        if stripped == "/clear":
            self.clear_history()
            self._autosave_if_configured()
            print("[History, summary, and staged files cleared]")
            return True

        if stripped == "/model":
            print(f"[Current model: {self.model}]")
            return True

        if stripped == "/models":
            if self.allowed_models:
                print("[Allowed models]")
                for model in self.allowed_models:
                    marker = " (current)" if model == self.model else ""
                    print(f"- {model}{marker}")
            else:
                print("[No allowed-model list configured]")
            return True

        if stripped.startswith("/model "):
            new_model = stripped[len("/model "):].strip()
            if not new_model:
                print("[Model name is required]")
                return True
            try:
                self.set_model(new_model)
                self._autosave_if_configured()
                print(f"[Model set to: {self.model}]")
            except Exception as exc:  # noqa: BLE001
                print(f"[Error] {exc}")
            return True

        if stripped == "/system":
            print(f"[System prompt]\n{self.system_prompt or '(empty)'}")
            return True

        if stripped.startswith("/system "):
            new_prompt = stripped[len("/system "):].strip()
            self.set_system_prompt(new_prompt)
            self._autosave_if_configured()
            print("[System prompt updated]")
            return True

        if stripped.startswith("/save "):
            path = stripped[len("/save "):].strip()
            if not path:
                print("[Path is required]")
                return True
            self.save_transcript(path)
            print(f"[Saved transcript to {path}]")
            return True

        if stripped.startswith("/load "):
            path = stripped[len("/load "):].strip()
            if not path:
                print("[Path is required]")
                return True
            self.load_transcript(path)
            print(f"[Loaded transcript from {path}]")
            return True

        if stripped == "/history":
            self.print_history()
            return True

        if stripped == "/summary":
            print(f"[Session summary]\n{self.session_summary or '(empty)'}")
            return True

        if stripped == "/summarize":
            try:
                self.session_summary = self._generate_summary()
                self._last_summary_turn_count = len(
                    [turn for turn in self.history if turn.role == "user"]
                )
                self._autosave_if_configured()
                print("[Session summary refreshed]")
            except Exception as exc:  # noqa: BLE001
                print(f"[Error] {exc}")
            return True

        if stripped == "/autosave":
            print(f"[Autosave path: {self.autosave_path or '(disabled)'}]")
            return True

        if stripped.startswith("/autosave "):
            value = stripped[len("/autosave "):].strip()
            if value.lower() == "off":
                self.autosave_path = ""
                print("[Autosave disabled]")
            else:
                self.autosave_path = value
                self._autosave_if_configured()
                print(f"[Autosave path set to: {self.autosave_path}]")
            return True

        if stripped == "/render":
            mode = "Rich" if (RICH_AVAILABLE and self.console) else "fallback"
            state = "on" if self.markdown_render else "off"
            print(f"[Markdown rendering is {state} | renderer: {mode}]")
            return True

        if stripped == "/render on":
            self.markdown_render = True
            self._autosave_if_configured()
            print("[Markdown rendering enabled]")
            return True

        if stripped == "/render off":
            self.markdown_render = False
            self._autosave_if_configured()
            print("[Markdown rendering disabled]")
            return True

        if stripped == "/files":
            self.print_attached_files()
            return True

        if stripped.startswith("/attach "):
            path = stripped[len("/attach "):].strip()
            if not path:
                print("[Path is required]")
                return True
            try:
                attached = self.attach_file(path)
                truncated = " | truncated" if attached.was_truncated else ""
                mode = "inline" if attached.included_in_prompt else "metadata-only"
                print(f"[Attached {attached.name} | {mode}{truncated}]")
            except Exception as exc:  # noqa: BLE001
                print(f"[Error] {exc}")
            return True

        return False

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Run the interactive terminal session."""
        print("AskSage interactive chat")
        print(f"Model: {self.model}")

        if self.allowed_models:
            print(f"Allowed models: {', '.join(self.allowed_models)}")

        if self.autosave_path:
            print(f"Autosave: {self.autosave_path}")

        if self.summarize_every_n_turns > 0:
            print(
                f"Rolling summary: every {self.summarize_every_n_turns} user turns "
                f"(summary model: {self.summary_model})"
            )

        print(f"Markdown renderer: {'Rich' if RICH_AVAILABLE else 'fallback'}")
        print(
            "Type /help for commands. Type /exit to quit.\n"
        )

        while True:
            try:
                user_input = input("you> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n[Exiting]")
                break

            if not user_input:
                continue

            if user_input.startswith("/"):
                try:
                    handled = self.handle_command(user_input)
                except SystemExit:
                    print("[Exiting]")
                    break
                if handled:
                    continue

            try:
                reply = self.ask(user_input)
                print("\nasksage>")
                self._render_markdown(reply)
                print("")
            except Exception as exc:  # noqa: BLE001
                print(f"\n[Error] {exc}\n", file=sys.stderr)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Interactive AskSage terminal chat client."
    )

    parser.add_argument(
        "--email",
        default=os.getenv("ASKSAGE_EMAIL"),
        required=os.getenv("ASKSAGE_EMAIL") is None,
        help="AskSage email. Can also be set via ASKSAGE_EMAIL.",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("ASKSAGE_API_KEY"),
        required=os.getenv("ASKSAGE_API_KEY") is None,
        help="AskSage API key. Can also be set via ASKSAGE_API_KEY.",
    )
    parser.add_argument(
        "--user-base-url",
        default=os.getenv("ASKSAGE_USER_BASE_URL", "https://api.genai.army.mil/user/"),
        help="AskSage user API base URL.",
    )
    parser.add_argument(
        "--server-base-url",
        default=os.getenv(
            "ASKSAGE_SERVER_BASE_URL",
            "https://api.genai.army.mil/server/",
        ),
        help="AskSage server API base URL.",
    )
    parser.add_argument(
        "--ca-bundle",
        default=os.getenv(
            "ASKSAGE_CA_BUNDLE",
            "/efs/di/tjansto/.ssh/asksage_ca_bundle.pem",
        ),
        help="Path to CA bundle PEM.",
    )

    # Requested defaults.
    parser.add_argument(
        "--model",
        default=os.getenv("ASKSAGE_MODEL", "gpt-4o"),
        help="Initial model name.",
    )
    parser.add_argument(
        "--allowed-models",
        default=os.getenv("ASKSAGE_ALLOWED_MODELS", "gpt-4o,gpt-4.1,gpt-4.1-mini"),
        help="Comma-separated allowed models for runtime switching.",
    )
    parser.add_argument(
        "--autosave",
        default=os.getenv(
            "ASKSAGE_AUTOSAVE",
            "/efs/di/tjansto/logs/asksage_chat_session.json",
        ),
        help="Autosave transcript JSON path.",
    )
    parser.add_argument(
        "--summarize-every-n-turns",
        type=int,
        default=int(os.getenv("ASKSAGE_SUMMARIZE_EVERY_N_TURNS", "6")),
        help="Generate a rolling summary every N user turns. 0 disables it.",
    )
    parser.add_argument(
        "--summary-model",
        default=os.getenv("ASKSAGE_SUMMARY_MODEL", "gpt-4o"),
        help="Optional model used for summary generation.",
    )

    parser.add_argument(
        "--system-prompt",
        default=os.getenv("ASKSAGE_SYSTEM_PROMPT", ""),
        help="Optional system prompt.",
    )
    parser.add_argument(
        "--max-turns",
        type=int,
        default=int(os.getenv("ASKSAGE_MAX_TURNS", "20")),
        help="Maximum recent user/assistant turns retained in prompt context.",
    )
    parser.add_argument(
        "--load",
        default="",
        help="Optional transcript JSON file to load on startup.",
    )
    parser.add_argument(
        "--attach-files",
        nargs="*",
        default=[],
        help="One or more local files to stage for later prompt injection.",
    )
    parser.add_argument(
        "--no-markdown-render",
        action="store_true",
        help="Disable markdown rendering / fallback formatting.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print composed prompt payload for debugging.",
    )

    return parser.parse_args()


def main() -> int:
    """Program entry point."""
    args = parse_args()

    # Turn comma-separated model list into a real Python list.
    allowed_models = [
        model.strip()
        for model in args.allowed_models.split(",")
        if model.strip()
    ]

    # Configure persistent readline history if available.
    history_path = os.getenv(
        "ASKSAGE_READLINE_HISTORY",
        "/efs/di/tjansto/logs/asksage_readline_history.txt",
    )
    setup_readline_history(history_path)

    client = AskSageClient(
        email=args.email,
        api_key=args.api_key,
        user_base_url=args.user_base_url,
        server_base_url=args.server_base_url,
        path_to_CA_Bundle=args.ca_bundle,
    )

    chat = AskSageInteractiveChat(
        client=client,
        model=args.model,
        allowed_models=allowed_models,
        system_prompt=args.system_prompt,
        max_turns=args.max_turns,
        verbose=args.verbose,
        autosave_path=args.autosave,
        summarize_every_n_turns=args.summarize_every_n_turns,
        summary_model=args.summary_model,
        markdown_render=not args.no_markdown_render,
    )

    if args.load:
        chat.load_transcript(args.load)

    # Stage files locally but do NOT submit them yet.
    # This preserves the user requirement that they get a chance to type
    # instructions / context before the contents are sent.
    if args.attach_files:
        print("[Staging startup files locally...]")
        try:
            attached = chat.attach_files(args.attach_files)
            print("[Startup files staged locally]")
            for item in attached:
                truncated = " | truncated" if item.was_truncated else ""
                mode = "inline" if item.included_in_prompt else "metadata-only"
                print(f"- {item.name} | {mode}{truncated}")
            print("")
            print("Files are staged. Enter your prompt when ready; nothing has been sent yet.")
            print("")
        except Exception as exc:  # noqa: BLE001
            print(f"[Startup attach error] {exc}", file=sys.stderr)

    try:
        chat.run()
    finally:
        save_readline_history(history_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())