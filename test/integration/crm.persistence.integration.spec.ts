import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { UserManagementService } from '../../src/modules/users/application/services/user-management.service.js';
import { CrmService } from '../../src/modules/crm/application/crm.service.js';
import { randomUUID } from 'node:crypto';

const PASSWORD='Strong-Test-Password-123!';
let moduleRef:TestingModule; let prisma:PrismaService; let users:UserManagementService; let crm:CrmService; let actorUuid:string;

async function cleanupCrm():Promise<void>{
  await prisma.crmCommunication.deleteMany(); await prisma.crmActivity.deleteMany(); await prisma.crmInquiry.deleteMany(); await prisma.crmLeadDuplicate.deleteMany(); await prisma.crmLeadScore.deleteMany(); await prisma.crmLeadHistory.deleteMany(); await prisma.crmLeadAssignment.deleteMany(); await prisma.crmLeadNote.deleteMany(); await prisma.crmLeadTagLink.deleteMany(); await prisma.crmLead.deleteMany(); await prisma.crmLeadStatusTransition.deleteMany(); await prisma.crmLeadStatus.deleteMany(); await prisma.crmLeadCampaign.deleteMany(); await prisma.crmLeadSource.deleteMany(); await prisma.crmLeadType.deleteMany(); await prisma.crmLeadTag.deleteMany(); await prisma.crmContactRelationship.deleteMany(); await prisma.crmContactConsent.deleteMany(); await prisma.crmContactPreference.deleteMany(); await prisma.crmContactEmail.deleteMany(); await prisma.crmContactPhone.deleteMany(); await prisma.crmContactAddress.deleteMany(); await prisma.crmCommunicationTemplate.deleteMany(); await prisma.crmContact.deleteMany();
}

describe('CRM real persistence',()=>{
  beforeAll(async()=>{moduleRef=await Test.createTestingModule({imports:[AppModule]}).compile();await moduleRef.init();prisma=moduleRef.get(PrismaService);users=moduleRef.get(UserManagementService);crm=moduleRef.get(CrmService);const user=await users.create({email:`crm-it-${randomUUID()}@example.com`,status:'active'},{password:PASSWORD,confirmation:PASSWORD},{requestId:'crm-it-user'});actorUuid=user.uuid;});
  beforeEach(async()=>cleanupCrm());
  afterAll(async()=>{await cleanupCrm();await moduleRef.close();});

  it('persists contact children and lead lifecycle through application to MariaDB',async()=>{
    const actor={actorUuid,requestId:'crm-it'};
    const contact=await crm.createContact({firstName:'Ada',displayName:'Ada Lovelace'},actor) as {uuid:string};
    const email=await crm.child('email',contact.uuid,{type:'work',value:'Ada@Example.com',isPrimary:true},actor) as {uuid:string};
    expect(email.uuid).toMatch(/^[0-9a-f-]{36}$/i);
    await crm.childPrimary('email',contact.uuid,email.uuid,actor);
    const source=await prisma.crmLeadSource.create({data:{uuid:randomUUID(),code:`SRC-${randomUUID().slice(0,8)}`,name:'Website'}});
    const type=await prisma.crmLeadType.create({data:{uuid:randomUUID(),code:`TYPE-${randomUUID().slice(0,8)}`,name:'Property'}});
    const status=await prisma.crmLeadStatus.create({data:{uuid:randomUUID(),code:'NEW',name:'New',sortOrder:1}});
    const lead=await crm.createLead({contactUuid:contact.uuid,sourceUuid:source.uuid,typeUuid:type.uuid,statusUuid:status.uuid},actor) as {uuid:string};
    expect((await prisma.crmLead.findUniqueOrThrow({where:{uuid:lead.uuid}})).contactId).toBeDefined();
    await expect(crm.changeStatus(lead.uuid,status.uuid,actor)).resolves.toBeTruthy();
  });

  it('enforces relationship compound uniqueness and scoped child ownership',async()=>{
    const a=await crm.createContact({firstName:'A',displayName:'A'}, {actorUuid,requestId:'crm-it-a'}) as {uuid:string};
    const b=await crm.createContact({firstName:'B',displayName:'B'}, {actorUuid,requestId:'crm-it-b'}) as {uuid:string};
    const rel=await crm.relationship(a.uuid,b.uuid,{relationshipType:'COLLEAGUE'}, {actorUuid,requestId:'crm-it-rel'});
    expect(rel).toBeTruthy();
    await expect(crm.relationship(a.uuid,b.uuid,{relationshipType:'COLLEAGUE'}, {actorUuid,requestId:'crm-it-rel2'})).rejects.toThrow();
    const phone=await crm.child('phone',a.uuid,{type:'mobile',value:'+62 812-000-123',isPrimary:true},{actorUuid,requestId:'crm-it-phone'}) as {uuid:string};
    await expect(crm.childUpdate('phone',b.uuid,phone.uuid,{type:'home'},{actorUuid,requestId:'crm-it-scope'})).rejects.toThrow(/not found/i);
  });
});
