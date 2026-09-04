import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { ImportState } from '../../domain/system-public.contracts.js';
import { SYSTEM_IMPORT_REPOSITORY, type SystemImportJobRecord, type SystemImportRepository } from '../../domain/repositories/system-import.repository.js';

const map = (row:any):SystemImportJobRecord=>({ uuid:row.uuid, actorUuid:row.actorUuid, filename:row.filename, format:row.format, state:row.state, preview:row.preview, idempotencyKey:row.idempotencyKey, totalRows:row.totalRows, processedRows:row.processedRows, failedRows:row.failedRows, errors:Array.isArray(row.errors)?row.errors:[], sourcePath:row.sourcePath, expiresAt:row.expiresAt, createdAt:row.createdAt, updatedAt:row.updatedAt });

@Injectable()
export class PrismaSystemImportRepository implements SystemImportRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(input:{uuid:string;actorUuid:string;filename:string;format:'csv'|'json';preview:boolean;idempotencyKey?:string|null;sourcePath:string|null;expiresAt:Date}) { return map(await this.prisma.systemImportJob.create({data:{...input,state:'QUEUED',totalRows:0,processedRows:0,failedRows:0,errors:[]}})); }
  async findByUuid(uuid:string,actorUuid?:string) { const row=await this.prisma.systemImportJob.findFirst({where:{uuid,...(actorUuid?{actorUuid}: {})}}); return row?map(row):null; }
  async findByIdempotencyKey(key:string,actorUuid:string) { const row=await this.prisma.systemImportJob.findFirst({where:{idempotencyKey:key,actorUuid}}); return row?map(row):null; }
  async update(uuid:string,input:any) { return map(await this.prisma.systemImportJob.update({where:{uuid},data:input as never})); }
  async list(input:{actorUuid:string;page:number;limit:number;state?:ImportState}) { const where={actorUuid:input.actorUuid,...(input.state?{state:input.state}:{})}; const [items,total]=await Promise.all([this.prisma.systemImportJob.findMany({where,orderBy:{createdAt:'desc'},skip:(input.page-1)*input.limit,take:input.limit}),this.prisma.systemImportJob.count({where})]); return {items:items.map(map),total}; }
}
export { SYSTEM_IMPORT_REPOSITORY };
