export function runAdoMcpEnrichment({ enabled, testCase = '' }) {
  if (!enabled) {
    return { status: 'disabled', warnings: [] };
  }
  if (testCase === 'mcpFailure') {
    throw new Error('Injected ADO MCP enrichment failure');
  }
  return {
    status: 'completed',
    warnings: [],
    enrichment: {
      source: 'ado-mcp',
      note: 'Supplemental context was captured from MCP enrichment.',
    },
  };
}
