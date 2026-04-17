// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveSemanticExecutionPolicy } from '../src/services/semantic/executionPolicy.service.js';

describe('semantic execution policy', () => {
  it('resolves hybrid Dental email policy to live when the family is enabled', () => {
    const decision = resolveSemanticExecutionPolicy({
      productId: 'dental',
      sourceType: 'email',
      sourceFamily: 'email',
      runtimeConfig: {
        bedrock: { enabled: true, textModelId: 'amazon.nova-pro-v1:0' },
        semantic: {
          promptRegistryVersion: '2026-04-16-email-v1',
          defaultExecutionMode: 'replay',
          liveSourceFamilies: ['email'],
          liveProductIds: ['dental', 'essence', 'optima'],
        },
        features: {
          enableNovaDentalLiveEmail: true,
          enableExtractionReplayMode: true,
        },
      },
      stateSemanticConfig: {
        executionMode: 'hybrid',
        sourceFamilyModes: {
          email: 'live',
          document: 'replay',
          transcript: 'replay',
        },
      },
    });

    expect(decision).toMatchObject({
      productId: 'dental',
      sourceType: 'email',
      sourceFamily: 'email',
      executionMode: 'live',
      promptVersion: '2026-04-16-email-v1',
    });
  });

  it('resolves non-email Dental families to replay in hybrid mode', () => {
    const decision = resolveSemanticExecutionPolicy({
      productId: 'dental',
      sourceType: 'document',
      sourceFamily: 'document',
      runtimeConfig: {
        bedrock: { enabled: true, textModelId: 'amazon.nova-pro-v1:0' },
        semantic: {
          promptRegistryVersion: '2026-04-16-email-v1',
          defaultExecutionMode: 'replay',
          liveSourceFamilies: ['email'],
          liveProductIds: ['dental', 'essence', 'optima'],
        },
        features: {
          enableNovaDentalLiveEmail: true,
          enableExtractionReplayMode: true,
        },
      },
      stateSemanticConfig: {
        executionMode: 'hybrid',
        sourceFamilyModes: {
          email: 'live',
          document: 'replay',
        },
      },
    });

    expect(decision.executionMode).toBe('replay');
  });

  it('resolves non-allowlisted product to replay with non_dental_replay-style reason', () => {
    const decision = resolveSemanticExecutionPolicy({
      productId: 'experimental-product-42',
      sourceType: 'email',
      sourceFamily: 'email',
      runtimeConfig: {
        bedrock: { enabled: true, textModelId: 'amazon.nova-pro-v1:0' },
        semantic: {
          promptRegistryVersion: '2026-04-16-email-v1',
          defaultExecutionMode: 'replay',
          liveSourceFamilies: ['email'],
          liveProductIds: ['dental', 'essence', 'optima'],
        },
        features: {
          enableNovaDentalLiveEmail: true,
          enableExtractionReplayMode: true,
        },
      },
      stateSemanticConfig: {
        executionMode: 'hybrid',
        sourceFamilyModes: { email: 'live' },
      },
    });

    expect(decision.executionMode).toBe('replay');
    expect(decision.reason).toBe('product_not_in_live_allowlist');
  });

  it('resolves allowlisted non-dental product email to live when family is enabled', () => {
    const decision = resolveSemanticExecutionPolicy({
      productId: 'essence',
      sourceType: 'email',
      sourceFamily: 'email',
      runtimeConfig: {
        bedrock: { enabled: true, textModelId: 'amazon.nova-pro-v1:0' },
        semantic: {
          promptRegistryVersion: '2026-04-16-email-v1',
          defaultExecutionMode: 'replay',
          liveSourceFamilies: ['email'],
          liveProductIds: ['dental', 'essence', 'optima'],
        },
        features: {
          enableNovaDentalLiveEmail: true,
          enableExtractionReplayMode: true,
        },
      },
      stateSemanticConfig: {
        executionMode: 'hybrid',
        sourceFamilyModes: { email: 'live' },
      },
    });

    expect(decision.executionMode).toBe('live');
  });
});
