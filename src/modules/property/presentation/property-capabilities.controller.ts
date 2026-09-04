import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyCapabilitiesService } from '../application/property-capabilities.service.js';
import {
  AssignAmenityDto,
  CreateAmenityDto,
  CreateDocumentDto,
  CreateDocumentVersionDto,
  CreateHistoryDto,
  HistoryQueryDto,
  UpdateAmenityDto,
  UpdateDocumentDto,
} from '../application/dto/property-capabilities.dto.js';

type AuthRequest = Request & { user?: { sub?: string } };
const actorUuid = (request: AuthRequest): string => request.user?.sub ?? '';
const wrap = <T>(data: T) => ({ data });

@ApiTags('Property Capabilities')
@Controller({ path: 'property', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@ApiBearerAuth()
export class PropertyCapabilitiesController {
  constructor(private readonly service: PropertyCapabilitiesService) {}

  @Get('amenities')
  @RequirePermissions('properties.read')
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, example: true })
  @ApiOkResponse({ description: 'Amenity catalog returned.' })
  listAmenities(@Query('activeOnly') activeOnly?: string) {
    return this.service.listAmenities(activeOnly !== 'false').then(wrap);
  }

  @Post('amenities')
  @RequirePermissions('properties.manage')
  @ApiCreatedResponse({ description: 'Amenity created.' })
  createAmenity(@Body() dto: CreateAmenityDto, @Req() request: AuthRequest) {
    return this.service.createAmenity(dto, actorUuid(request)).then(wrap);
  }

  @Patch('amenities/:uuid')
  @RequirePermissions('properties.manage')
  @ApiOkResponse({ description: 'Amenity updated.' })
  updateAmenity(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: UpdateAmenityDto,
    @Req() request: AuthRequest,
  ) {
    return this.service.updateAmenity(uuid, dto, actorUuid(request)).then(wrap);
  }

  @Delete('amenities/:uuid')
  @RequirePermissions('properties.manage')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Amenity deactivated.' })
  deleteAmenity(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Req() request: AuthRequest,
  ) {
    return this.service.deleteAmenity(uuid, actorUuid(request));
  }

  @Get('properties/:propertyUuid/amenities')
  @RequirePermissions('properties.read')
  @ApiOkResponse({ description: 'Property amenities returned.' })
  listPropertyAmenities(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.listPropertyAmenities(propertyUuid, activeOnly === 'true').then(wrap);
  }

  @Put('properties/:propertyUuid/amenities/:amenityUuid')
  @RequirePermissions('properties.update')
  @ApiOkResponse({ description: 'Amenity assigned to property.' })
  assignAmenity(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Param('amenityUuid', new ParseUUIDPipe({ version: '4' })) amenityUuid: string,
    @Body() dto: AssignAmenityDto,
    @Req() request: AuthRequest,
  ) {
    return this.service.assignAmenity(propertyUuid, amenityUuid, dto, actorUuid(request)).then(wrap);
  }

  @Delete('properties/:propertyUuid/amenities/:amenityUuid')
  @RequirePermissions('properties.update')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Amenity unassigned.' })
  unassignAmenity(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Param('amenityUuid', new ParseUUIDPipe({ version: '4' })) amenityUuid: string,
    @Req() request: AuthRequest,
  ) {
    return this.service.unassignAmenity(propertyUuid, amenityUuid, actorUuid(request));
  }

  @Get('properties/:propertyUuid/documents')
  @RequirePermissions('properties.sensitive.read')
  @ApiOkResponse({ description: 'Property document metadata returned.' })
  listDocuments(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.service.listDocuments(propertyUuid, includeArchived === 'true').then(wrap);
  }

  @Get('properties/:propertyUuid/documents/:documentUuid')
  @RequirePermissions('properties.sensitive.read')
  @ApiOkResponse({ description: 'Property document metadata returned.' })
  getDocument(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Param('documentUuid', new ParseUUIDPipe({ version: '4' })) documentUuid: string,
  ) {
    return this.service.getDocument(propertyUuid, documentUuid).then(wrap);
  }

  @Post('properties/:propertyUuid/documents')
  @RequirePermissions('properties.manage')
  @ApiCreatedResponse({ description: 'Property document metadata registered.' })
  createDocument(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Body() dto: CreateDocumentDto,
    @Req() request: AuthRequest,
  ) {
    return this.service.createDocument(propertyUuid, dto, actorUuid(request)).then(wrap);
  }

  @Post('properties/:propertyUuid/documents/:documentUuid/versions')
  @RequirePermissions('properties.manage')
  @ApiCreatedResponse({ description: 'Document version registered.' })
  createDocumentVersion(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Param('documentUuid', new ParseUUIDPipe({ version: '4' })) documentUuid: string,
    @Body() dto: CreateDocumentVersionDto,
    @Req() request: AuthRequest,
  ) {
    return this.service.createDocumentVersion(propertyUuid, documentUuid, dto, actorUuid(request)).then(wrap);
  }

  @Patch('properties/:propertyUuid/documents/:documentUuid')
  @RequirePermissions('properties.manage')
  @ApiOkResponse({ description: 'Property document metadata updated.' })
  updateDocument(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Param('documentUuid', new ParseUUIDPipe({ version: '4' })) documentUuid: string,
    @Body() dto: UpdateDocumentDto,
    @Req() request: AuthRequest,
  ) {
    return this.service.updateDocument(propertyUuid, documentUuid, dto, actorUuid(request)).then(wrap);
  }

  @Delete('properties/:propertyUuid/documents/:documentUuid')
  @RequirePermissions('properties.manage')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Property document deleted logically.' })
  deleteDocument(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Param('documentUuid', new ParseUUIDPipe({ version: '4' })) documentUuid: string,
    @Req() request: AuthRequest,
  ) {
    return this.service.deleteDocument(propertyUuid, documentUuid, actorUuid(request));
  }

  @Get('properties/:propertyUuid/history')
  @RequirePermissions('properties.read')
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'event', required: false })
  @ApiOkResponse({ description: 'Business history returned.' })
  listHistory(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.service.listHistory(propertyUuid, query.page, query.limit, query.event).then(wrap);
  }

  @Post('properties/:propertyUuid/history')
  @RequirePermissions('properties.manage')
  @ApiCreatedResponse({ description: 'Business history event recorded.' })
  createHistory(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string,
    @Body() dto: CreateHistoryDto,
    @Req() request: AuthRequest,
  ) {
    return this.service.createHistory(propertyUuid, dto, actorUuid(request)).then(wrap);
  }
}
