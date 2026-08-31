import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import {
  PropertyTypeAlreadyExistsException,
  PropertyTypeInUseException,
  PropertyTypeNotFoundException,
} from '../domain/errors/property-type.errors.js';
import { CreatePropertyTypeUseCase } from '../application/use-cases/create-property-type.use-case.js';
import { DeletePropertyTypeUseCase } from '../application/use-cases/delete-property-type.use-case.js';
import { GetPropertyTypeUseCase } from '../application/use-cases/get-property-type.use-case.js';
import { ListPropertyTypesUseCase } from '../application/use-cases/list-property-types.use-case.js';
import { UpdatePropertyTypeUseCase } from '../application/use-cases/update-property-type.use-case.js';
import { CreatePropertyTypeDto } from '../application/dto/create-property-type.dto.js';
import { PropertyTypeQueryDto } from '../application/dto/property-type-query.dto.js';
import { UpdatePropertyTypeDto } from '../application/dto/update-property-type.dto.js';
import {
  serializePropertyType,
  serializePropertyTypeList,
} from './property-type.serializer.js';

export const PROPERTY_TYPE_CREATE_PERMISSION = 'property-types.create';
export const PROPERTY_TYPE_READ_PERMISSION = 'property-types.read';
export const PROPERTY_TYPE_UPDATE_PERMISSION = 'property-types.update';
export const PROPERTY_TYPE_DELETE_PERMISSION = 'property-types.delete';

type AuthenticatedRequest = Request & { user?: { sub?: string } };

const propertyTypeResponseSchema = {
  type: 'object',
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    code: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string', nullable: true },
    icon: { type: 'string', nullable: true },
    isActive: { type: 'boolean' },
    sortOrder: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'uuid',
    'code',
    'name',
    'slug',
    'description',
    'icon',
    'isActive',
    'sortOrder',
    'createdAt',
    'updatedAt',
  ],
};

const propertyTypeListResponseSchema = {
  type: 'object',
  properties: {
    items: { type: 'array', items: propertyTypeResponseSchema },
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
  required: ['items', 'meta'],
};

@ApiTags('Property Types')
@ApiBearerAuth()
@Controller({ path: 'property-types', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyTypesController {
  constructor(
    private readonly createPropertyType: CreatePropertyTypeUseCase,
    private readonly updatePropertyType: UpdatePropertyTypeUseCase,
    private readonly getPropertyType: GetPropertyTypeUseCase,
    private readonly listPropertyTypes: ListPropertyTypesUseCase,
    private readonly deletePropertyType: DeletePropertyTypeUseCase,
  ) {}

  @Post()
  @RequirePermissions(PROPERTY_TYPE_CREATE_PERMISSION)
  @ApiOperation({ summary: 'Create property type' })
  @ApiResponse({
    status: 201,
    description: 'Property type created.',
    schema: propertyTypeResponseSchema,
  })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePropertyTypeDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    try {
      return serializePropertyType(
        await this.createPropertyType.execute(
          dto,
          this.context(request, userAgent, requestId),
        ),
      );
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Get()
  @RequirePermissions(PROPERTY_TYPE_READ_PERMISSION)
  @ApiOperation({ summary: 'List property types' })
  @ApiResponse({
    status: 200,
    description: 'Property types returned.',
    schema: propertyTypeListResponseSchema,
  })
  async list(@Query() query: PropertyTypeQueryDto) {
    if (query.filterField === undefined && query.filterValue !== undefined) {
      throw new BadRequestException(
        'filterField is required when filterValue is provided',
      );
    }
    if (query.filterField !== undefined && query.filterValue === undefined) {
      throw new BadRequestException(
        'filterValue is required when filterField is provided',
      );
    }

    const filterValue =
      query.filterField === 'isActive'
        ? this.parseBooleanFilter(query.filterValue)
        : query.filterValue;

    const result = await this.listPropertyTypes.execute({
      page: query.page,
      limit: query.limit,
      ...(query.filterField !== undefined
        ? { filterField: query.filterField }
        : {}),
      ...(filterValue !== undefined ? { filterValue } : {}),
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      ...(query.search !== undefined ? { search: query.search.trim() } : {}),
    });

    return serializePropertyTypeList(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':uuid')
  @RequirePermissions(PROPERTY_TYPE_READ_PERMISSION)
  @ApiOperation({ summary: 'Get property type' })
  @ApiResponse({
    status: 200,
    description: 'Property type returned.',
    schema: propertyTypeResponseSchema,
  })
  async get(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    try {
      return serializePropertyType(await this.getPropertyType.execute(uuid));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Patch(':uuid')
  @RequirePermissions(PROPERTY_TYPE_UPDATE_PERMISSION)
  @ApiOperation({ summary: 'Update property type' })
  @ApiResponse({
    status: 200,
    description: 'Property type updated.',
    schema: propertyTypeResponseSchema,
  })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: UpdatePropertyTypeDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    try {
      return serializePropertyType(
        await this.updatePropertyType.execute(
          uuid,
          dto,
          this.context(request, userAgent, requestId),
        ),
      );
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Delete(':uuid')
  @HttpCode(204)
  @RequirePermissions(PROPERTY_TYPE_DELETE_PERMISSION)
  @ApiOperation({ summary: 'Soft-delete property type' })
  @ApiResponse({ status: 204, description: 'Property type deleted.' })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ): Promise<void> {
    try {
      await this.deletePropertyType.execute(
        uuid,
        this.context(request, userAgent, requestId),
      );
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  private parseBooleanFilter(value?: string): boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new BadRequestException('isActive filterValue must be true or false');
  }

  private context(
    request: AuthenticatedRequest,
    userAgent?: string,
    requestId?: string,
  ) {
    return {
      actorUuid: request.user?.sub,
      ipAddress: request.ip,
      userAgent,
      requestId,
    };
  }

  private mapError(error: unknown): never {
    if (error instanceof PropertyTypeNotFoundException) {
      throw new NotFoundException('Property type not found');
    }
    if (error instanceof PropertyTypeAlreadyExistsException) {
      throw new ConflictException(error.message);
    }
    if (error instanceof PropertyTypeInUseException) {
      throw new ConflictException(error.message);
    }
    throw error;
  }
}
