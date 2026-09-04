import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from '../../domain/repositories/system-activity.repository.js';
import type { SystemImportRepository } from '../../domain/repositories/system-import.repository.js';
import { SYSTEM_IMPORT_REPOSITORY } from '../../domain/repositories/system-import.repository.js';
import type { SystemArtifactStorage } from '../../domain/repositories/system-artifact.storage.js';
import { SYSTEM_ARTIFACT_STORAGE } from '../../domain/repositories/system-artifact.storage.js';
import type { ImportFormat, ImportRequest, ImportResult, SystemActivityAppendInput } from '../../domain/system-public.contracts.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_ERRORS = 500;
const EXPIRY_MS = 24 * 60 * 60 * 1000;

function parseCsv(input:string):string[][] {
  const rows:string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false;
  for(let i=0;i<input.length;i+=1){ const ch=input[i];
    if(quoted){ if(ch==='"'){ if(input[i+1]==='"'){cell+='"';i+=1;} else quoted=false;} else cell+=ch; continue; }
    if(ch==='"'&&cell.length===0) quoted=true;
    else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell.endsWith('\r')?cell.slice(0,-1):cell);rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted) throw new BadRequestException('Malformed CSV quoting');
  if(cell.length>0||row.length>0){row.push(cell);rows.push(row);}
  return rows;
}

function parseRows(content:string,format:ImportFormat):Record<string,unknown>[] {
  if(format==='json'){ let parsed:unknown; try{parsed=JSON.parse(content);}catch{throw new BadRequestException('Invalid JSON import payload');} if(!Array.isArray(parsed)) throw new BadRequestException('JSON import must contain an array of objects'); return parsed.map((v,index)=>{if(!v||typeof v!=='object'||Array.isArray(v)) throw new BadRequestException(`Invalid row ${index+1}`); return v as Record<string,unknown>;}); }
  const rows=parseCsv(content); if(rows.length===0)return[]; const headers=rows[0].map(v=>v.trim()); if(headers.some(v=>!v)||new Set(headers).size!==headers.length) throw new BadRequestException('CSV headers must be non-empty and unique'); return rows.slice(1).map(values=>Object.fromEntries(headers.map((header,i)=>[header,values[i]??''])));
}

@Injectable()
export class SystemImportService {
  constructor(@Inject(SYSTEM_IMPORT_REPOSITORY) private readonly jobs:SystemImportRepository,@Inject(SYSTEM_ACTIVITY_REPOSITORY) private readonly activity:SystemActivityRepository,@Inject(SYSTEM_ARTIFACT_STORAGE) private readonly storage:SystemArtifactStorage){}

