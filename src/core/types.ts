export type EntityJurisdiction =
  | 'uae_mainland'
  | 'non_financial_freezone'
  | 'difc_adgm_financial_fz'
  | 'wholly_government_owned'
  | 'listed_company_or_subsidiary';

export type OwnershipStructureKind =
  | 'direct_simple'
  | 'multi_layer_holding'
  | 'complex_cross_border'
  | 'widely_held_no_25pct';

export type UboDeterminationTier =
  | 'tier1_ownership_25pct'
  | 'tier2_control_other_means'
  | 'tier3_senior_management'
  | 'exempt_entity'
  | 'unresolved';

export type PenaltyStageCode =
  | 'compliant_no_penalty'
  | 'exempt_out_of_scope'
  | 'tier1_written_warning'
  | 'tier2_monetary_fine'
  | 'tier3_cap_and_license_suspension';

export type UboControlId =
  | 'UBO-CTRL-01'
  | 'UBO-CTRL-02'
  | 'UBO-CTRL-03'
  | 'UBO-CTRL-04'
  | 'UBO-CTRL-05'
  | 'UBO-CTRL-06'
  | 'UBO-CTRL-07';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export type ReadinessStatus = 'ready' | 'conditional' | 'blocked';

export interface UboControlSpec {
  id: UboControlId;
  weight: number;
  severity: SeverityLevel;
  legalRef: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
}

export interface AssessmentInput {
  entityName: string;
  authorizedContactEmiratesId?: string;
  jurisdiction: EntityJurisdiction;
  structureKind: OwnershipStructureKind;
  ownershipLayersCount: number;
  directOwnershipPct: number;
  intermediateLayer1Pct: number;
  intermediateLayer2Pct: number;
  otherVotingOrControlRights: boolean;
  seniorManagementFallbackNamed: boolean;
  rboAndPartnersRegistersMaintained: boolean;
  chainLookthroughVerified: boolean;
  daysSinceUboChangeOrIncorporation: number;
  registrarUpdatedWithin15Days: boolean;
  hasNomineeArrangements: boolean;
  nomineeRegisterMaintained: boolean;
  nomineeDisclosedWithin15Days: boolean;
  fiveYearRetentionCommitted: boolean;
  scopeAndExemptionVerified: boolean;
  authorizedResidentContactAppointed: boolean;
  priorOffenseCount: number;
  chainCsv?: string;
  notes?: string;
}

export interface UboObligationEvaluation {
  regulatoryAuthorityAr: string;
  regulatoryAuthorityEn: string;
  isSubjectToCr109: boolean;
  effectiveIndirectPct: number;
  totalEffectiveOwnershipPct: number;
  meets25PctUboThreshold: boolean;
  complexStructureScrutiny: boolean;
  determinationTier: UboDeterminationTier;
  statutoryUpdateNoticeDays: number;
  statutoryInitialWindowDays: number;
  statutoryNomineeDisclosureDays: number;
  statutoryRetentionYears: number;
  authorizedContactEidValid: boolean | null;
  registersMissingGap: boolean;
  chainOrUboResolutionGap: boolean;
  updateNoticeSlaGap: boolean;
  nomineeDisclosureGap: boolean;
  fiveYearRetentionGap: boolean;
  scopeExemptionGap: boolean;
  residentContactOrEidGap: boolean;
  penaltyStageCode: PenaltyStageCode;
  projectedMinimumFineAed: number;
  projectedMaximumFineAed: number;
  licenseSuspensionRisk: boolean;
  rectificationGraceDays: number;
}

export interface FindingItem {
  controlId: UboControlId;
  severity: SeverityLevel;
  passed: boolean;
  legalRef: string;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  remediationAr: string;
  remediationEn: string;
}

export interface ChainLayerRowAudit {
  rowNumber: number;
  entityId: string;
  holderOrLayerEn: string;
  jurisdiction: string;
  directPct: number;
  layer1Pct: number;
  layer2Pct: number;
  effectivePct: number;
  qualifies25PctUbo: boolean;
  daysSinceChange: number;
  nomineeDisclosed: boolean;
  uboRegistered: boolean;
  reportedEmiratesId: string;
  emiratesIdValid: boolean | null;
  lineIssues: string[];
  estimatedExposureMinAed: number;
  estimatedExposureMaxAed: number;
  status: 'compliant' | 'attention' | 'violation';
}

export interface ChainCsvAuditSummary {
  totalRows: number;
  compliantRows: number;
  attentionRows: number;
  violationRows: number;
  qualifying25PctRows: number;
  lateUpdateOver15DaysRows: number;
  unverifiedNomineeOrUnregisteredRows: number;
  totalEstimatedExposureMinAed: number;
  totalEstimatedExposureMaxAed: number;
  formulaInjectionSanitizedCount: number;
  rows: ChainLayerRowAudit[];
}

export interface AssessmentResult {
  toolVersion: string;
  evaluatedAt: string;
  readinessScore: number;
  readinessStatus: ReadinessStatus;
  obligations: UboObligationEvaluation;
  controls: FindingItem[];
  blockersCount: number;
  highRisksCount: number;
  csvAudit: ChainCsvAuditSummary | null;
  canonicalDossierText?: string;
  dossierSha256?: string;
  legalDisclaimerAr: string;
  legalDisclaimerEn: string;
}

export interface UboPreset {
  id: string;
  labelAr: string;
  labelEn: string;
  summaryAr: string;
  summaryEn: string;
  input: AssessmentInput;
  sampleCsv: string;
}
