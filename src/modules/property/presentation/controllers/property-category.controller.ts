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
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyMasterService } from '../application/property-master.service.js';
import {
  CatalogDto,
  CatalogUpdateDto,
  ListQuery,
} from './property-master.dto.js';
import {
  actor,
  listResponse,
  response,
  type AuthenticatedRequest,
} from './controllers/property-controller.support.js';

@ApiTags('Property Categories')
@ApiBearerAuth()
@Controller({ path: 'property', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyCategoryController {
  constructor(private readonly service: PropertyMasterService) {}
  @Post('categories') @RequirePermissions('property-categories.create') create(
    @Req() r: AuthenticatedRequest,
    @Body() d: CatalogDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.service
      .createCategory({ ...d }, actor(r, ua, rid))
      .then(response);
  }
  @Get('categories') @RequirePermissions('property-categories.read') list(
    @Query() q: ListQuery,
  ) {
    return this.service.listCategories(q).then(listResponse);
  }
  @Get('categories/:uuid') @RequirePermissions('property-categories.read') get(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.getCategory(uuid).then(response);
  }
  @Patch('categories/:uuid')
  @RequirePermissions('property-categories.update')
  update(
    @Req() r: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() d: CatalogUpdateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.service
      .updateCategory(uuid, d.version, { ...d }, actor(r, ua, rid))
      .then(response);
  }
  @Delete('categories/:uuid')
  @HttpCode(204)
  @RequirePermissions('property-categories.delete')
  async remove(
    @Req() r: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    await this.service.deleteCategory(uuid, actor(r, ua, rid));
  }
}
