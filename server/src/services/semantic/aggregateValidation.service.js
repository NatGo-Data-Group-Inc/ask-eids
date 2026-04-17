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
