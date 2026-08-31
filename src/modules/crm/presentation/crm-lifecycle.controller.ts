import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import type { Request } from 'express';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CrmLifecycleService } from '../application/crm-lifecycle.service.js';
import { PageDto } from './crm.dto.js';
class ClosureDto { @IsOptional() @IsString() @MinLength(1) reason?:string; }
const actor=(r:Request)=>({actorUuid:(r.user as {sub?:string}|undefined)?.sub??'',ipAddress:r.ip});
@ApiTags('CRM Lead Lifecycle') @ApiBearerAuth() @UseGuards(JwtAuthGuard,AuthorizationGuard)
@Controller({path:'crm/leads',version:'1'})
export class CrmLifecycleController { constructor(private readonly service:CrmLifecycleService){}
 @Post(':uuid/qualify') @RequirePermissions('crm.leads.update') @ApiOperation({summary:'Qualify a lead'}) @ApiResponse({status:200}) qualify(@Req()r:Request,@Param('uuid')u:string){return this.service.qualify(u,actor(r)).then(data=>({data}));}
 @Post(':uuid/nurture') @RequirePermissions('crm.leads.update') @ApiOperation({summary:'Start lead nurturing'}) nurture(@Req()r:Request,@Param('uuid')u:string){return this.service.nurtureWorkflow(u,actor(r)).then(data=>({data}));}
 @Post(':uuid/reactivate') @RequirePermissions('crm.leads.update') @ApiOperation({summary:'Reactivate a closed lead'}) reactivate(@Req()r:Request,@Param('uuid')u:string){return this.service.reactivate(u,actor(r)).then(data=>({data}));}
 @Post(':uuid/close') @RequirePermissions('crm.leads.archive') @ApiOperation({summary:'Close a lead with reason'}) close(@Req()r:Request,@Param('uuid')u:string,@Body()d:ClosureDto){return this.service.close(u,d.reason,actor(r)).then(data=>({data}));}
 @Post(':uuid/convert') @RequirePermissions('crm.leads.convert') @ApiOperation({summary:'Prepare qualified-lead conversion boundary'}) @ApiResponse({status:200}) convert(@Param('uuid')u:string){return this.service.conversionPlan(u).then(data=>({data}));}
 @Get(':uuid/timeline') @RequirePermissions('crm.leads.read') @ApiOperation({summary:'Unified lead timeline'}) timeline(@Param('uuid')u:string,@Query()q:PageDto){return this.service.timeline(u,q).then(data=>({data:data.items,meta:{page:data.page,limit:data.limit,total:data.total,totalPages:Math.ceil(data.total/data.limit)}}));}
}
