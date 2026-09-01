CREATE TABLE sales_pipelines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_pipelines_uuid_key (uuid),
  KEY sales_pipelines_status_sort_order_idx (status, sort_order)
) ENGINE=InnoDB;

CREATE TABLE sales_pipeline_stages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  pipeline_uuid CHAR(36) NOT NULL,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  sort_order INT NOT NULL,
  probability INT NOT NULL DEFAULT 0,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_pipeline_stages_uuid_key (uuid),
  UNIQUE KEY sales_pipeline_stages_pipeline_code_key (pipeline_uuid, code),
  UNIQUE KEY sales_pipeline_stages_pipeline_order_key (pipeline_uuid, sort_order),
  KEY sales_pipeline_stages_pipeline_active_order_idx (pipeline_uuid, is_active, sort_order),
  CONSTRAINT sales_pipeline_stages_pipeline_fk FOREIGN KEY (pipeline_uuid) REFERENCES sales_pipelines (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

ALTER TABLE sales_opportunities
  ADD COLUMN team_uuid CHAR(36) NULL AFTER owner_user_uuid,
  ADD COLUMN pipeline_uuid CHAR(36) NULL AFTER team_uuid,
  ADD COLUMN stage_uuid CHAR(36) NULL AFTER pipeline_uuid,
  ADD COLUMN property_uuid CHAR(36) NULL AFTER stage_uuid,
  ADD COLUMN title VARCHAR(180) NOT NULL DEFAULT 'Sales Opportunity' AFTER property_uuid,
  ADD COLUMN value_amount DECIMAL(19,4) NULL AFTER title,
  ADD COLUMN currency CHAR(3) NULL AFTER value_amount,
  ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER currency,
  ADD KEY sales_opportunities_team_status_idx (team_uuid, status),
  ADD KEY sales_opportunities_pipeline_stage_status_idx (pipeline_uuid, stage_uuid, status),
  ADD KEY sales_opportunities_property_status_idx (property_uuid, status),
  ADD KEY sales_opportunities_created_at_idx (created_at),
  ADD CONSTRAINT sales_opportunities_pipeline_fk FOREIGN KEY (pipeline_uuid) REFERENCES sales_pipelines (uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT sales_opportunities_stage_fk FOREIGN KEY (stage_uuid) REFERENCES sales_pipeline_stages (uuid) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE sales_opportunity_stage_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  opportunity_uuid CHAR(36) NOT NULL,
  from_stage_uuid CHAR(36) NULL,
  to_stage_uuid CHAR(36) NULL,
  from_status VARCHAR(30) NULL,
  to_status VARCHAR(30) NOT NULL,
  actor_user_uuid CHAR(36) NOT NULL,
  reason VARCHAR(500) NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_opp_history_uuid_key (uuid),
  KEY sales_opp_history_opp_occurred_idx (opportunity_uuid, occurred_at),
  CONSTRAINT sales_opp_history_opp_fk FOREIGN KEY (opportunity_uuid) REFERENCES sales_opportunities (uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT sales_opp_history_from_stage_fk FOREIGN KEY (from_stage_uuid) REFERENCES sales_pipeline_stages (uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT sales_opp_history_to_stage_fk FOREIGN KEY (to_stage_uuid) REFERENCES sales_pipeline_stages (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  opportunity_uuid CHAR(36) NOT NULL,
  actor_user_uuid CHAR(36) NOT NULL,
  type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  subject VARCHAR(180) NOT NULL,
  body TEXT NULL,
  due_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_activities_uuid_key (uuid),
  KEY sales_activities_opp_status_due_idx (opportunity_uuid, status, due_at),
  KEY sales_activities_actor_due_idx (actor_user_uuid, due_at),
  CONSTRAINT sales_activities_opp_fk FOREIGN KEY (opportunity_uuid) REFERENCES sales_opportunities (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_viewings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  opportunity_uuid CHAR(36) NOT NULL,
  property_uuid CHAR(36) NOT NULL,
  contact_uuid CHAR(36) NOT NULL,
  scheduled_at DATETIME(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
  notes TEXT NULL,
  actor_user_uuid CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_viewings_uuid_key (uuid),
  KEY sales_viewings_opp_schedule_idx (opportunity_uuid, scheduled_at),
  KEY sales_viewings_property_schedule_idx (property_uuid, scheduled_at, status),
  CONSTRAINT sales_viewings_opp_fk FOREIGN KEY (opportunity_uuid) REFERENCES sales_opportunities (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_negotiations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  opportunity_uuid CHAR(36) NOT NULL,
  opened_by_uuid CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  notes TEXT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_negotiations_uuid_key (uuid),
  KEY sales_negotiations_opp_status_idx (opportunity_uuid, status),
  CONSTRAINT sales_negotiations_opp_fk FOREIGN KEY (opportunity_uuid) REFERENCES sales_opportunities (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_negotiation_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  negotiation_uuid CHAR(36) NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NOT NULL,
  actor_user_uuid CHAR(36) NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_negotiation_history_uuid_key (uuid),
  KEY sales_negotiation_history_negotiation_occurred_idx (negotiation_uuid, occurred_at),
  CONSTRAINT sales_negotiation_history_negotiation_fk FOREIGN KEY (negotiation_uuid) REFERENCES sales_negotiations (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  negotiation_uuid CHAR(36) NOT NULL,
  version INT NOT NULL,
  amount DECIMAL(19,4) NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  expires_at DATETIME(3) NULL,
  actor_user_uuid CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_offers_uuid_key (uuid),
  UNIQUE KEY sales_offers_negotiation_version_key (negotiation_uuid, version),
  KEY sales_offers_negotiation_status_version_idx (negotiation_uuid, status, version),
  CONSTRAINT sales_offers_negotiation_fk FOREIGN KEY (negotiation_uuid) REFERENCES sales_negotiations (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_deals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  opportunity_uuid CHAR(36) NOT NULL,
  offer_uuid CHAR(36) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  owner_user_uuid CHAR(36) NULL,
  currency CHAR(3) NULL,
  total_amount DECIMAL(19,4) NULL,
  version INT NOT NULL DEFAULT 1,
  idempotency_key VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_deals_uuid_key (uuid),
  UNIQUE KEY sales_deals_opportunity_key (opportunity_uuid),
  UNIQUE KEY sales_deals_idempotency_key (idempotency_key),
  KEY sales_deals_owner_status_created_idx (owner_user_uuid, status, created_at),
  KEY sales_deals_offer_idx (offer_uuid),
  CONSTRAINT sales_deals_opportunity_fk FOREIGN KEY (opportunity_uuid) REFERENCES sales_opportunities (uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT sales_deals_offer_fk FOREIGN KEY (offer_uuid) REFERENCES sales_offers (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_deal_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  deal_uuid CHAR(36) NOT NULL,
  property_uuid CHAR(36) NULL,
  description VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_amount DECIMAL(19,4) NOT NULL,
  line_amount DECIMAL(19,4) NOT NULL,
  currency CHAR(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_deal_items_uuid_key (uuid),
  KEY sales_deal_items_deal_idx (deal_uuid),
  CONSTRAINT sales_deal_items_deal_fk FOREIGN KEY (deal_uuid) REFERENCES sales_deals (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_closings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  deal_uuid CHAR(36) NOT NULL,
  method VARCHAR(40) NOT NULL,
  closed_at DATETIME(3) NOT NULL,
  actor_user_uuid CHAR(36) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_closings_uuid_key (uuid),
  UNIQUE KEY sales_closings_deal_key (deal_uuid),
  UNIQUE KEY sales_closings_idempotency_key (idempotency_key),
  CONSTRAINT sales_closings_deal_fk FOREIGN KEY (deal_uuid) REFERENCES sales_deals (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sales_lost_reasons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_lost_reasons_uuid_key (uuid),
  UNIQUE KEY sales_lost_reasons_code_key (code),
  KEY sales_lost_reasons_active_idx (is_active)
) ENGINE=InnoDB;

CREATE TABLE sales_commission_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(180) NOT NULL,
  rate_percent DECIMAL(7,4) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY sales_commission_rules_uuid_key (uuid),
  UNIQUE KEY sales_commission_rules_code_key (code),
  KEY sales_commission_rules_active_idx (is_active)
) ENGINE=InnoDB;

CREATE TABLE sales_commissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL,
  deal_uuid CHAR(36) NOT NULL,
  rule_uuid CHAR(36) NOT NULL,
  base_amount DECIMAL(19,4) NOT NULL,
  rate_percent DECIMAL(7,4) NOT NULL,
  amount DECIMAL(19,4) NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  calculated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  approved_at DATETIME(3) NULL,
  settled_at DATETIME(3) NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sales_commissions_uuid_key (uuid),
  UNIQUE KEY sales_commissions_deal_key (deal_uuid),
  UNIQUE KEY sales_commissions_idempotency_key (idempotency_key),
  KEY sales_commissions_status_calculated_idx (status, calculated_at),
  CONSTRAINT sales_commissions_deal_fk FOREIGN KEY (deal_uuid) REFERENCES sales_deals (uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT sales_commissions_rule_fk FOREIGN KEY (rule_uuid) REFERENCES sales_commission_rules (uuid) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
