import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

const aggregateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['aggregateId', 'productId', 'aggregateVersion', 'evidenceVersion', 'sourceSetHash', 'payload'],
  properties: {
    aggregateId: { type: 'string', minLength: 1 },
    productId: { type: 'string', minLength: 1 },
    aggregateVersion: { type: 'integer', minimum: 1 },
    evidenceVersion: { type: 'integer', minimum: 1 },
    sourceSetHash: { type: 'string', minLength: 1 },
    payload: {
      type: 'object',
      additionalProperties: true,
      required: ['summary', 'status'],
      properties: {
        summary: { type: 'string', minLength: 1 },
        status: { type: 'string', enum: ['risk', 'caution', 'healthy'] },
      },
    },
  },
};

const validate = ajv.compile(aggregateSchema);

const aggregateContentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['productId', 'status', 'statusLabel', 'summary', 'confidence', 'drivers', 'riskFactors'],
  properties: {
    productId: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['healthy', 'caution', 'risk'] },
    statusLabel: { type: 'string', enum: ['On Track', 'Caution', 'At Risk'] },
    summary: { type: 'string', minLength: 40 },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    drivers: {
      type: 'array',
      minItems: 0,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'direction', 'anchorSourceIds'],
        properties: {
          title: { type: 'string', minLength: 1 },
          direction: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          anchorSourceIds: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
        },
      },
    },
    riskFactors: {
      type: 'array',
      minItems: 0,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'severity', 'anchorSourceIds'],
        properties: {
          title: { type: 'string', minLength: 1 },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          anchorSourceIds: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
        },
      },
    },
  },
};

const STATUS_TO_LABEL = { healthy: 'On Track', caution: 'Caution', risk: 'At Risk' };

const validateContent = ajv.compile(aggregateContentSchema);

export function validateAggregatePayload({ aggregatePayload } = {}) {
  const valid = validate(aggregatePayload);
  if (!valid) {
    const error = new Error('Aggregate publication payload failed validation.');
    error.code = 'AGGREGATE_INVALID';
    error.validationErrors = validate.errors || [];
    throw error;
  }
  return aggregatePayload;
}

export function validateAggregateContent({ payload } = {}) {
  const valid = validateContent(payload);
  if (!valid) {
    const error = new Error('Aggregate content payload failed validation.');
    error.code = 'AGGREGATE_CONTENT_INVALID';
    error.validationErrors = validateContent.errors || [];
    throw error;
  }
  if (STATUS_TO_LABEL[payload.status] !== payload.statusLabel) {
    const error = new Error(`status "${payload.status}" does not pair with statusLabel "${payload.statusLabel}".`);
    error.code = 'AGGREGATE_CONTENT_INVALID';
    error.validationErrors = [{ message: 'status and statusLabel must pair via STATUS_TO_LABEL mapping' }];
    throw error;
  }
  return payload;
}

export { STATUS_TO_LABEL };
