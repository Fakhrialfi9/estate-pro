import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyMasterService } from '../application/property-master.service.js';
import { CatalogUpdateDto, ListQuery, SubcategoryDto } from './property-master.dto.js';
import { actor, listResponse, response, type AuthenticatedRequest } from './controllers/property-controller.support.js';

@ApiTags('Property Subcategories')
@ApiBearerAuth()
@Controller({ path: 'property', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertySubcategoryController {
  constructor(private readonly service: PropertyMasterService) {}
  @Post('subcategories') @RequirePermissions('property-subcategories.create') create(@Req() r: AuthenticatedRequest, @Body() d: SubcategoryDto, @Headers('user-agent') ua?: string, @Headers('x-request-id') rid?: string) { return this.service.createSubcategory({ ...d }, actor(r, ua, rid)).then(response); }
  @Get('subcategories') @RequirePermissions('property-subcategories.read') list(@Query() q: ListQuery) { return this.service.listSubcategories(q).then(listResponse); }
  @Get('subcategories/:uuid') @RequirePermissions('property-subcategories.read') get(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) { return this.service.getSubcategory(uuid).then(response); }
  @Patch('subcategories/:uuid') @RequirePermissions('property-subcategories.update') update(@Req() r: AuthenticatedRequest, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() d: CatalogUpdateDto, @Headers('user-agent') ua?: string, @Headers('x-request-id') rid?: string) { return this.service.updateSubcategory(uuid, d.version, { ...d }, actor(r, ua, rid)).then(response); }
  @Delete('subcategories/:uuid') @HttpCode(204) @RequirePermissions('property-subcategories.delete') async remove(@Req() r: AuthenticatedRequest, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Headers('user-agent') ua?: string, @Headers('x-request-id') rid?: string) { await this.service.deleteSubcategory(uuid, actor(r, ua, rid)); }
}
