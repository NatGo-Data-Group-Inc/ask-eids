// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertSingleRegionOperation, getRuntimeConfig, getRuntimeDiagnostics } from '../src/config/runtime.js';

describe('runtime config', () => {
  it('loads runtime diagnostics with sibling-project env sources', () => {
    const diagnostics = getRuntimeDiagnostics();
    expect(diagnostics.sharedCredentialsProject).toContain('AgenticDataCatalog-NoDocker');
    expect(Array.isArray(diagnostics.envSources)).toBe(true);
    expect(diagnostics.envSources.length).toBeGreaterThan(0);
  });

  it('enforces single-region GovCloud operation', () => {
    const config = getRuntimeConfig();
    expect(config.aws.region.startsWith('us-gov-')).toBe(true);
    expect(assertSingleRegionOperation(config)).toBe(true);
  });

  it('fails fast when region is outside GovCloud', () => {
    const invalid = {
      aws: { region: 'us-east-1' },
      bedrock: { region: 'us-east-1' },
      textract: { enabled: false, region: null },
    };
    expect(() => assertSingleRegionOperation(invalid)).toThrow(/outside the required GovCloud partition/i);
  });

  it('fails fast when bedrock region mismatches aws region', () => {
    const invalid = {
      aws: { region: 'us-gov-west-1' },
      bedrock: { region: 'us-gov-east-1' },
      textract: { enabled: false, region: null },
    };
    expect(() => assertSingleRegionOperation(invalid)).toThrow(/bedrock region must match/i);
  });

  it('fails fast when textract region mismatches aws region', () => {
    const invalid = {
      aws: { region: 'us-gov-west-1' },
      bedrock: { region: 'us-gov-west-1' },
      textract: { enabled: true, region: 'us-gov-east-1' },
    };
    expect(() => assertSingleRegionOperation(invalid)).toThrow(/textract region must match/i);
  });
});
