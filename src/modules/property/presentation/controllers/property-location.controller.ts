import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyMasterService } from '../application/property-master.service.js';
import { ListQuery, LocationDto, LocationUpdateDto } from './property-master.dto.js';
import { actor, listResponse, response, type AuthenticatedRequest } from './controllers/property-controller.support.js';

const levelOf = (level: string): 'country' | 'province' | 'city' | 'district' | 'subdistrict' => {
  if (['country', 'province', 'city', 'district', 'subdistrict'].includes(level)) return level as ReturnType<typeof levelOf>;
  throw new BadRequestException('Invalid location level');
};

@ApiTags('Property Locations')
@ApiBearerAuth()
@Controller({ path: 'property', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyLocationController {
  constructor(private readonly service: PropertyMasterService) {}
  @Post('locations/:level') @RequirePermissions('locations.manage') create(@Req() r: AuthenticatedRequest, @Param('level') level: string, @Body() d: LocationDto, @Headers('user-agent') ua?: string, @Headers('x-request-id') rid?: string) { return this.service.createLocation(levelOf(level), { ...d }, actor(r, ua, rid)).then(response); }
  @Get('locations/:level') @RequirePermissions('locations.read') list(@Param('level') level: string, @Query() q: ListQuery) { return this.service.listLocations(levelOf(level), q).then(listResponse); }
  @Get('locations/:level/:uuid') @RequirePermissions('locations.read') get(@Param('level') level: string, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) { return this.service.getLocation(levelOf(level), uuid).then(response); }
  @Patch('locations/:level/:uuid') @RequirePermissions('locations.manage') update(@Req() r: AuthenticatedRequest, @Param('level') level: string, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() d: LocationUpdateDto, @Headers('user-agent') ua?: string, @Headers('x-request-id') rid?: string) { return this.service.updateLocation(levelOf(level), uuid, d.version, { ...d }, actor(r, ua, rid)).then(response); }
  @Delete('locations/:level/:uuid') @HttpCode(204) @RequirePermissions('locations.manage') async remove(@Req() r: AuthenticatedRequest, @Param('level') level: string, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Headers('user-agent') ua?: string, @Headers('x-request-id') rid?: string) { await this.service.deleteLocation(levelOf(level), uuid, actor(r, ua, rid)); }
  @Get('locations/:level/:uuid/children') @RequirePermissions('locations.read') children(@Param('level') level: string, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) { return this.service.children(levelOf(level), uuid).then(response); }
}
