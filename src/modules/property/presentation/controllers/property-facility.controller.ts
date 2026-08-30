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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyMasterService } from '../application/property-master.service.js';
import {
  FacilityDto,
  FacilityUpdateDto,
  ListQuery,
} from './property-master.dto.js';
import {
  actor,
  listResponse,
  response,
  type AuthenticatedRequest,
} from './controllers/property-controller.support.js';

@ApiTags('Property Facilities')
@ApiBearerAuth()
@Controller({ path: 'property', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyFacilityController {
  constructor(private readonly service: PropertyMasterService) {}
  @Post('facilities') @RequirePermissions('facilities.create') create(
    @Req() r: AuthenticatedRequest,
    @Body() d: FacilityDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.service
      .createFacility({ ...d }, actor(r, ua, rid))
      .then(response);
  }
  @Get('facilities') @RequirePermissions('facilities.read') list(
    @Query() q: ListQuery,
  ) {
    return this.service.listFacilities(q).then(listResponse);
  }
  @Get('facilities/:uuid') @RequirePermissions('facilities.read') get(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.getFacility(uuid).then(response);
  }
  @Patch('facilities/:uuid') @RequirePermissions('facilities.update') update(
    @Req() r: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() d: FacilityUpdateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.service
      .updateFacility(uuid, d.version, { ...d }, actor(r, ua, rid))
      .then(response);
  }
  @Delete('facilities/:uuid')
  @HttpCode(204)
  @RequirePermissions('facilities.delete')
  async remove(
    @Req() r: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    await this.service.deleteFacility(uuid, actor(r, ua, rid));
  }
}
