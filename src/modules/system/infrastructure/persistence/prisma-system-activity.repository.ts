import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import type { SystemActivityRecord } from '../../domain/system.types.js';

const toRecord=(row:any):SystemActivityRecord=>({uuid:row.uuid,actorUuid:row.actorUuid,eventType:row.eventType,category:row.category,resourceType:row.resourceType,resourceUuid:row.resourceUuid,summary:row.summary,metadata:row.metadata&&typeof row.metadata==='object'&&!Array.isArray(row.metadata)?row.metadata as Record<string,unknown>:{},requestId:row.requestId,createdAt:row.createdAt});
@Injectable()
export class PrismaSystemActivityRepository implements SystemActivityRepository {
  constructor(private readonly prisma:PrismaService){}
  async append(input:any){const row=await this.prisma.systemActivity.create({data:{uuid:input.uuid,actorUuid:input.actorUuid,eventType:input.eventType,category:input.category,resourceType:input.resourceType,resourceUuid:input.resourceUuid,summary:input.summary.normalize('NFKC').replace(/[\p{Cc}]/gu,'').trim().slice(0,500),metadata:input.metadata as Prisma.InputJsonValue,requestId:input.requestId,...(input.createdAt?{createdAt:input.createdAt}:{})}});return toRecord(row);}
  async get(uuid:string){const row=await this.prisma.systemActivity.findUnique({where:{uuid}});return row?toRecord(row):null;}
  async list(input:any){const where={...(input.actorUuid?{actorUuid:input.actorUuid}:{}),...(input.eventType?{eventType:input.eventType}:{}),...(input.category?{category:input.category}:{}),...(input.resourceType?{resourceType:input.resourceType}:{}),...(input.resourceUuid?{resourceUuid:input.resourceUuid}:{})};const [items,total]=await Promise.all([this.prisma.systemActivity.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(input.page-1)*input.limit,take:input.limit}),this.prisma.systemActivity.count({where})]);return{items:items.map(toRecord),total};}
}
