from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import tarfile
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree

from data_gen.capabilities import load_capability


DEFAULT_INPUT_DIR = Path(__file__).resolve().parents[1] / "input" / "emr_triage"
TEXT_FILE_SUFFIXES = {
    ".conf",
    ".err",
    ".json",
    ".log",
    ".out",
    ".properties",
    ".txt",
    ".xml",
}


@dataclass(frozen=True)
class Evidence:
    path: str
    line_number: int
    excerpt: str


@dataclass
class Finding:
    key: str
    title: str
    classification: str
    category: str
    score: int
    summary: str
    evidence: list[Evidence] = field(default_factory=list)

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["evidence"] = [asdict(item) for item in self.evidence]
        return payload


@dataclass
class AnalysisResult:
    capability_id: str
    diagnosis_type: str
    primary_fault: Finding | None
    root_causes: list[Finding]
    symptoms: list[Finding]
    noise: list[Finding]
    configs: dict[str, str]
    commands: list[str]
    needs_datanode_artifacts: bool
    datanode_artifacts: list[str]
    confidence: str
    confidence_reason: str

    def to_dict(self) -> dict:
        return {
            "capability_id": self.capability_id,
            "diagnosis_type": self.diagnosis_type,
            "primary_fault": None if self.primary_fault is None else self.primary_fault.to_dict(),
            "root_causes": [item.to_dict() for item in self.root_causes],
            "symptoms": [item.to_dict() for item in self.symptoms],
            "noise": [item.to_dict() for item in self.noise],
            "configs": self.configs,
            "commands": self.commands,
            "needs_datanode_artifacts": self.needs_datanode_artifacts,
            "datanode_artifacts": self.datanode_artifacts,
            "confidence": self.confidence,
            "confidence_reason": self.confidence_reason,
        }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundle",
        type=Path,
        default=None,
        help="Artifact root directory or .tar.gz bundle. If omitted, the latest bundle under input/emr_triage is used.",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help="Directory searched for the latest bundle when --bundle is omitted",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for analysis outputs. If omitted, a bundle-local _analysis/<bundle-name>/ folder is used.",
    )
    parser.add_argument(
        "--capability",
        default="emr_logs",
        help="Capability folder under prompts/ used for prompt metadata",
    )
    parser.add_argument(
        "--scratch-dir",
        type=Path,
        default=None,
        help="Optional directory to use for archive extraction. If omitted, a bundle-local _scratch/ folder is used.",
    )
    return parser


