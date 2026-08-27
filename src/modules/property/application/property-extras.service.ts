import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import { PropertyExtrasConflictError, PropertyExtrasInvalidStateError, PropertyExtrasNotFoundError, validateCertificateInput, validateFinancialInvariants, validateLegalInvariants, validateMedia, validateSeoInvariants, validateUtilityInvariants } from '../domain/property-extras.js';
import { PROPERTY_EXTRAS_REPOSITORY, type PropertyExtrasActor, type PropertyExtrasRepository } from '../domain/repositories/property-extras.repository.js';
@Injectable()
export class PropertyExtrasService {
 constructor(@Inject(PROPERTY_EXTRAS_REPOSITORY) private readonly repository:PropertyExtrasRepository,@Inject(SECURITY_AUDIT_REPOSITORY) private readonly audit:SecurityAuditRepository){}
 getUtilities(id:string){return this.run(()=>this.repository.getUtilities(id));}
 async updateUtilities(id:string,p:Parameters<PropertyExtrasRepository['upsertUtilities']>[1],a:PropertyExtrasActor){validateUtilityInvariants(p);const r=await this.run(()=>this.repository.upsertUtilities(id,p,a));await this.record('property.utilities.update','property_utilities',id,a,p);return r;}
 getLegal(id:string){return this.run(()=>this.repository.getLegal(id));}
 async updateLegal(id:string,p:Parameters<PropertyExtrasRepository['upsertLegal']>[1],a:PropertyExtrasActor){validateLegalInvariants(p);const r=await this.run(()=>this.repository.upsertLegal(id,p,a));await this.record('property.legal.update','property_legal',id,a,p as Record<string,unknown>);return r;}
 listCertificates(id:string){return this.run(()=>this.repository.listCertificates(id));}
 async createCertificate(id:string,p:Parameters<PropertyExtrasRepository['createCertificate']>[1],a:PropertyExtrasActor){validateCertificateInput(p);const r=await this.run(()=>this.repository.createCertificate(id,p,a));await this.record('property.certificate.create','property_certificate',id,a,{type:p.type,status:p.status});return r;}
 async updateCertificate(id:string,cid:string,p:Parameters<PropertyExtrasRepository['updateCertificate']>[2],a:PropertyExtrasActor){validateCertificateInput(p);const r=await this.run(()=>this.repository.updateCertificate(id,cid,p,a));await this.record('property.certificate.update','property_certificate',cid,a,{type:p.type,status:p.status,numberChanged:p.number!==undefined});return r;}
 async deleteCertificate(id:string,cid:string,a:PropertyExtrasActor){await this.run(()=>this.repository.deleteCertificate(id,cid,a));await this.record('property.certificate.delete','property_certificate',cid,a);}
 getFinancial(id:string){return this.run(()=>this.repository.getFinancial(id));}
 async updateFinancial(id:string,p:Parameters<PropertyExtrasRepository['upsertFinancial']>[1],a:PropertyExtrasActor){validateFinancialInvariants(p);const r=await this.run(()=>this.repository.upsertFinancial(id,p,a));await this.record('property.financial.update','property_financial',id,a,p);return r;}
 getFeatures(id:string){return this.run(()=>this.repository.getFeatures(id));}
 async updateFeatures(id:string,p:Parameters<PropertyExtrasRepository['upsertFeatures']>[1],a:PropertyExtrasActor){const r=await this.run(()=>this.repository.upsertFeatures(id,p,a));await this.record('property.features.update','property_features',id,a,p);return r;}
 getSecurity(id:string){return this.run(()=>this.repository.getSecurity(id));}
 async updateSecurity(id:string,p:Parameters<PropertyExtrasRepository['upsertSecurity']>[1],a:PropertyExtrasActor){const r=await this.run(()=>this.repository.upsertSecurity(id,p,a));await this.record('property.security.update','property_security',id,a,p);return r;}
 getEnvironment(id:string){return this.run(()=>this.repository.getEnvironment(id));}
 async updateEnvironment(id:string,p:Parameters<PropertyExtrasRepository['upsertEnvironment']>[1],a:PropertyExtrasActor){const r=await this.run(()=>this.repository.upsertEnvironment(id,p,a));await this.record('property.environment.update','property_environment',id,a,p);return r;}
 getSeo(id:string){return this.run(()=>this.repository.getSeo(id));}
 async updateSeo(id:string,p:Parameters<PropertyExtrasRepository['upsertSeo']>[1],a:PropertyExtrasActor){const slug=await this.run(()=>this.repository.getPropertySlug(id));validateSeoInvariants(slug,p);const r=await this.run(()=>this.repository.upsertSeo(id,p,a));await this.record('property.seo.update','property_seo',id,a,p);return r;}
 listMedia(id:string){return this.run(()=>this.repository.listMedia(id));}
 async addMedia(id:string,p:Parameters<PropertyExtrasRepository['addMedia']>[1],a:PropertyExtrasActor){validateMedia(p);const r=await this.run(()=>this.repository.addMedia(id,p,a));await this.record('property.media.create','property_media',id,a,{type:p.type,category:p.category,isCover:p.isCover});return r;}
 async updateMedia(id:string,mid:string,p:Parameters<PropertyExtrasRepository['updateMedia']>[2],a:PropertyExtrasActor){validateMedia(p);const r=await this.run(()=>this.repository.updateMedia(id,mid,p,a));await this.record('property.media.update','property_media',mid,a,{type:p.type,category:p.category});return r;}
 async deleteMedia(id:string,mid:string,a:PropertyExtrasActor){await this.run(()=>this.repository.deleteMedia(id,mid,a));await this.record('property.media.delete','property_media',mid,a);}
 async setCover(id:string,mid:string,a:PropertyExtrasActor){const r=await this.run(()=>this.repository.setCover(id,mid,a));await this.record('property.media.set_cover','property_media',mid,a);return r;}
 async reorderMedia(id:string,ids:string[],a:PropertyExtrasActor){if(new Set(ids).size!==ids.length)throw new BadRequestException('mediaUuids must not contain duplicates');const r=await this.run(()=>this.repository.reorderMedia(id,ids,a));await this.record('property.media.reorder','property',id,a,{count:ids.length});return r;}
 private async record(action:string,entityType:string,entityUuid:string,a:PropertyExtrasActor,changes?:unknown){await this.audit.record({action,actorUuid:a.actorUuid,subjectUuid:a.actorUuid,actorType:'user',entityType,entityUuid,ipAddress:a.ipAddress,userAgent:a.userAgent,requestId:a.requestId,result:'success',changes:typeof changes==='object'&&changes!==null?(changes as Record<string,unknown>):undefined});}
 private async run<T>(op:()=>Promise<T>):Promise<T>{try{return await op();}catch(e:unknown){if(e instanceof PropertyExtrasNotFoundError)throw new NotFoundException(e.message);if(e instanceof PropertyExtrasConflictError)throw new ConflictException(e.message);if(e instanceof PropertyExtrasInvalidStateError)throw new BadRequestException(e.message);throw e;}}
}
