from __future__ import annotations

import json
from pathlib import Path

from python.client.asksage_client import AskSageInteractiveChat


class FakeAskSageClient:
    def __init__(self, responses: list[object]) -> None:
        self._responses = list(responses)
        self.calls: list[dict[str, str]] = []

    def query(self, message: str, model: str) -> object:
        self.calls.append({"message": message, "model": model})
        return self._responses.pop(0)


def test_extract_message_handles_nested_response_shapes() -> None:
    response = {
        "choices": [
            {"message": {"content": [{"text": "first part"}, {"text": "second part"}]}}
        ]
    }
    assert AskSageInteractiveChat._extract_message(response) == "first part\nsecond part"


def test_save_transcript_creates_parent_directories(tmp_path: Path) -> None:
    chat = AskSageInteractiveChat(
        client=FakeAskSageClient(["ok"]),
        model="gpt-4o",
    )
    destination = tmp_path / "nested" / "session.json"
    chat.save_transcript(str(destination))

    assert destination.exists()
    payload = json.loads(destination.read_text(encoding="utf-8"))
    assert payload["model"] == "gpt-4o"


def test_ask_builds_prompt_with_attachment_context(tmp_path: Path) -> None:
    attachment = tmp_path / "notes.md"
    attachment.write_text("# Notes\nline one\n", encoding="utf-8")

    fake_client = FakeAskSageClient([{"message": "reply"}])
    chat = AskSageInteractiveChat(
        client=fake_client,
        model="gpt-4o",
        system_prompt="Stay concise.",
        max_turns=2,
    )
    chat.attach_file(str(attachment))

    reply = chat.ask("Summarize the attached file.")

    assert reply == "reply"
    assert "ATTACHED LOCAL FILES FOR THIS TURN:" in fake_client.calls[0]["message"]
    assert "FILE: notes.md" in fake_client.calls[0]["message"]
    assert "SYSTEM INSTRUCTIONS:" in fake_client.calls[0]["message"]
    assert chat.history[-1].content == "reply"
