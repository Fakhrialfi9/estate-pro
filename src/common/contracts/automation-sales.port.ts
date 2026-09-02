export interface AutomationOpportunityContext {
  readonly uuid: string;
  readonly leadUuid?: string | null;
  readonly contactUuid?: string | null;
  readonly ownerUserUuid?: string | null;
  readonly teamUuid?: string | null;
  readonly pipelineUuid?: string | null;
  readonly stageUuid?: string | null;
  readonly status?: string | null;
  readonly title?: string | null;
  readonly valueAmount?: string | null;
  readonly currency?: string | null;
  readonly version?: number | null;
}

export interface AutomationSalesPort {
  getOpportunity(uuid: string): Promise<AutomationOpportunityContext>;
  listOpenOpportunities(
    entityUuid?: string,
  ): Promise<readonly AutomationOpportunityContext[]>;
}

export const SALES_AUTOMATION_PORT = Symbol('SALES_AUTOMATION_PORT');
