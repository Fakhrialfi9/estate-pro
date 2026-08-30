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
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../../common/security/authorization.decorators.js';
import { PropertyMasterService } from '../../application/property-master.service.js';
import {
  ListQuery,
  PropertyDto,
  PropertyUpdateDto,
} from '../property-master.dto.js';
import {
  actor,
  listResponse,
  response,
  type AuthenticatedRequest,
} from './property-controller.support.js';

@ApiTags('Properties')
@ApiBearerAuth()
@Controller({ path: 'property', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyController {
  constructor(private readonly service: PropertyMasterService) {}

  @Post('properties')
  @RequirePermissions('properties.create')
  create(
    @Req() r: AuthenticatedRequest,
    @Body() d: PropertyDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.service
      .createProperty({ ...d }, actor(r, ua, rid))
      .then(response);
  }

  @Get('properties')
  @RequirePermissions('properties.read')
  list(@Query() q: ListQuery) {
    return this.service.listProperties(q).then(listResponse);
  }

  @Get('properties/:uuid')
  @RequirePermissions('properties.read')
  get(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.service.getProperty(uuid).then(response);
  }

  @Patch('properties/:uuid')
  @RequirePermissions('properties.update')
  update(
    @Req() r: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() d: PropertyUpdateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.service
      .updateProperty(uuid, d.version, { ...d }, actor(r, ua, rid))
      .then(response);
  }

  @Delete('properties/:uuid')
  @HttpCode(204)
  @RequirePermissions('properties.delete')
  async remove(
    @Req() r: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    await this.service.deleteProperty(uuid, actor(r, ua, rid));
  }

  @Post('properties/:uuid/restore')
  @RequirePermissions('properties.update')
  restore(
    @Req() r: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.service.restoreProperty(uuid, actor(r, ua, rid)).then(response);
  }

  @Post('properties/:uuid/duplicate')
  @RequirePermissions('properties.create')
  duplicate(
    @Req() r: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.service
      .duplicateProperty(uuid, actor(r, ua, rid))
      .then(response);
  }
}
