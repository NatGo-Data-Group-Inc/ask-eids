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
- Do not give generic Hadoop advice unless the artifacts support it.
