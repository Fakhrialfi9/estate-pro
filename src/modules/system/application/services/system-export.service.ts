import { createHash, randomUUID, timingSafeEqual, randomBytes } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from '../../domain/repositories/system-activity.repository.js';
import type { SystemExportJobRecord, SystemExportRepository } from '../../domain/repositories/system-export.repository.js';
import { SYSTEM_EXPORT_REPOSITORY } from '../../domain/repositories/system-export.repository.js';
import type { SystemArtifactStorage } from '../../domain/repositories/system-artifact.storage.js';
import { SYSTEM_ARTIFACT_STORAGE } from '../../domain/repositories/system-artifact.storage.js';
import type { ExportRequest, ExportResult } from '../../domain/system-public.contracts.js';

const MAX_ROWS=10_000; const EXPIRY_MS=15*60*1000;
const csvCell=(value:unknown)=>{let text=value==null?'':String(value);if(/^[=+\-@]/.test(text))text=`'${text}`;return/[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;};

@Injectable()
export class SystemExportService {
  constructor(@Inject(SYSTEM_EXPORT_REPOSITORY) private readonly jobs:SystemExportRepository,@Inject(SYSTEM_ACTIVITY_REPOSITORY) private readonly activity:SystemActivityRepository,@Inject(SYSTEM_ARTIFACT_STORAGE) private readonly storage:SystemArtifactStorage){}
  async execute(request:ExportRequest):Promise<ExportResult>{
    const uuid=randomUUID(); const expiresAt=new Date(Date.now()+EXPIRY_MS); const job=await this.jobs.create({uuid,actorUuid:request.actorUuid,entity:request.entity,format:request.format,filters:{from:request.from?.toISOString(),to:request.to?.toISOString(),category:request.category,eventType:request.eventType},expiresAt});
    const downloadToken=randomBytes(32).toString('base64url'); const tokenHash=createHash('sha256').update(downloadToken,'utf8').digest('hex');
    try{await this.jobs.update(uuid,{state:'RUNNING',downloadTokenHash:tokenHash}); const rows=(await this.activity.list({page:1,limit:MAX_ROWS,category:request.category,eventType:request.eventType})).items.filter(r=>(!request.from||r.createdAt>=request.from)&&(!request.to||r.createdAt<=request.to)).slice(0,Math.min(request.limit??MAX_ROWS,MAX_ROWS)).map(r=>({uuid:r.uuid,actorUuid:r.actorUuid,eventType:r.eventType,category:r.category,resourceType:r.resourceType,resourceUuid:r.resourceUuid,summary:r.summary,metadata:r.metadata,requestId:r.requestId,createdAt:r.createdAt.toISOString()}));
      const body=request.format==='json'?JSON.stringify(rows):this.toCsv(rows); const stored=await this.storage.put(uuid,Buffer.from(body,'utf8'),request.format); const updated=await this.jobs.update(uuid,{state:'SUCCEEDED',artifactPath:stored.path,rows:rows.length,expiresAt}); return{uuid:updated.uuid,state:'SUCCEEDED',format:updated.format,rows:updated.rows,expiresAt:updated.expiresAt,downloadToken};
    }catch(error:unknown){const updated=await this.jobs.update(uuid,{state:'FAILED',errorMessage:error instanceof Error?error.message:'Export failed'});return{uuid:updated.uuid,state:'FAILED',format:updated.format,rows:updated.rows,expiresAt:updated.expiresAt,downloadToken};}
  }
  async get(actorUuid:string,uuid:string){const row=await this.jobs.findByUuid(uuid,actorUuid);if(!row)throw new NotFoundException('Export job not found');const {downloadTokenHash:_ignored,...safe}=row;return safe;}
  async list(actorUuid:string,page=1,limit=20,state?:SystemExportJobRecord['state']){return this.jobs.list({actorUuid,page:Math.max(1,page),limit:Math.min(100,Math.max(1,limit)),state});}
  async download(actorUuid:string,uuid:string,token:string){const row=await this.jobs.findByUuid(uuid,actorUuid);if(!row||row.state!=='SUCCEEDED'||!row.artifactPath||!row.downloadTokenHash)throw new NotFoundException('Export artifact not found');if(row.expiresAt.getTime()<=Date.now())throw new ForbiddenException('Export download has expired');const hash=Buffer.from(createHash('sha256').update(token??'','utf8').digest('hex'));const expected=Buffer.from(row.downloadTokenHash);if(hash.length!==expected.length||!timingSafeEqual(hash,expected))throw new ForbiddenException('Invalid export download token');return{filename:`${row.uuid}.${row.format}`,stream:this.storage.stream(row.artifactPath),contentType:row.format==='csv'?'text/csv; charset=utf-8':'application/json; charset=utf-8'};}
  private toCsv(rows:readonly Record<string,unknown>[]){const headers=['uuid','actorUuid','eventType','category','resourceType','resourceUuid','summary','metadata','requestId','createdAt'];return`${headers.join(',')}\n${rows.map(row=>headers.map(k=>csvCell(k==='metadata'?JSON.stringify(row[k]??{}):row[k])).join(',')).join('\n')}\n`;}
}
