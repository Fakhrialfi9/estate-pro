import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import type { Request } from 'express';
import { CrmService } from '../application/crm.service.js';
import { PageDto, ContactDto, ContactPatchDto, AddressDto, PhoneDto, EmailDto, PreferenceDto, ConsentDto, RelationshipDto, LeadDto, LeadPatchDto, ConfigDto, NoteDto, AssignmentDto, StatusDto, ScoreRuleDto, DuplicateReviewDto, MergeDto, InquiryDto, InquiryPatchDto, ConversionDto, ActivityDto, ActivityPatchDto, ActivityStatusDto, CommunicationDto, CommunicationStatusDto, TemplateDto } from './crm.dto.js';
import type { CrmActor, PageQuery } from '../domain/crm.types.js';
const actorOf=(req:Request,ua?:string,rid?:string):CrmActor=>({actorUuid:(req.user as {sub?:string}|undefined)?.sub??'',ipAddress:req.ip,userAgent:ua,requestId:rid});
const out=(v:unknown)=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(out):v&&typeof v==='object'?Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([k])=>!['id','contactId','leadId','statusId','sourceId','campaignId','typeId','activityId','templateId','password','secret','token','refreshToken'].includes(k)).map(([k,x])=>[k,out(x)])):typeof v==='bigint'?v.toString():v;
const response=(v:unknown)=>({data:out(v)});const list=(v:{items:readonly unknown[];total:number;page:number;limit:number})=>({data:out(v.items),meta:{page:v.page,limit:v.limit,total:v.total,totalPages:Math.ceil(v.total/v.limit)}});
@ApiTags('CRM') @ApiBearerAuth() @Controller({path:'crm',version:'1'}) @UseGuards(JwtAuthGuard,AuthorizationGuard)
export class CrmController {
 constructor(private readonly service:CrmService){}
 @Post('contacts') @RequirePermissions('crm.contacts.create') @ApiOperation({summary:'Create contact'}) @ApiResponse({status:201}) createContact(@Req()r:Request,@Body()d:ContactDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.createContact({...d},actorOf(r,ua,rid)).then(response)}
 @Get('contacts') @RequirePermissions('crm.contacts.read') @ApiOperation({summary:'List contacts'}) listContacts(@Query()q:PageDto){return this.service.listContacts(q).then(list)}
 @Get('contacts/:uuid') @RequirePermissions('crm.contacts.read') getContact(@Param('uuid',new ParseUUIDPipe({version:'4'}))u:string){return this.service.getContact(u).then(response)}
 @Patch('contacts/:uuid') @RequirePermissions('crm.contacts.update') updateContact(@Req()r:Request,@Param('uuid',new ParseUUIDPipe({version:'4'}))u:string,@Body()d:ContactPatchDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.updateContact(u,{...d},actorOf(r,ua,rid)).then(response)}
 @Delete('contacts/:uuid') @RequirePermissions('crm.contacts.archive') archiveContact(@Req()r:Request,@Param('uuid',new ParseUUIDPipe({version:'4'}))u:string,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){return this.service.archiveContact(u,actorOf(r,ua,rid)).then(()=>({data:null}))}
 @Post('contacts/:uuid/addresses') @RequirePermissions('crm.contacts.update') addAddress(@Req()r:Request,@Param('uuid')u:string,@Body()d:AddressDto){return this.service.child('address',u,{...d},actorOf(r)).then(response)}
 @Post('contacts/:uuid/phones') @RequirePermissions('crm.contacts.update') addPhone(@Req()r:Request,@Param('uuid')u:string,@Body()d:PhoneDto){return this.service.child('phone',u,{...d},actorOf(r)).then(response)}
 @Post('contacts/:uuid/emails') @RequirePermissions('crm.contacts.update') addEmail(@Req()r:Request,@Param('uuid')u:string,@Body()d:EmailDto){return this.service.child('email',u,{...d},actorOf(r)).then(response)}
 @Patch('contact-fields/:kind/:uuid') @RequirePermissions('crm.contacts.update') updateChild(@Req()r:Request,@Param('kind')kind:'address'|'phone'|'email',@Param('uuid')u:string,@Body()d:Record<string,unknown>){return this.service.childUpdate(kind,u,d,actorOf(r)).then(response)}
 @Delete('contact-fields/:kind/:uuid') @RequirePermissions('crm.contacts.update') deleteChild(@Req()r:Request,@Param('kind')kind:'address'|'phone'|'email',@Param('uuid')u:string){return this.service.childDelete(kind,u,actorOf(r)).then(()=>({data:null}))}
 @Post('contacts/:uuid/:kind/:childUuid/primary') @RequirePermissions('crm.contacts.update') primary(@Req()r:Request,@Param('uuid')c:string,@Param('kind')kind:'address'|'phone'|'email',@Param('childUuid')u:string){return this.service.childPrimary(kind,c,u,actorOf(r)).then(response)}
 @Patch('contacts/:uuid/preferences') @RequirePermissions('crm.contacts.update') preferences(@Req()r:Request,@Param('uuid')u:string,@Body()d:PreferenceDto){return this.service.preferences(u,{...d},actorOf(r)).then(response)}
 @Post('contacts/:uuid/consents') @RequirePermissions('crm.contacts.consent') consent(@Req()r:Request,@Param('uuid')u:string,@Body()d:ConsentDto){return this.service.consent(u,{...d},actorOf(r)).then(response)}
 @Post('contacts/:uuid/relationships') @RequirePermissions('crm.contacts.update') relationship(@Req()r:Request,@Param('uuid')u:string,@Body()d:RelationshipDto){return this.service.relationship(u,d.targetContactUuid,{...d},actorOf(r)).then(response)}
 @Delete('contact-relationships/:uuid') @RequirePermissions('crm.contacts.update') removeRelationship(@Req()r:Request,@Param('uuid')u:string){return this.service.removeRelationship(u,actorOf(r)).then(()=>({data:null}))}
 @Post('leads') @RequirePermissions('crm.leads.create') createLead(@Req()r:Request,@Body()d:LeadDto){return this.service.createLead({...d},actorOf(r)).then(response)}
 @Get('leads') @RequirePermissions('crm.leads.read') listLeads(@Query()q:PageDto){return this.service.listLeads(q).then(list)}
 @Get('leads/:uuid') @RequirePermissions('crm.leads.read') getLead(@Param('uuid')u:string){return this.service.getLead(u).then(response)}
 @Patch('leads/:uuid') @RequirePermissions('crm.leads.update') updateLead(@Req()r:Request,@Param('uuid')u:string,@Body()d:LeadPatchDto){return this.service.updateLead(u,{...d},actorOf(r)).then(response)}
 @Delete('leads/:uuid') @RequirePermissions('crm.leads.archive') archiveLead(@Req()r:Request,@Param('uuid')u:string){return this.service.archiveLead(u,actorOf(r)).then(()=>({data:null}))}
 @Post('leads/:uuid/status') @RequirePermissions('crm.leads.update') status(@Req()r:Request,@Param('uuid')u:string,@Body()d:StatusDto){return this.service.changeStatus(u,d.statusUuid,actorOf(r)).then(response)}
 @Post('leads/:uuid/assign') @RequirePermissions('crm.leads.assign') assign(@Req()r:Request,@Param('uuid')u:string,@Body()d:AssignmentDto){return this.service.assign(u,d.userUuid,actorOf(r)).then(response)}
 @Delete('leads/:uuid/assign') @RequirePermissions('crm.leads.assign') unassign(@Req()r:Request,@Param('uuid')u:string){return this.service.unassign(u,actorOf(r)).then(response)}
 @Post('leads/:uuid/notes') @RequirePermissions('crm.leads.update') note(@Req()r:Request,@Param('uuid')u:string,@Body()d:NoteDto){return this.service.note(u,d.body,actorOf(r)).then(response)}
 @Post('leads/:uuid/tags/:tagUuid') @RequirePermissions('crm.leads.update') tag(@Req()r:Request,@Param('uuid')u:string,@Param('tagUuid')t:string){return this.service.tag(u,t,actorOf(r)).then(response)}
 @Delete('leads/:uuid/tags/:tagUuid') @RequirePermissions('crm.leads.update') untag(@Req()r:Request,@Param('uuid')u:string,@Param('tagUuid')t:string){return this.service.untag(u,t,actorOf(r)).then(()=>({data:null}))}
 @Get('leads/:uuid/history') @RequirePermissions('crm.leads.read') history(@Param('uuid')u:string,@Query()q:PageDto){return this.service.history(u,q).then(list)}
 @Get('leads/:uuid/score') @RequirePermissions('crm.leads.read') score(@Param('uuid')u:string){return this.service.score(u).then(response)}
 @Post('leads/:uuid/score/recalculate') @RequirePermissions('crm.leads.update') recalc(@Req()r:Request,@Param('uuid')u:string){return this.service.recalcScore(u,actorOf(r)).then(response)}
 @Get('score-rules') @RequirePermissions('crm.scoring.read') rules(){return this.service.scoreRules().then(response)}
 @Post('score-rules') @RequirePermissions('crm.scoring.manage') createRule(@Req()r:Request,@Body()d:ScoreRuleDto){return this.service.createScoreRule({...d},actorOf(r)).then(response)}
 @Patch('score-rules/:uuid') @RequirePermissions('crm.scoring.manage') updateRule(@Req()r:Request,@Param('uuid')u:string,@Body()d:Partial<ScoreRuleDto>){return this.service.updateScoreRule(u,{...d},actorOf(r)).then(response)}
 @Delete('score-rules/:uuid') @RequirePermissions('crm.scoring.manage') deleteRule(@Req()r:Request,@Param('uuid')u:string){return this.service.deleteScoreRule(u,actorOf(r)).then(()=>({data:null}))}
 @Post('leads/:uuid/duplicates/detect') @RequirePermissions('crm.duplicates.read') duplicates(@Param('uuid')u:string){return this.service.duplicates(u).then(response)}
 @Get('duplicates') @RequirePermissions('crm.duplicates.read') duplicateList(@Query()q:PageDto){return this.service.duplicateList(q).then(list)}
 @Post('duplicates/:uuid/review') @RequirePermissions('crm.duplicates.manage') duplicateReview(@Req()r:Request,@Param('uuid')u:string,@Body()d:DuplicateReviewDto){return this.service.duplicateReview(u,d.status,actorOf(r)).then(response)}
 @Post('leads/:uuid/merge') @RequirePermissions('crm.leads.merge') merge(@Req()r:Request,@Param('uuid')u:string,@Body()d:MergeDto){return this.service.merge(u,d.targetLeadUuid,actorOf(r)).then(response)}
 @Get('configs/:kind') @RequirePermissions('crm.config.read') configList(@Param('kind')kind:string,@Query()q:PageDto){return this.service.configList(kind,q).then(list)}
 @Post('configs/:kind') @RequirePermissions('crm.config.manage') configCreate(@Req()r:Request,@Param('kind')kind:string,@Body()d:ConfigDto){return this.service.configCreate(kind,{...d},actorOf(r)).then(response)}
 @Patch('configs/:kind/:uuid') @RequirePermissions('crm.config.manage') configUpdate(@Req()r:Request,@Param('kind')kind:string,@Param('uuid')u:string,@Body()d:ConfigDto){return this.service.configUpdate(kind,u,{...d},actorOf(r)).then(response)}
 @Delete('configs/:kind/:uuid') @RequirePermissions('crm.config.manage') configDelete(@Req()r:Request,@Param('kind')kind:string,@Param('uuid')u:string){return this.service.configDelete(kind,u,actorOf(r)).then(()=>({data:null}))}
 @Post('inquiries') @RequirePermissions('crm.inquiries.create') createInquiry(@Req()r:Request,@Body()d:InquiryDto,@Headers('user-agent')ua?:string,@Headers('x-request-id')rid?:string){if(d.website?.trim())return {data:null};return this.service.inquiry({...d},actorOf(r,ua,rid)).then(response)}
 @Get('inquiries') @RequirePermissions('crm.inquiries.read') inquiryList(@Query()q:PageDto){return this.service.inquiryList(q).then(list)}
 @Get('inquiries/:uuid') @RequirePermissions('crm.inquiries.read') inquiryGet(@Param('uuid')u:string){return this.service.inquiryGet(u).then(response)}
 @Patch('inquiries/:uuid') @RequirePermissions('crm.inquiries.update') inquiryUpdate(@Req()r:Request,@Param('uuid')u:string,@Body()d:InquiryPatchDto){return this.service.inquiryUpdate(u,{...d},actorOf(r)).then(response)}
 @Post('inquiries/:uuid/convert') @RequirePermissions('crm.inquiries.convert') inquiryConvert(@Req()r:Request,@Param('uuid')u:string,@Body()d:ConversionDto){return this.service.inquiryConvert(u,{...d},actorOf(r)).then(response)}
 @Post('activities') @RequirePermissions('crm.activities.create') activityCreate(@Req()r:Request,@Body()d:ActivityDto){return this.service.activityCreate({...d},actorOf(r)).then(response)}
 @Get('activities') @RequirePermissions('crm.activities.read') activityList(@Query()q:PageDto){return this.service.activityList(q).then(list)}
 @Get('activities/:uuid') @RequirePermissions('crm.activities.read') activityGet(@Param('uuid')u:string){return this.service.activityGet(u).then(response)}
 @Patch('activities/:uuid') @RequirePermissions('crm.activities.update') activityUpdate(@Req()r:Request,@Param('uuid')u:string,@Body()d:ActivityPatchDto){return this.service.activityUpdate(u,{...d},actorOf(r)).then(response)}
 @Post('activities/:uuid/status') @RequirePermissions('crm.activities.update') activityStatus(@Req()r:Request,@Param('uuid')u:string,@Body()d:ActivityStatusDto){return this.service.activityTransition(u,d.status,actorOf(r)).then(response)}
 @Post('communications') @RequirePermissions('crm.communications.create') communicationCreate(@Req()r:Request,@Body()d:CommunicationDto){return this.service.communicationCreate({...d},actorOf(r)).then(response)}
 @Get('communications') @RequirePermissions('crm.communications.read') communicationList(@Query()q:PageDto){return this.service.communicationList(q).then(list)}
 @Get('communications/:uuid') @RequirePermissions('crm.communications.read') communicationGet(@Param('uuid')u:string){return this.service.communicationGet(u).then(response)}
 @Post('communications/:uuid/status') @RequirePermissions('crm.communications.update') communicationStatus(@Req()r:Request,@Param('uuid')u:string,@Body()d:CommunicationStatusDto){return this.service.communicationTransition(u,d.status,{...d},actorOf(r)).then(response)}
 @Get('communication-templates') @RequirePermissions('crm.communications.read') templates(@Query()q:PageDto){return this.service.templates(q).then(list)}
 @Post('communication-templates') @RequirePermissions('crm.communications.manage') templateCreate(@Req()r:Request,@Body()d:TemplateDto){return this.service.templateCreate({...d},actorOf(r)).then(response)}
 @Patch('communication-templates/:uuid') @RequirePermissions('crm.communications.manage') templateUpdate(@Req()r:Request,@Param('uuid')u:string,@Body()d:Partial<TemplateDto>){return this.service.templateUpdate(u,{...d},actorOf(r)).then(response)}
}
