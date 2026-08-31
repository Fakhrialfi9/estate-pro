import { describe, expect, it } from 'vitest';
import { ContactEntity } from '../../src/modules/crm/domain/entities/contact.entity.js';
import { LeadEntity, type LeadProps } from '../../src/modules/crm/domain/entities/lead.entity.js';
import { canTransition } from '../../src/modules/crm/domain/lifecycle.policy.js';
import { DuplicateDetector } from '../../src/modules/crm/application/ports/duplicate-detector.js';
import { LeadMergePolicy } from '../../src/modules/crm/application/ports/merge.policy.js';

const now=new Date('2026-09-01T00:00:00.000Z');
const baseLead:LeadProps={uuid:'11111111-1111-4111-8111-111111111111',code:'L-1',contactUuid:'22222222-2222-4222-8222-222222222222',sourceUuid:'33333333-3333-4333-8333-333333333333',typeUuid:'44444444-4444-4444-8444-444444444444',campaignUuid:null,status:'NEW',ownerUserUuid:null,score:0,scoreVersion:1,archivedAt:null,createdAt:now,updatedAt:now};

describe('CRM domain boundaries',()=>{
  it('keeps Contact aggregate invariants out of persistence',()=>{const c=ContactEntity.create({uuid:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',firstName:'Ada',lastName:null,displayName:'Ada',companyName:null,jobTitle:null,status:'ACTIVE',ownerUserUuid:null,source:null,archivedAt:null,createdAt:now,updatedAt:now});expect(c.archive(now).status).toBe('ARCHIVED');expect(()=>c.archive(now).update({displayName:'blocked'},now)).toThrow('Archived contact cannot be mutated');});
  it('enforces Lead lifecycle and score version invariants',()=>{const lead=LeadEntity.create(baseLead);expect(lead.transitionTo('CONTACTED',canTransition,now).status).toBe('CONTACTED');expect(()=>lead.transitionTo('CLOSED_WON',canTransition,now)).toThrow(/Invalid lead status transition/);expect(lead.withScore(25,now).scoreVersion).toBe(2);});
  it('detects duplicates without merging them',()=>{const d=new DuplicateDetector();const matches=d.detect({leadUuid:baseLead.uuid,email:'A@example.com',phone:'+62 812-000',displayName:'Ada'},[{leadUuid:'55555555-5555-4555-8555-555555555555',email:'a@example.com',displayName:'Different'}]);expect(matches).toHaveLength(1);expect(matches[0]?.signals).toContain('EMAIL');});
  it('requires explicit merge authorization and preserves target precedence',()=>{const p=new LeadMergePolicy();expect(()=>p.assertAllowed(baseLead.uuid,'55555555-5555-4555-8555-555555555555',false)).toThrow(/permission/);expect(p.merge({firstName:'Ada',companyName:'Estate'},{firstName:'Ada',companyName:null}).companyName).toBe('Estate');});
});
