from __future__ import annotations

from analysis_capabilities.base import CapabilityHandler
from analysis_capabilities.cloudwatch_logs import CloudWatchLogsCapabilityHandler
from analysis_capabilities.emr_logs import EMRLogsCapabilityHandler


def get_capability_handler(capability_id: str) -> CapabilityHandler:
    if capability_id == "emr_logs":
        return EMRLogsCapabilityHandler()
    if capability_id == "cloudwatch_logs":
        return CloudWatchLogsCapabilityHandler()
    raise ValueError(
        f"No capability handler is registered for '{capability_id}'. "
        "Add a dataset-specific handler before using the shared submission wrapper."
    )
