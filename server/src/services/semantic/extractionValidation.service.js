import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'decisions', 'warnings', 'confidence'],
  properties: {
    summary: { type: 'string', minLength: 1 },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'confidence', 'anchorText'],
        properties: {
          label: { type: 'string', minLength: 1 },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          anchorText: { type: 'string', minLength: 1 },
        },
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

const validate = ajv.compile(extractionSchema);

export function validateSourceExtraction({ payload } = {}) {
  const valid = validate(payload);
  if (!valid) {
    const error = new Error('AI extraction output failed validation.');
    error.code = 'EXTRACTION_INVALID';
    error.validationErrors = validate.errors || [];
    throw error;
  }
  return payload;
}