def resolve_bundle(bundle: Path | None, input_dir: Path) -> Path:
    if bundle is not None:
        return bundle

    candidates = sorted(
        (
            path
            for path in input_dir.glob("*")
            if path.is_file() and path.suffix.lower() in {".tgz", ".tar", ".gz"} and path.name.endswith((".tar.gz", ".tgz", ".tar"))
        ),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(f"No artifact bundle found under {input_dir}")
    return candidates[0]


def bundle_label(bundle: Path) -> str:
    name = bundle.name
    for suffix in (".tar.gz", ".tgz", ".tar"):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return bundle.stem


def resolve_output_dir(bundle: Path, output_dir: Path | None) -> Path:
    if output_dir is not None:
        return output_dir
    return bundle.parent / "_analysis" / bundle_label(bundle)


def resolve_scratch_dir(bundle: Path, scratch_dir: Path | None) -> Path:
    if scratch_dir is not None:
        return scratch_dir
    return bundle.parent / "_scratch"


def parse_hadoop_xml(path: Path) -> dict[str, str]:
    try:
        root = ElementTree.fromstring(path.read_text(encoding="utf-8", errors="replace"))
    except ElementTree.ParseError:
        return {}

    properties: dict[str, str] = {}
    for prop in root.findall("./property"):
        name = prop.findtext("name")
        value = prop.findtext("value")
        if name:
            properties[name.strip()] = (value or "").strip()
    return properties


def parse_command_capture_properties(path: Path) -> dict[str, str]:
    properties: dict[str, str] = {}
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    current_name: str | None = None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("### "):
            continue

        name_match = re.search(r"<name>\s*([^<]+)\s*</name>", stripped)
        if name_match:
            current_name = name_match.group(1).strip()
            properties.setdefault(current_name, "__present__")
            continue

        value_match = re.search(r"<value>\s*([^<]+)\s*</value>", stripped)
        if value_match and current_name:
            properties[current_name] = value_match.group(1).strip()
            current_name = None

    return properties


def parse_command_capture_value(path: Path) -> str:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    body = [line.strip() for line in lines if line.strip() and not line.startswith("### ")]
    if not body:
        return ""
    return body[-1]


def sanitize_archive_part(part: str) -> str:
    invalid_chars = '<>:"\\|?*'
    sanitized = "".join("_" if ch in invalid_chars else ch for ch in part)
    sanitized = sanitized.rstrip(" .")
    return sanitized or "_"


def safe_extract_archive(archive: tarfile.TarFile, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for member in archive.getmembers():
        member_path = Path(member.name)
        safe_parts = [sanitize_archive_part(part) for part in member_path.parts if part not in {"", ".", ".."}]
        if not safe_parts:
            continue

        target = destination.joinpath(*safe_parts)
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        if not member.isfile():
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        extracted = archive.extractfile(member)
        if extracted is None:
            continue
        with extracted, target.open("wb") as handle:
            shutil.copyfileobj(extracted, handle)


def iter_text_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in TEXT_FILE_SUFFIXES:
            yield path


def collect_configs(root: Path) -> dict[str, str]:
    config_names = {"core-site.xml", "hdfs-site.xml", "yarn-site.xml", "mapred-site.xml"}
    configs: dict[str, str] = {}
    for path in root.rglob("*"):
        if path.is_file() and path.name in config_names:
            configs.update(parse_hadoop_xml(path))
        elif path.is_file() and path.name in {"31_hdfs_site_extract.txt", "32_core_site_extract.txt"}:
            configs.update(parse_command_capture_properties(path))
        elif path.is_file() and path.name == "20_nameservices.txt":
            value = parse_command_capture_value(path)
            if value:
                configs["dfs.nameservices"] = value
        elif path.is_file() and path.name == "30_fs_default.txt":
            value = parse_command_capture_value(path)
            if value:
                configs["fs.defaultFS"] = value
    return configs


def find_lines(path: Path, patterns: list[re.Pattern[str]], limit: int = 6) -> list[Evidence]:
    matches: list[Evidence] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for index, line in enumerate(lines, start=1):
        if any(pattern.search(line) for pattern in patterns):
            matches.append(Evidence(path=str(path), line_number=index, excerpt=line.strip()))
            if len(matches) >= limit:
                break
    return matches


def artifact_root(bundle: Path, scratch_dir: Path | None = None):
    if bundle.is_dir():
        return bundle, None

    if not bundle.is_file():
        raise FileNotFoundError(f"Artifact bundle not found: {bundle}")

    if not bundle.name.endswith((".tar.gz", ".tgz", ".tar")):
        raise ValueError("Bundle must be a directory or a .tar/.tar.gz/.tgz archive")

    if scratch_dir is None:
        temp_dir = tempfile.TemporaryDirectory()
        with tarfile.open(bundle) as archive:
            safe_extract_archive(archive, Path(temp_dir.name))
        return Path(temp_dir.name), temp_dir

    scratch_dir.mkdir(parents=True, exist_ok=True)
    extract_root = scratch_dir / f"{bundle_label(bundle)}.extract"
    if extract_root.exists():
        shutil.rmtree(extract_root)
    extract_root.mkdir(parents=True, exist_ok=True)
    with tarfile.open(bundle) as archive:
        safe_extract_archive(archive, extract_root)
    return extract_root, None


def build_findings(root: Path, configs: dict[str, str]) -> list[Finding]:
    findings: list[Finding] = []
    text_files = list(iter_text_files(root))

    def add_log_finding(
        *,
        key: str,
        title: str,
        classification: str,
        category: str,
        score: int,
        summary: str,
        patterns: list[str],
    ) -> None:
        compiled = [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
        evidence: list[Evidence] = []
        for path in text_files:
            evidence.extend(find_lines(path, compiled, limit=3))
            if len(evidence) >= 6:
                break
        if evidence:
            findings.append(
                Finding(
                    key=key,
                    title=title,
                    classification=classification,
                    category=category,
                    score=score,
                    summary=summary,
                    evidence=evidence[:6],
                )
            )

    fs_default = configs.get("fs.defaultFS", "")
    nameservices = configs.get("dfs.nameservices", "")
    ha_enabled = any(key.startswith("dfs.ha.namenodes.") for key in configs)
    rpc_keys = [key for key in configs if key.startswith("dfs.namenode.rpc-address.")]

    if fs_default:
        if fs_default.startswith("hdfs://") and ":" in fs_default.rsplit("/", 1)[-1]:
            findings.append(
                Finding(
                    key="fs_default_direct_rpc",
                    title="fs.defaultFS points at a direct host:port endpoint",
                    classification="root_cause",
                    category="ha_failover_config_problem",
                    score=95,
                    summary=(
                        "fs.defaultFS is set to a direct NameNode RPC endpoint instead of an HA nameservice. "
                        "That breaks HA client routing and commonly cascades into standby or failover errors."
                    ),
                    evidence=[
                        Evidence(
                            path="config:core-site.xml",
                            line_number=0,
                            excerpt=f"fs.defaultFS={fs_default}",
                        )
                    ],
                )
            )
        elif fs_default.startswith("hdfs://") and not nameservices:
            findings.append(
                Finding(
                    key="missing_nameservice",
                    title="fs.defaultFS references HDFS but dfs.nameservices is missing",
                    classification="root_cause",
                    category="ha_failover_config_problem",
                    score=92,
                    summary=(
                        "The cluster is configured to use HDFS but lacks dfs.nameservices. "
                        "That points to an incomplete HA configuration rather than a pure runtime fault."
                    ),
                    evidence=[
                        Evidence(
                            path="config:core-site.xml",
                            line_number=0,
                            excerpt=f"fs.defaultFS={fs_default}",
                        ),
                        Evidence(
                            path="config:hdfs-site.xml",
                            line_number=0,
                            excerpt="dfs.nameservices is absent",
                        ),
                    ],
                )
            )

    if nameservices and (not ha_enabled or not rpc_keys):
        findings.append(
            Finding(
                key="incomplete_ha_config",
                title="dfs.nameservices is present but HA NameNode config is incomplete",
                classification="root_cause",
                category="ha_failover_config_problem",
                score=90,
                summary=(
                    "The HDFS config declares a nameservice, but the companion HA config is incomplete. "
                    "Clients and failover controllers will not be able to resolve active/standby NameNodes correctly."
                ),
                evidence=[
                    Evidence(
                        path="config:hdfs-site.xml",
                        line_number=0,
                        excerpt=f"dfs.nameservices={nameservices}",
                    ),
                    Evidence(
                        path="config:hdfs-site.xml",
                        line_number=0,
                        excerpt=f"ha_enabled={ha_enabled}, rpc_keys={len(rpc_keys)}",
                    ),
                ],
            )
        )

    add_log_finding(
        key="standby_state_error",
        title="NameNode appears reachable but in the wrong HA state",
        classification="root_cause" if nameservices or ha_enabled else "symptom",
        category="ha_failover_config_problem",
        score=88,
        summary=(
            "Logs show requests landing on a standby NameNode or HA state checks failing. "
            "That usually means the active/standby election or client HA wiring is wrong."
        ),
        patterns=[
            r"Operation category .* is not supported in state standby",
            r"StandbyException",
            r"Name node is in safe mode",
        ],
    )
    add_log_finding(
        key="namenode_rpc_8020_failure",
        title="NameNode RPC listener on 8020 is not reachable",
        classification="root_cause",
        category="service_startup_problem",
        score=87,
        summary=(
            "Clients are failing to connect to the NameNode RPC listener on port 8020. "
            "That points to a NameNode startup failure, wrong binding, or service not listening."
        ),
        patterns=[
            r"Connection refused.*8020",
            r"Call From .* to .*:8020 failed",
            r"Failed on local exception: java\.io\.EOFException",
            r"java\.net\.ConnectException.*8020",
        ],
    )
    add_log_finding(
        key="zkfc_or_zk_failure",
        title="ZKFC or ZooKeeper coordination failure",
        classification="root_cause",
        category="ha_failover_config_problem",
        score=86,
        summary=(
            "ZKFC or ZooKeeper coordination errors are preventing HA leader election or health monitoring. "
            "This is consistent with NameNode HA failover not converging."
        ),
        patterns=[
            r"ZKFailoverController",
            r"Unable to access ZooKeeper",
            r"KeeperErrorCode",
            r"Session 0x.* expired",
            r"Failover controller",
        ],
    )
    add_log_finding(
        key="resource_manager_failure",
        title="ResourceManager or YARN startup/state problem",
        classification="root_cause",
        category="service_startup_problem",
        score=72,
        summary=(
            "YARN control-plane logs show the ResourceManager not entering a healthy running state. "
            "This matters, but it is often downstream if HDFS never converged."
        ),
        patterns=[
            r"ResourceManager.*FAILED",
            r"Transitioned to state STANDBY",
            r"RMFatalEvent",
            r"Connection to ResourceManager refused",
            r"yarn\.exceptions",
        ],
    )
    add_log_finding(
        key="bootstrap_failure",
        title="Partial cluster initialization or bootstrap failure",
        classification="root_cause",
        category="service_startup_problem",
        score=84,
        summary=(
            "Bootstrap or provisioning steps appear to have failed before the Hadoop control plane finished initializing."
        ),
        patterns=[
            r"bootstrap.*failed",
            r"command-runner\.jar.*failed",
            r"non-zero exit",
            r"provision.*failed",
        ],
    )
    add_log_finding(
        key="disk_inode_memory_pressure",
        title="Disk, inode, or memory pressure on the master node",
        classification="root_cause",
        category="storage_resource_exhaustion_problem",
        score=80,
        summary=(
            "The master node shows storage or memory pressure severe enough to block service startup or journaling."
        ),
        patterns=[
            r"No space left on device",
            r"DiskOutOfSpaceException",
            r"OutOfMemoryError",
            r"Cannot allocate memory",
            r"inode",
        ],
    )
    add_log_finding(
        key="network_connectivity_failure",
        title="Network or hostname resolution failure between cluster services",
        classification="root_cause",
        category="network_connectivity_problem",
        score=78,
        summary=(
            "Cluster services are failing on hostname resolution or network reachability, not just local startup."
        ),
        patterns=[
            r"UnknownHostException",
            r"No route to host",
            r"Host is unreachable",
            r"timed out after .* connecting",
        ],
    )
    add_log_finding(
        key="secondary_retry_noise",
        title="Repeated client retries after the primary fault",
        classification="noise",
        category="secondary_errors",
        score=20,
        summary=(
            "These retry or wrapper exceptions are likely downstream noise once the first control-plane failure occurred."
        ),
        patterns=[
            r"RetryInvocationHandler",
            r"RetriableException",
            r"will retry",
            r"RPC response exceeds maximum data length",
        ],
    )
    add_log_finding(
        key="collector_script_noise",
        title="Triage collector command-wrapper noise in captured output",
        classification="noise",
        category="secondary_errors",
        score=10,
        summary=(
            "Some capture files include command-wrapper text or malformed collector output. "
            "That affects evidence quality, but it is not itself the cluster fault."
        ),
        patterns=[
            r"^=== ### COMMAND:",
            r"^=== ### TIME:",
            r"Did not expect argument:",
            r"Could not resolve hostname \"### COMMAND",
        ],
    )
    return findings


def pick_primary_fault(findings: list[Finding]) -> Finding | None:
    root_causes = [item for item in findings if item.classification == "root_cause"]
    if not root_causes:
        return None
    root_causes.sort(key=lambda item: item.score, reverse=True)
    return root_causes[0]


def diagnosis_type_for(primary_fault: Finding | None, findings: list[Finding]) -> str:
    if primary_fault is None:
        return "combination"

    if primary_fault.category == "ha_failover_config_problem":
        return "HA failover/config problem"
    if primary_fault.category == "service_startup_problem":
        if any(item.key == "namenode_rpc_8020_failure" for item in findings):
            return "NameNode problem plus service startup problem"
        return "service startup problem"
    if primary_fault.category == "network_connectivity_problem":
        return "network/connectivity problem"
    if primary_fault.category == "storage_resource_exhaustion_problem":
        return "storage/resource exhaustion problem"
    return "combination"


def recommended_commands(primary_fault: Finding | None, configs: dict[str, str]) -> list[str]:
    commands = [
        "sudo jps -lm",
        "sudo systemctl status hadoop-hdfs-namenode hadoop-hdfs-zkfc hadoop-yarn-resourcemanager --no-pager",
        "sudo ss -ltnp | egrep ':8020|:8022|:8032|:8088|:2181'",
        "sudo hdfs getconf -confKey fs.defaultFS",
        "sudo hdfs getconf -confKey dfs.nameservices",
        "sudo hdfs haadmin -getAllServiceState",
        "sudo df -h && sudo df -i && free -m",
    ]
    if primary_fault and primary_fault.key == "zkfc_or_zk_failure":
        commands.extend(
            [
                "sudo tail -n 200 /var/log/hadoop-hdfs/hadoop-hdfs-zkfc-*.log",
                "sudo zkCli.sh -server localhost:2181 ls /hadoop-ha",
            ]
        )
    if primary_fault and primary_fault.key in {"missing_nameservice", "incomplete_ha_config", "fs_default_direct_rpc"}:
        commands.extend(
            [
                "sudo egrep -n 'fs.defaultFS|dfs.nameservices|dfs.ha.namenodes|dfs.namenode.rpc-address' /etc/hadoop/conf/core-site.xml /etc/hadoop/conf/hdfs-site.xml",
                "sudo hdfs getconf -namenodes",
            ]
        )
    if configs.get("yarn.resourcemanager.ha.enabled", "").lower() == "true":
        commands.append("sudo yarn rmadmin -getAllServiceState")
    return commands


def datanode_artifact_recommendation(primary_fault: Finding | None) -> tuple[bool, list[str]]:
    if primary_fault is None:
        return True, [
            "DataNode logs from /var/log/hadoop-hdfs/",
            "NodeManager logs from /var/log/hadoop-yarn/",
            "Output of df -h, df -i, free -m, and dmesg on at least one data node",
        ]

    if primary_fault.category in {"ha_failover_config_problem", "service_startup_problem"}:
        return False, []

    if primary_fault.category in {"network_connectivity_problem", "storage_resource_exhaustion_problem"}:
        return True, [
            "DataNode logs from /var/log/hadoop-hdfs/",
            "NodeManager logs from /var/log/hadoop-yarn/",
            "Output of df -h, df -i, free -m, and dmesg on at least one affected data node",
        ]

    return False, []


def confidence_for(primary_fault: Finding | None, findings: list[Finding]) -> tuple[str, str]:
    if primary_fault is None:
        return "low", "No direct root-cause signature was found in the supplied artifacts."

    overlapping = [
        item for item in findings if item.classification == "root_cause" and item.key != primary_fault.key and item.score >= 84
    ]
    if primary_fault.score >= 90 and not overlapping:
        return "high", "The artifacts contain a specific configuration or HA signature with little competing evidence."
    if primary_fault.score >= 80:
        return "medium", "The likely fault is well supported, but at least one adjacent failure mode could still explain the symptoms."
    return "low", "The evidence is suggestive but not definitive."


def analyze(root: Path, capability_id: str = "emr_logs") -> AnalysisResult:
    capability = load_capability(capability_id)
    if capability.input_type != "emr_logs":
        raise ValueError(
            f"Capability '{capability.capability_id}' expects input_type '{capability.input_type}', "
            "not EMR log artifacts."
        )

    configs = collect_configs(root)
    findings = build_findings(root, configs)
    primary_fault = pick_primary_fault(findings)
    root_causes = [item for item in findings if item.classification == "root_cause"]
    symptoms = [item for item in findings if item.classification == "symptom"]
    noise = [item for item in findings if item.classification == "noise"]
    needs_datanode_artifacts, datanode_artifacts = datanode_artifact_recommendation(primary_fault)
    confidence, confidence_reason = confidence_for(primary_fault, findings)

    return AnalysisResult(
        capability_id=capability.capability_id,
        diagnosis_type=diagnosis_type_for(primary_fault, findings),
        primary_fault=primary_fault,
        root_causes=sorted(root_causes, key=lambda item: item.score, reverse=True),
        symptoms=sorted(symptoms, key=lambda item: item.score, reverse=True),
        noise=sorted(noise, key=lambda item: item.score, reverse=True),
        configs=configs,
        commands=recommended_commands(primary_fault, configs),
        needs_datanode_artifacts=needs_datanode_artifacts,
        datanode_artifacts=datanode_artifacts,
        confidence=confidence,
        confidence_reason=confidence_reason,
    )


def _format_finding_lines(findings: list[Finding]) -> list[str]:
    lines: list[str] = []
    for finding in findings:
        lines.append(f"- {finding.title}: {finding.summary}")
        for evidence in finding.evidence:
            lines.append(f"  - {evidence.path}:{evidence.line_number} -> {evidence.excerpt}")
    return lines


def render_markdown(result: AnalysisResult) -> str:
    primary = result.primary_fault
    diagnosis_line = (
        f"The most likely primary fault is {primary.title.lower()}."
        if primary
        else "The artifacts do not show a single decisive primary fault."
    )

    lines = [
        "A. Executive diagnosis",
        diagnosis_line,
        f"This looks most like a {result.diagnosis_type}.",
        "",
        "B. Evidence supporting that diagnosis, citing specific attached files and lines/entries",
    ]
    if primary:
        lines.extend(_format_finding_lines([primary]))
    else:
        lines.append("- No direct root-cause signature was found in the supplied master-node artifacts.")

    if result.symptoms:
        lines.append("")
        lines.append("Downstream symptoms")
        lines.extend(_format_finding_lines(result.symptoms))

    if result.noise:
        lines.append("")
        lines.append("Likely noise / secondary errors")
        lines.extend(_format_finding_lines(result.noise))

    lines.extend(["", "C. Immediate corrective actions in exact recommended order"])
    if primary:
        if primary.key in {"missing_nameservice", "incomplete_ha_config", "fs_default_direct_rpc"}:
            lines.extend(
                [
                    "1. Correct the HDFS HA configuration so fs.defaultFS points to the nameservice, not a direct host:port.",
                    "2. Ensure dfs.nameservices, dfs.ha.namenodes.<nameservice>, and every dfs.namenode.rpc-address.<nameservice>.* entry are present and consistent on the master node.",
                    "3. Restart HDFS control-plane services in order: ZooKeeper or ZKFC, then NameNode, then validate active or standby state before touching YARN.",
                    "4. After HDFS is healthy, restart or re-check ResourceManager only if YARN errors persist.",
                ]
            )
        elif primary.key == "zkfc_or_zk_failure":
            lines.extend(
                [
                    "1. Restore ZooKeeper or ZKFC health first; do not chase YARN or client retry errors before HA election is working.",
                    "2. Verify the NameNode pair is registered under the expected nameservice and that ZKFC can reach ZooKeeper.",
                    "3. Restart ZKFC and NameNode services, then confirm one NameNode is Active and the other is Standby.",
                    "4. Only after HA state is stable should you re-test HDFS RPC access and downstream YARN behavior.",
                ]
            )
        elif primary.key == "namenode_rpc_8020_failure":
            lines.extend(
                [
                    "1. Bring the NameNode service up cleanly and confirm it is listening on 8020 before investigating client-side fallout.",
                    "2. Validate the configured RPC bind or advertised address against the live listener.",
                    "3. If the service will not stay up, inspect the NameNode log for the first fatal startup exception and fix that underlying cause.",
                    "4. Re-test HDFS access, then revisit YARN only if failures continue.",
                ]
            )
        elif primary.key == "disk_inode_memory_pressure":
            lines.extend(
                [
                    "1. Relieve disk, inode, or memory pressure on the master node immediately.",
                    "2. After freeing capacity, restart the failed Hadoop control-plane services and confirm they remain healthy.",
                    "3. Re-check HDFS and YARN service state before concluding there is a separate HA or network issue.",
                ]
            )
        else:
            lines.extend(
                [
                    "1. Fix the first control-plane failure indicated by the evidence below before chasing follow-on client errors.",
                    "2. Re-validate HDFS health and HA state.",
                    "3. Re-check YARN and application-facing symptoms only after HDFS is healthy.",
                ]
            )
    else:
        lines.append("1. Gather stronger NameNode, ZKFC, and bootstrap evidence from the master node before making a change.")

    lines.extend(["", "D. Commands I should run next on the master node to confirm the diagnosis"])
    lines.extend(f"1. `{command}`" for command in result.commands)

    lines.extend(["", "E. Whether I also need data-node triage artifacts, and if so exactly which ones"])
    if result.needs_datanode_artifacts:
        lines.append("Yes. Collect these next:")
        lines.extend(f"1. {item}" for item in result.datanode_artifacts)
    else:
        lines.append("No. The current failure signature points to the master-node control plane, so data-node artifacts are not required for the first correction step.")

    lines.extend(["", "F. Confidence level", f"{result.confidence} - {result.confidence_reason}"])
    return "\n".join(lines)


def write_outputs(result: AnalysisResult, output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "emr_log_summary.json"
    report_path = output_dir / "emr_log_findings.md"
    prompt_brief_path = output_dir / "emr_prompt_brief.txt"

    json_path.write_text(json.dumps(result.to_dict(), indent=2), encoding="utf-8")
    markdown = render_markdown(result)
    report_path.write_text(markdown, encoding="utf-8")
    prompt_brief_path.write_text(
        "\n".join(
            [
                "Use the attached EMR master-node artifact summary to answer in the required A-F format.",
                "",
                markdown,
            ]
        ),
        encoding="utf-8",
    )

    return {
        "json": str(json_path),
        "report": str(report_path),
        "prompt_brief": str(prompt_brief_path),
    }


def main() -> None:
    args = build_parser().parse_args()
    bundle = resolve_bundle(args.bundle, args.input_dir)
    output_dir = resolve_output_dir(bundle, args.output_dir)
    scratch_dir = resolve_scratch_dir(bundle, args.scratch_dir)
    root, temp_dir = artifact_root(bundle, scratch_dir=scratch_dir)
    try:
        result = analyze(root=root, capability_id=args.capability)
        outputs = write_outputs(result, output_dir)
        payload = {"bundle": str(bundle), "output_dir": str(output_dir), "scratch_dir": str(scratch_dir), **outputs}
        print(json.dumps(payload, indent=2))
    finally:
        if temp_dir is not None:
            temp_dir.cleanup()


if __name__ == "__main__":
    main()
