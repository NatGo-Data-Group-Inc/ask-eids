from __future__ import annotations

import json
import os
import tarfile
from pathlib import Path

from emr_triage.analyze_artifacts import (
    analyze,
    artifact_root,
    collect_configs,
    render_markdown,
    resolve_bundle,
    write_outputs,
)


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_analyze_detects_missing_ha_config_as_primary_fault(tmp_path: Path) -> None:
    write_file(
        tmp_path / "etc/hadoop/conf/core-site.xml",
        """<configuration>
<property><name>fs.defaultFS</name><value>hdfs://ns1</value></property>
</configuration>""",
    )
    write_file(
        tmp_path / "etc/hadoop/conf/hdfs-site.xml",
        """<configuration>
<property><name>dfs.namenode.name.dir</name><value>/mnt/nn</value></property>
</configuration>""",
    )
    write_file(
        tmp_path / "var/log/hadoop-hdfs/hadoop-hdfs-namenode.log",
        "INFO recovering namespace\nWARN StandbyException operation not supported in state standby\n",
    )

    result = analyze(tmp_path)

    assert result.primary_fault is not None
    assert result.primary_fault.key == "missing_nameservice"
    assert result.diagnosis_type == "HA failover/config problem"
    assert result.confidence == "high"
    report = render_markdown(result)
    assert "A. Executive diagnosis" in report
    assert "fs.defaultFS references HDFS but dfs.nameservices is missing" in report


def test_archive_bundle_is_supported_and_outputs_are_written(tmp_path: Path) -> None:
    artifact_dir = tmp_path / "bundle_src"
    write_file(
        artifact_dir / "etc/hadoop/conf/core-site.xml",
        """<configuration>
<property><name>fs.defaultFS</name><value>hdfs://ip-10-0-0-10:8020</value></property>
</configuration>""",
    )
    write_file(
        artifact_dir / "var/log/hadoop-hdfs/hadoop-hdfs-namenode.log",
        "ERROR java.net.ConnectException: Connection refused: 8020\n",
    )
    bundle_path = tmp_path / "artifacts.tar.gz"
    with tarfile.open(bundle_path, "w:gz") as archive:
        archive.add(artifact_dir, arcname="artifacts")

    root, temp_dir = artifact_root(bundle_path)
    try:
        result = analyze(root)
        outputs = write_outputs(result, tmp_path / "out")
    finally:
        if temp_dir is not None:
            temp_dir.cleanup()

    assert result.primary_fault is not None
    assert result.primary_fault.key == "fs_default_direct_rpc"
    summary = json.loads(Path(outputs["json"]).read_text(encoding="utf-8"))
    assert summary["primary_fault"]["key"] == "fs_default_direct_rpc"
    assert Path(outputs["report"]).exists()
    assert Path(outputs["prompt_brief"]).exists()


def test_collect_configs_supports_numbered_triage_capture_files(tmp_path: Path) -> None:
    write_file(
        tmp_path / "30_fs_default.txt",
        """### COMMAND: hdfs getconf -confKey fs.defaultFS
### TIME: 2026-04-16 09:04:22

hdfs://ha-nn-uri
""",
    )
    write_file(
        tmp_path / "20_nameservices.txt",
        """### COMMAND: hdfs getconf -confKey dfs.nameservices
### TIME: 2026-04-16 09:03:45

ha-nn-uri
""",
    )
    write_file(
        tmp_path / "31_hdfs_site_extract.txt",
        """### COMMAND: grep -E 'dfs.nameservices|dfs.ha.namenodes|dfs.namenode.rpc-address' /etc/hadoop/conf/hdfs-site.xml || true
### TIME: 2026-04-16 09:04:23

    <name>dfs.nameservices</name>
    <name>dfs.ha.namenodes.ha-nn-uri</name>
    <name>dfs.namenode.rpc-address.ha-nn-uri.nn1</name>
    <name>dfs.namenode.rpc-address.ha-nn-uri.nn2</name>
""",
    )

    configs = collect_configs(tmp_path)

    assert configs["fs.defaultFS"] == "hdfs://ha-nn-uri"
    assert configs["dfs.nameservices"] == "ha-nn-uri"
    assert configs["dfs.ha.namenodes.ha-nn-uri"] == "__present__"
    assert configs["dfs.namenode.rpc-address.ha-nn-uri.nn1"] == "__present__"


def test_resolve_bundle_picks_latest_bundle_from_input_dir(tmp_path: Path) -> None:
    older = tmp_path / "older.tgz"
    newer = tmp_path / "newer.tgz"
    older.write_text("x", encoding="utf-8")
    newer.write_text("y", encoding="utf-8")
    os.utime(older, (1, 1))
    os.utime(newer, (2, 2))

    assert resolve_bundle(None, tmp_path) == newer
