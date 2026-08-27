import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyDetailsService } from '../application/property-details.service.js';
import {
  BulkFacilityAssignmentDto,
  FacilityAssignmentDto,
  FacilityAssignmentUpdateDto,
  PropertyBuildingDto,
  PropertyLocationDto,
  PropertyRoomDto,
  PropertyRoomUpdateDto,
  PropertySpecificationDto,
  ReorderRoomsDto,
} from '../application/dto/property-details.dto.js';

type AuthRequest = Request & { user?: { sub?: string } };
const actor = (
  request: AuthRequest,
  userAgent?: string,
  requestId?: string,
) => ({
  actorUuid: request.user?.sub,
  ipAddress: request.ip,
  userAgent,
  requestId,
});

const sanitize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (
        [
          'id',
          'propertyId',
          'facilityId',
          'countryId',
          'provinceId',
          'cityId',
          'districtId',
          'subdistrictId',
        ].includes(key)
      )
        continue;
      if (['createdBy', 'updatedBy', 'verifiedBy', 'deletedBy'].includes(key))
        continue;
      output[key] = sanitize(child);
    }
    return output;
  }
  return value;
};
const response = (data: unknown) => ({ data: sanitize(data) });

@ApiTags('Property Details')
@ApiBearerAuth()
@Controller({ path: 'property/properties/:propertyUuid', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyDetailsController {
  constructor(private readonly service: PropertyDetailsService) {}

  @Get('specifications')
  @RequirePermissions('property-specifications.read')
  @ApiOperation({ summary: 'Get property specifications' })
  getSpecifications(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
  ) {
    return this.service.getSpecifications(propertyUuid).then(response);
  }

  @Patch('specifications')
  @RequirePermissions('property-specifications.update')
  updateSpecifications(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() body: PropertySpecificationDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .updateSpecifications(
        propertyUuid,
        body,
        actor(request, userAgent, requestId),
      )
      .then(response);
  }

  @Get('location')
  @RequirePermissions('property-locations.read')
  getLocation(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
  ) {
    return this.service.getLocation(propertyUuid).then(response);
  }

  @Patch('location')
  @RequirePermissions('property-locations.update')
  updateLocation(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() body: PropertyLocationDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .updateLocation(propertyUuid, body, actor(request, userAgent, requestId))
      .then(response);
  }

  @Get('building')
  @RequirePermissions('property-buildings.read')
  getBuilding(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
  ) {
    return this.service.getBuilding(propertyUuid).then(response);
  }

  @Patch('building')
  @RequirePermissions('property-buildings.update')
  updateBuilding(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() body: PropertyBuildingDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .updateBuilding(propertyUuid, body, actor(request, userAgent, requestId))
      .then(response);
  }

  @Get('rooms')
  @RequirePermissions('property-rooms.read')
  listRooms(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
  ) {
    return this.service.listRooms(propertyUuid).then(response);
  }

  @Post('rooms')
  @RequirePermissions('property-rooms.create')
  createRoom(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() body: PropertyRoomDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .createRoom(propertyUuid, body, actor(request, userAgent, requestId))
      .then(response);
  }

  @Patch('rooms/reorder')
  @RequirePermissions('property-rooms.reorder')
  reorderRooms(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() body: ReorderRoomsDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .reorderRooms(
        propertyUuid,
        body.roomUuids,
        actor(request, userAgent, requestId),
      )
      .then(response);
  }

  @Patch('rooms/:roomUuid')
  @RequirePermissions('property-rooms.update')
  updateRoom(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Param('roomUuid', new ParseUUIDPipe({ version: '4' })) roomUuid: string,
    @Body() body: PropertyRoomUpdateDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .updateRoom(
        propertyUuid,
        roomUuid,
        body,
        actor(request, userAgent, requestId),
      )
      .then(response);
  }

  @Delete('rooms/:roomUuid')
  @HttpCode(204)
  @RequirePermissions('property-rooms.delete')
  async deleteRoom(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Param('roomUuid', new ParseUUIDPipe({ version: '4' })) roomUuid: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    await this.service.deleteRoom(
      propertyUuid,
      roomUuid,
      actor(request, userAgent, requestId),
    );
  }

  @Get('facilities')
  @RequirePermissions('property-facilities.read')
  listFacilities(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
  ) {
    return this.service.listPropertyFacilities(propertyUuid).then(response);
  }

  @Post('facilities')
  @RequirePermissions('property-facilities.attach')
  attachFacility(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() body: FacilityAssignmentDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .attachFacility(propertyUuid, body, actor(request, userAgent, requestId))
      .then(response);
  }

  @Post('facilities/bulk')
  @RequirePermissions('property-facilities.bulk-attach')
  bulkAttachFacilities(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() body: BulkFacilityAssignmentDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .bulkAttachFacilities(
        propertyUuid,
        body.facilityUuids,
        actor(request, userAgent, requestId),
      )
      .then(response);
  }

  @Patch('facilities/:facilityUuid')
  @RequirePermissions('property-facilities.update')
  updateFacility(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Param('facilityUuid', new ParseUUIDPipe({ version: '4' }))
    facilityUuid: string,
    @Body() body: FacilityAssignmentUpdateDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .updateFacility(
        propertyUuid,
        facilityUuid,
        body,
        actor(request, userAgent, requestId),
      )
      .then(response);
  }

  @Delete('facilities/:facilityUuid')
  @HttpCode(204)
  @RequirePermissions('property-facilities.detach')
  async detachFacility(
    @Req() request: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Param('facilityUuid', new ParseUUIDPipe({ version: '4' }))
    facilityUuid: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    await this.service.detachFacility(
      propertyUuid,
      facilityUuid,
      actor(request, userAgent, requestId),
    );
  }
}
