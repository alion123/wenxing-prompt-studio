import type { Project } from './studio.ts';
import { z } from 'zod';
import {referencesSchema} from './references.ts';
const str = z.string();
const question = z.object({ id: str, text: str, hint: str, options: z.array(str) });
const requirement=z.object({id:str,text:str,status:z.enum(['confirmed','proposed','rejected']),source:z.enum(['user','model','legacy']),sourceDetail:str,scope:z.enum(['project','character','shot']),kind:z.enum(['requirement','assumption']),createdAt:str,updatedAt:str,sourceRoundId:str.optional(),previousText:str.optional(),replacesId:str.optional(),supersededBy:str.optional()});
const round=z.object({id:str,versionId:str,createdAt:str,goal:str,mode:z.enum(['beginner','advanced']),feedback:str,omissions:str,answers:z.array(z.object({questionId:str,question:str,answer:str,hint:str.optional(),options:z.array(str).optional()}))});
const report=z.object({kind:z.enum(['automatic','ai']),createdAt:str,prompt:str,requirementsKey:str,summary:str,versionId:str.optional(),checks:z.array(z.object({label:str,evidence:str})),findings:z.array(z.object({severity:z.enum(['issue','suggestion']),title:str,reason:str,evidenceQuote:str,suggestion:str}))});
const update=z.object({id:str,quote:str,source:z.enum(['feedback','omissions','answer']),questionId:str.optional()});
const version = z.object({ id: str, createdAt: str, label: str.optional(), prompt: str, summary: str,
  assumptions: z.array(str), conflicts: z.array(str), constraints: z.array(str),generatedPrompt:str.optional(),parentVersionId:str.optional(),sourceVersionId:str.optional(),roundId:str.optional(),roundIds:z.array(str).optional(),requirementsSnapshot:z.array(requirement).optional(),qualityReport:report.optional(),assessment:report.optional(),requirementUpdates:z.array(update).optional() });
const project = z.object({ id: str, type: z.enum(['code', 'image', 'video', 'copy', 'custom']), mode: z.enum(['beginner', 'advanced']),
  goal: str, createdAt: str, updatedAt: str, pendingRefinement:z.boolean().optional(), references:referencesSchema.optional(), status: z.enum(['draft', 'completed']), stage: z.enum(['setup', 'questions', 'preview', 'refine']),
  questions: z.array(question), answers: z.record(str), feedback: str, omissions: str, draft: str, versions: z.array(version),requirements:z.array(requirement).default([]),rounds:z.array(round).default([]),assessment:report.optional() });
const workspace = z.object({ projects: z.array(project), active: str });
export {question as questionSchema,report as qualityReportSchema};
export function parseWorkspace(raw: string | null): { projects: Project[]; active: string } | null {
  return raw === null ? null : workspace.parse(JSON.parse(raw));
}
