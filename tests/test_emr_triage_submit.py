from __future__ import annotations

import json
from pathlib import Path

from asksage_harness import emr_triage_submit


class FakeClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []

    def query(self, message: str, model: str) -> dict[str, str]:
        self.calls.append({"message": message, "model": model})
        return {"message": "# Result\n\nsynthetic response"}


def test_run_submission_writes_analysis_and_asksage_outputs(tmp_path: Path, monkeypatch) -> None:
    fixture = Path("tests/fixtures/emr_missing_nameservice")
    bundle_dir = tmp_path / "input"
    bundle_dir.mkdir(parents=True)

    fake_client = FakeClient()

    monkeypatch.setattr(emr_triage_submit, "create_submission_client", lambda **_: fake_client)

    result = emr_triage_submit.run_submission(
        bundle=fixture,
        input_dir=bundle_dir,
        output_dir=tmp_path / "out",
        scratch_dir=tmp_path / "scratch",
        mode="local",
        model="test-model",
        system_prompt="Follow enclave policy.",
    )

    assert Path(result["report"]).exists()
    assert Path(result["prompt_brief"]).exists()
    assert Path(result["asksage_response_json"]).exists()
    assert Path(result["asksage_response_markdown"]).exists()

    response_json = json.loads(Path(result["asksage_response_json"]).read_text(encoding="utf-8"))
    assert response_json["model"] == "test-model"
    assert response_json["mode"] == "local"
    assert "Follow enclave policy." in response_json["message"]
    assert "A. Executive diagnosis" in response_json["message"]
    assert fake_client.calls[0]["model"] == "test-model"
