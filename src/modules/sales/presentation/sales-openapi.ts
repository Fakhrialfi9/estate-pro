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

const listPipelineResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: {
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
      },
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
