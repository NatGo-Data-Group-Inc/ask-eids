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
        },
        features: {
          enableNovaDentalLiveEmail: true,
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
        },
        features: {
          enableNovaDentalLiveEmail: true,
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
});
