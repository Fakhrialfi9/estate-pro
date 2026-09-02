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
