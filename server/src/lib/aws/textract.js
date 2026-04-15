import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { getRuntimeConfig } from '../../config/runtime.js';

export function textractAvailable(config = getRuntimeConfig()) {
  return Boolean(config.textract.enabled && config.textract.region);
}

export async function detectDocumentText({ bytes, client = null } = {}) {
  const config = getRuntimeConfig();
  if (!textractAvailable(config)) return null;
  const runtimeClient = client || new TextractClient({
    region: config.textract.region,
    useFipsEndpoint: config.aws.useFips,
  });
  const command = new DetectDocumentTextCommand({
    Document: {
      Bytes: bytes,
    },
  });
  const response = await runtimeClient.send(command);
  const lines = (response?.Blocks || [])
    .filter((block) => block?.BlockType === 'LINE' && block?.Text)
    .map((block) => block.Text.trim())
    .filter(Boolean);
  return {
    text: lines.join('\n').trim(),
    blockCount: (response?.Blocks || []).length,
  };
}
