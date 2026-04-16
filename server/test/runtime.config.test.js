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

  it('exposes hybrid semantic execution defaults and trust-surface feature flags', () => {
    const config = getRuntimeConfig();

    expect(config.semantic.defaultExecutionMode).toEqual(expect.any(String));
    expect(Array.isArray(config.semantic.liveSourceFamilies)).toBe(true);
    expect(config.semantic.liveSourceFamilies).toContain('email');
    expect(config.semantic.staleAfterHours).toBeGreaterThan(0);

    expect(config.features.enableNovaDentalLiveEmail).toEqual(expect.any(Boolean));
    expect(config.features.enableDentalTrustSurfaces).toEqual(expect.any(Boolean));
    expect(config.features.enableDentalSemanticServiceSplit).toEqual(expect.any(Boolean));
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
