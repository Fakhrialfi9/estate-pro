import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, UseGuards, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyMasterService } from '../application/property-master.service.js';
import { CatalogDto, CatalogUpdateDto, FacilityDto, FacilityUpdateDto, ListQuery, LocationDto, LocationUpdateDto, PropertyDto, PropertyUpdateDto, SubcategoryDto } from './property-master.dto.js';

type AuthenticatedRequest = Request & { user?: { sub?: string } };
const actor = (r: AuthenticatedRequest, userAgent?: string, requestId?: string) => ({ actorUuid:r.user?.sub, ipAddress:r.ip, userAgent, requestId });
const levelOf = (level:string): 'country'|'province'|'city'|'district'|'subdistrict' => { if(['country','province','city','district','subdistrict'].includes(level)) return level as 'country'|'province'|'city'|'district'|'subdistrict'; throw new BadRequestException('Invalid location level'); };
const response = (data: unknown) => ({ data });
const listResponse = (r: {items:readonly unknown[];total:number;page:number;limit:number}) => ({ items:r.items, meta:{page:r.page,limit:r.limit,total:r.total,totalPages:Math.ceil(r.total/r.limit)} });

@ApiTags('Property Master')
@ApiBearerAuth()
@Controller({path:'property', version:'1'})
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyMasterController {
 constructor(private readonly service: PropertyMasterService) {}

 @Post('categories') @RequirePermissions('property-categories.create') @ApiOperation({summary:'Create property category'}) createCategory(@Req()r:AuthenticatedRequest,@Body()d:CatalogDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.createCategory(d,actor(r,ua,rid)).then(response);}
 @Get('categories') @RequirePermissions('property-categories.read') listCategory(@Query()q:ListQuery){return this.service.listCategories(q).then(listResponse);}
 @Get('categories/:uuid') @RequirePermissions('property-categories.read') getCategory(@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string){return this.service.getCategory(uuid).then(response);}
 @Patch('categories/:uuid') @RequirePermissions('property-categories.update') updateCategory(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Body()d:CatalogUpdateDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.updateCategory(uuid,d.version,d,actor(r,ua,rid)).then(response);}
 @Delete('categories/:uuid') @HttpCode(204) @RequirePermissions('property-categories.delete') async deleteCategory(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){await this.service.deleteCategory(uuid,actor(r,ua,rid));}

 @Post('subcategories') @RequirePermissions('property-subcategories.create') createSubcategory(@Req()r:AuthenticatedRequest,@Body()d:SubcategoryDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.createSubcategory(d,actor(r,ua,rid)).then(response);}
 @Get('subcategories') @RequirePermissions('property-subcategories.read') listSubcategory(@Query()q:ListQuery){return this.service.listSubcategories(q).then(listResponse);}
 @Get('subcategories/:uuid') @RequirePermissions('property-subcategories.read') getSubcategory(@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string){return this.service.getSubcategory(uuid).then(response);}
 @Patch('subcategories/:uuid') @RequirePermissions('property-subcategories.update') updateSubcategory(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Body()d:CatalogUpdateDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.updateSubcategory(uuid,d.version,d,actor(r,ua,rid)).then(response);}
 @Delete('subcategories/:uuid') @HttpCode(204) @RequirePermissions('property-subcategories.delete') async deleteSubcategory(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){await this.service.deleteSubcategory(uuid,actor(r,ua,rid));}

 @Post('locations/:level') @RequirePermissions('locations.manage') createLocation(@Req()r:AuthenticatedRequest,@Param('level')level:string,@Body()d:LocationDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.createLocation(levelOf(level),d,actor(r,ua,rid)).then(response);}
 @Get('locations/:level') @RequirePermissions('locations.read') listLocation(@Param('level')level:string,@Query()q:ListQuery){return this.service.listLocations(levelOf(level),q).then(listResponse);}
 @Get('locations/:level/:uuid') @RequirePermissions('locations.read') getLocation(@Param('level')level:string,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string){return this.service.getLocation(levelOf(level),uuid).then(response);}
 @Patch('locations/:level/:uuid') @RequirePermissions('locations.manage') updateLocation(@Req()r:AuthenticatedRequest,@Param('level')level:string,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Body()d:LocationUpdateDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.updateLocation(levelOf(level),uuid,d.version,d,actor(r,ua,rid)).then(response);}
 @Delete('locations/:level/:uuid') @HttpCode(204) @RequirePermissions('locations.manage') async deleteLocation(@Req()r:AuthenticatedRequest,@Param('level')level:string,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){await this.service.deleteLocation(levelOf(level),uuid,actor(r,ua,rid));}
 @Get('locations/:level/:uuid/children') @RequirePermissions('locations.read') children(@Param('level')level:string,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string){return this.service.children(levelOf(level),uuid).then(response);}

 @Post('facilities') @RequirePermissions('facilities.create') createFacility(@Req()r:AuthenticatedRequest,@Body()d:FacilityDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.createFacility(d,actor(r,ua,rid)).then(response);}
 @Get('facilities') @RequirePermissions('facilities.read') listFacility(@Query()q:ListQuery){return this.service.listFacilities(q).then(listResponse);}
 @Get('facilities/:uuid') @RequirePermissions('facilities.read') getFacility(@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string){return this.service.getFacility(uuid).then(response);}
 @Patch('facilities/:uuid') @RequirePermissions('facilities.update') updateFacility(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Body()d:FacilityUpdateDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.updateFacility(uuid,d.version,d,actor(r,ua,rid)).then(response);}
 @Delete('facilities/:uuid') @HttpCode(204) @RequirePermissions('facilities.delete') async deleteFacility(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){await this.service.deleteFacility(uuid,actor(r,ua,rid));}

 @Post('properties') @RequirePermissions('properties.create') createProperty(@Req()r:AuthenticatedRequest,@Body()d:PropertyDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.createProperty(d,actor(r,ua,rid)).then(response);}
 @Get('properties') @RequirePermissions('properties.read') listProperty(@Query()q:ListQuery){return this.service.listProperties(q).then(listResponse);}
 @Get('properties/:uuid') @RequirePermissions('properties.read') getProperty(@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string){return this.service.getProperty(uuid).then(response);}
 @Patch('properties/:uuid') @RequirePermissions('properties.update') updateProperty(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Body()d:PropertyUpdateDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.updateProperty(uuid,d.version,d,actor(r,ua,rid)).then(response);}
 @Delete('properties/:uuid') @HttpCode(204) @RequirePermissions('properties.delete') async deleteProperty(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){await this.service.deleteProperty(uuid,actor(r,ua,rid));}
 @Post('properties/:uuid/restore') @RequirePermissions('properties.update') restore(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.restoreProperty(uuid,actor(r,ua,rid)).then(response);}
 @Post('properties/:uuid/duplicate') @RequirePermissions('properties.create') duplicate(@Req()r:AuthenticatedRequest,@Param('uuid',new ParseUUIDPipe({version:'4'}))uuid:string,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.duplicateProperty(uuid,actor(r,ua,rid)).then(response);}
}