  async execute(actorUuid:string,input:ImportRequest):Promise<ImportResult>{
    if(!actorUuid) throw new BadRequestException('Authenticated actor missing');
    const ext=input.filename?.toLowerCase().split('.').pop(); const format=input.format??(ext==='json'?'json':ext==='csv'?'csv':undefined);
    if(!input.filename||input.filename.length>255||!format) throw new BadRequestException('Only CSV and JSON imports are supported');
    const buffer=Buffer.from(input.contentBase64??'','base64'); if(buffer.length===0) throw new BadRequestException('Import content is required'); if(buffer.length>MAX_FILE_BYTES) throw new BadRequestException('Import file exceeds 5 MiB limit');
    const content=buffer.toString('utf8'); const idempotencyKey=input.idempotencyKey?.trim()||createHash('sha256').update(`${actorUuid}:${input.filename}:${content}`).digest('hex');
    const existing=await this.jobs.findByIdempotencyKey(idempotencyKey,actorUuid); if(existing) return this.toResult(existing);
    const job=await this.jobs.create({uuid:randomUUID(),actorUuid,filename:input.filename.replace(/[\x00-\x1f/\\]/g,'_'),format,preview:input.preview===true,idempotencyKey,sourcePath:null,expiresAt:new Date(Date.now()+EXPIRY_MS)});
    let sourcePath:string|undefined;
    try{
      const stored=await this.storage.put(job.uuid,buffer,'source'); sourcePath=stored.path; await this.jobs.update(job.uuid,{state:'RUNNING',sourcePath,totalRows:0});
      const rows=parseRows(content,format); if(rows.length>MAX_ROWS) throw new BadRequestException(`Import contains more than ${MAX_ROWS} rows`);
      const errors:{row:number;field?:string;message:string}[]=[]; let processed=0; let failed=0;
      for(let index=0;index<rows.length;index+=1){
        const row=rows[index]; const rowNumber=index+2; const eventType=String(row.eventType??'').trim(); const category=String(row.category??'').trim(); const summary=String(row.summary??'').trim();
        if(!eventType||!category||!summary){failed+=1;if(errors.length<MAX_ERRORS)errors.push({row:rowNumber,message:'eventType, category and summary are required'});continue;}
        if(input.preview){processed+=1;continue;}
        const deterministicUuid=createHash('sha256').update(`${job.uuid}:${index}:${JSON.stringify(row)}`).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/,'$1-$2-$3-$4-$5');
        const data:SystemActivityAppendInput={uuid:deterministicUuid,actorUuid,eventType,category,resourceType:row.resourceType?String(row.resourceType):null,resourceUuid:row.resourceUuid?String(row.resourceUuid):null,summary,metadata:typeof row.metadata==='object'&&row.metadata!==null?row.metadata as Record<string,unknown>:{} ,requestId:row.requestId?String(row.requestId):null};
        try{await this.activity.append(data);processed+=1;}catch(error:unknown){if(error instanceof Error&&/unique|duplicate/i.test(error.message)){processed+=1;continue;}failed+=1;if(errors.length<MAX_ERRORS)errors.push({row:rowNumber,message:error instanceof Error?error.message:'Row import failed'});}
      }
      const finalState=failed>0?'FAILED':'SUCCEEDED'; const updated=await this.jobs.update(job.uuid,{state:finalState,processedRows:processed,failedRows:failed,errors,totalRows:rows.length}); await this.storage.remove(sourcePath); return this.toResult(updated);
    }catch(error:unknown){const message=error instanceof Error?error.message:'Import failed'; const updated=await this.jobs.update(job.uuid,{state:'FAILED',errors:[{row:0,message}]}); if(sourcePath) await this.storage.remove(sourcePath); return this.toResult(updated);}
  }
  async get(actorUuid:string,uuid:string){const row=await this.jobs.findByUuid(uuid,actorUuid);if(!row)throw new NotFoundException('Import job not found');return this.toResult(row);}
  async list(actorUuid:string,page=1,limit=20,state?:ImportResult['state']){return this.jobs.list({actorUuid,page:Math.max(1,page),limit:Math.min(100,Math.max(1,limit)),state});}
  async retry(actorUuid:string,uuid:string){const row=await this.jobs.findByUuid(uuid,actorUuid);if(!row)throw new NotFoundException('Import job not found');if(!['FAILED','RETRYABLE'].includes(row.state))throw new BadRequestException('Import job is not retryable');if(!row.sourcePath)throw new BadRequestException('Original import source is unavailable');const data=await this.storage.read(row.sourcePath);return this.execute(actorUuid,{filename:row.filename,contentBase64:data.toString('base64'),format:row.format,idempotencyKey:`${row.idempotencyKey??row.uuid}:retry`});}
  async cancel(actorUuid:string,uuid:string){const row=await this.jobs.findByUuid(uuid,actorUuid);if(!row)throw new NotFoundException('Import job not found');if(!['QUEUED','RUNNING'].includes(row.state))throw new BadRequestException('Import job is not cancellable');return this.toResult(await this.jobs.update(uuid,{state:'CANCELLED'}));}
  private toResult(row:{uuid:string;state:ImportResult['state'];totalRows:number;processedRows:number;failedRows:number;errors:readonly {row:number;field?:string;message:string}[];preview:boolean}){return{uuid:row.uuid,state:row.state,totalRows:row.totalRows,processedRows:row.processedRows,failedRows:row.failedRows,errors:row.errors,preview:row.preview};}
}
