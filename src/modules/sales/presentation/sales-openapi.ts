import { ApiResponse } from '@nestjs/swagger';
import { SalesController } from './sales.controller.js';

const createPipelineResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          format: 'uuid',
        },
      },
      required: ['uuid'],
    },
  },
  required: ['data'],
};

const pipelineSchema = {
  type: 'object',
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    status: { type: 'string' },
    sortOrder: { type: 'integer' },
    stages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          uuid: { type: 'string', format: 'uuid' },
          pipelineUuid: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          name: { type: 'string' },
          sortOrder: { type: 'integer' },
          probability: { type: 'integer' },
          isTerminal: { type: 'boolean' },
          isActive: { type: 'boolean' },
        },
        required: [
          'uuid',
          'pipelineUuid',
          'code',
          'name',
          'sortOrder',
          'probability',
          'isTerminal',
          'isActive',
        ],
      },
    },
  },
  required: ['uuid', 'name', 'description', 'status', 'sortOrder', 'stages'],
};

const stageSchema = {
  type: 'object',
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    pipelineUuid: { type: 'string', format: 'uuid' },
    code: { type: 'string' },
    name: { type: 'string' },
    sortOrder: { type: 'integer' },
    probability: { type: 'integer' },
    isTerminal: { type: 'boolean' },
    isActive: { type: 'boolean' },
  },
  required: [
    'uuid',
    'pipelineUuid',
    'code',
    'name',
    'sortOrder',
    'probability',
    'isTerminal',
    'isActive',
  ],
};

const stageResponseSchema = {
  type: 'object',
  properties: {
    data: stageSchema,
  },
  required: ['data'],
};

const stageListResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: stageSchema,
    },
  },
  required: ['data'],
};

const salesRecordSchema = {
  type: 'object',
  properties: {
    uuid: { type: 'string', format: 'uuid' },
  },
  required: ['uuid'],
  additionalProperties: true,
};

const salesResponseSchema = {
  type: 'object',
  properties: {
    data: salesRecordSchema,
  },
  required: ['data'],
};

const salesArrayResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: salesRecordSchema,
    },
  },
  required: ['data'],
};

const salesPageResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: salesRecordSchema,
    },
    meta: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1 },
        limit: { type: 'integer', minimum: 1 },
        total: { type: 'integer', minimum: 0 },
        totalPages: { type: 'integer', minimum: 0 },
      },
      required: ['page', 'limit', 'total', 'totalPages'],
    },
  },
  required: ['data', 'meta'],
};

const getPipelineResponseSchema = {
  type: 'object',
  properties: {
    data: pipelineSchema,
  },
  required: ['data'],
};

const listPipelineResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: pipelineSchema,
    },
    meta: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1 },
        limit: { type: 'integer', minimum: 1 },
        total: { type: 'integer', minimum: 0 },
        totalPages: { type: 'integer', minimum: 0 },
      },
      required: ['page', 'limit', 'total', 'totalPages'],
    },
  },
  required: ['data', 'meta'],
};

const createPipelineDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'createPipeline',
);

if (createPipelineDescriptor) {
  ApiResponse({
    status: 201,
    description: 'Sales pipeline created.',
    schema: createPipelineResponseSchema,
  })(SalesController.prototype, 'createPipeline', createPipelineDescriptor);
}

const listPipelineDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'listPipelines',
);

if (listPipelineDescriptor) {
  ApiResponse({
    status: 200,
    description: 'Sales pipelines returned.',
    schema: listPipelineResponseSchema,
  })(SalesController.prototype, 'listPipelines', listPipelineDescriptor);
}

const getPipelineDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'getPipeline',
);

if (getPipelineDescriptor) {
  ApiResponse({
    status: 200,
    description: 'Sales pipeline returned.',
    schema: getPipelineResponseSchema,
  })(SalesController.prototype, 'getPipeline', getPipelineDescriptor);
}

const updatePipelineDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'updatePipeline',
);

if (updatePipelineDescriptor) {
  ApiResponse({
    status: 200,
    description: 'Sales pipeline updated.',
    schema: getPipelineResponseSchema,
  })(SalesController.prototype, 'updatePipeline', updatePipelineDescriptor);
}

const archivePipelineDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'archivePipeline',
);

if (archivePipelineDescriptor) {
  ApiResponse({
    status: 200,
    description: 'Sales pipeline archived.',
    schema: getPipelineResponseSchema,
  })(SalesController.prototype, 'archivePipeline', archivePipelineDescriptor);
}

const createStageDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'createStage',
);

if (createStageDescriptor) {
  ApiResponse({
    status: 201,
    description: 'Pipeline stage created.',
    schema: stageResponseSchema,
  })(SalesController.prototype, 'createStage', createStageDescriptor);
}

const listStagesDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'listStages',
);

if (listStagesDescriptor) {
  ApiResponse({
    status: 200,
    description: 'Pipeline stages returned.',
    schema: stageListResponseSchema,
  })(SalesController.prototype, 'listStages', listStagesDescriptor);
}

const reorderStagesDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'reorderStages',
);

if (reorderStagesDescriptor) {
  ApiResponse({
    status: 200,
    description: 'Pipeline stages reordered.',
    schema: stageListResponseSchema,
  })(SalesController.prototype, 'reorderStages', reorderStagesDescriptor);
}

const updateStageDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'updateStage',
);

if (updateStageDescriptor) {
  ApiResponse({
    status: 200,
    description: 'Pipeline stage updated.',
    schema: stageResponseSchema,
  })(SalesController.prototype, 'updateStage', updateStageDescriptor);
}

const archiveStageDescriptor = Object.getOwnPropertyDescriptor(
  SalesController.prototype,
  'archiveStage',
);

if (archiveStageDescriptor) {
  ApiResponse({
    status: 200,
    description: 'Pipeline stage archived.',
    schema: stageResponseSchema,
  })(SalesController.prototype, 'archiveStage', archiveStageDescriptor);
}

const salesResponseDescriptors: ReadonlyArray<readonly [
  keyof SalesController,
  number,
  string,
  typeof salesResponseSchema | typeof salesArrayResponseSchema | typeof salesPageResponseSchema,
]> = [
  [
    'createOpportunity',
    201,
    'Sales opportunity created.',
    salesResponseSchema,
  ],
  [
    'listOpportunities',
    200,
    'Sales opportunities returned.',
    salesPageResponseSchema,
  ],
  ['getOpportunity', 200, 'Sales opportunity returned.', salesResponseSchema],
  ['updateOpportunity', 200, 'Sales opportunity updated.', salesResponseSchema],
  ['assignOpportunity', 200, 'Sales opportunity assigned.', salesResponseSchema],
  [
    'transitionOpportunity',
    200,
    'Sales opportunity transitioned.',
    salesResponseSchema,
  ],
  ['attachProperty', 200, 'Property attached to opportunity.', salesResponseSchema],
  ['detachProperty', 200, 'Property detached from opportunity.', salesResponseSchema],
  ['lostOpportunity', 200, 'Sales opportunity marked lost.', salesResponseSchema],
  [
    'stageHistory',
    200,
    'Opportunity stage history returned.',
    salesPageResponseSchema,
  ],
  ['createActivity', 201, 'Sales activity created.', salesResponseSchema],
  ['listActivities', 200, 'Sales activities returned.', salesPageResponseSchema],
  ['activityStatus', 200, 'Sales activity status updated.', salesResponseSchema],
  ['createViewing', 201, 'Viewing schedule created.', salesResponseSchema],
  ['listViewings', 200, 'Viewing schedules returned.', salesPageResponseSchema],
  ['viewingStatus', 200, 'Viewing status updated.', salesResponseSchema],
  ['createNegotiation', 201, 'Negotiation created.', salesResponseSchema],
  ['negotiationStatus', 200, 'Negotiation status updated.', salesResponseSchema],
  [
    'negotiationHistory',
    200,
    'Negotiation history returned.',
    salesArrayResponseSchema,
  ],
  ['createOffer', 201, 'Offer created.', salesResponseSchema],
  ['offers', 200, 'Offer history returned.', salesArrayResponseSchema],
  ['offerStatus', 200, 'Offer status updated.', salesResponseSchema],
  ['createDeal', 201, 'Sales deal created.', salesResponseSchema],
  ['listDeals', 200, 'Sales deals returned.', salesPageResponseSchema],
  ['getDeal', 200, 'Sales deal returned.', salesResponseSchema],
  ['addDealItem', 201, 'Deal line item added.', salesResponseSchema],
  ['updateDealItem', 200, 'Deal line item updated.', salesResponseSchema],
  ['dealStatus', 200, 'Deal status updated.', salesResponseSchema],
  ['closeDeal', 201, 'Sales deal closed.', salesResponseSchema],
  ['lostDeal', 200, 'Sales deal marked lost.', salesResponseSchema],
  ['lostReasons', 200, 'Lost reasons returned.', salesArrayResponseSchema],
  ['createLostReason', 201, 'Lost reason created.', salesResponseSchema],
  ['updateLostReason', 200, 'Lost reason updated.', salesResponseSchema],
  ['createCommissionRule', 201, 'Commission rule created.', salesResponseSchema],
  [
    'calculateCommission',
    201,
    'Commission calculated.',
    salesResponseSchema,
  ],
  ['approveCommission', 200, 'Commission approved.', salesResponseSchema],
  ['settleCommission', 200, 'Commission settled.', salesResponseSchema],
  ['commissionReport', 200, 'Commission report returned.', salesResponseSchema],
  ['forecast', 200, 'Sales forecast returned.', salesResponseSchema],
];

for (const [methodName, status, description, schema] of salesResponseDescriptors) {
  const descriptor = Object.getOwnPropertyDescriptor(
    SalesController.prototype,
    methodName,
  );

  if (descriptor) {
    ApiResponse({ status, description, schema })(
      SalesController.prototype,
      methodName,
      descriptor,
    );
  }
}
