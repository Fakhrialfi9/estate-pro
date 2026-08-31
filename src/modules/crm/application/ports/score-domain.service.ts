import { calculateScore, type ScoreInput, type ScoreRule } from '../../domain/crm.types.js';

export interface ScoreCalculation { readonly score:number; readonly factors:readonly {code:string;points:number;explanation:string}[]; }
export class ScoreDomainService { calculate(input:ScoreInput,rules:readonly ScoreRule[]):ScoreCalculation{return calculateScore(input,rules);} }
