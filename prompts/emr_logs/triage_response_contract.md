# EMR Triage Response Contract

Use this response structure for EMR master-node artifact triage:

A. Executive diagnosis
B. Evidence supporting that diagnosis, citing specific attached files and lines or entries
C. Immediate corrective actions in exact recommended order
D. Commands to run next on the master node to confirm the diagnosis
E. Whether data-node triage artifacts are also needed, and if so exactly which ones
F. Confidence level with a short reason

Analysis rules:

- Identify the most likely primary fault first.
- Separate root cause, downstream symptoms, and likely noise.
- Check specifically for NameNode HA state, fs.defaultFS, dfs.nameservices, HA RPC config, port 8020 listener failures, ZKFC or ZooKeeper, ResourceManager or YARN state, disk or inode or memory pressure, and partial bootstrap.
- Weight direct control-plane evidence above pattern-match files.
- Prioritize these files when they exist: `22_ha_all_state.txt`, `30_fs_default.txt`, `20_nameservices.txt`, `31_hdfs_site_extract.txt`, `32_core_site_extract.txt`, `41_nn_rpc_connectivity.txt`, `10_ports.txt`, and the `70_journal_*` service logs.
- Treat `82_spark_failure_patterns.txt` and similar application-pattern files as secondary unless the control-plane evidence is missing.
- Explicitly state when `fs.defaultFS` is correctly set to `hdfs://<nameservice>`.
- Explicitly state when `dfs.nameservices` and HA RPC entries are present, so you do not mislabel a runtime HA-state problem as a missing-config problem.
- Distinguish between:
- a client hitting a standby NameNode
- an actual HA misconfiguration
- a degraded or partially unhealthy NameNode quorum
- collector-script noise or malformed capture output
- If a file contains malformed collector output or command-wrapper noise, say so and do not let it drive the diagnosis.
- Do not give generic Hadoop advice unless the artifacts support it.
