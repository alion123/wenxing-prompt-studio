import {z} from 'zod';
import type {Question} from './studio.ts';
export const needsSuggestions=(q:Pick<Question,'options'>)=>new Set(q.options.map(o=>o.trim()).filter(o=>o&&!/不确定|不知道|问形.*(?:决定|建议)/.test(o))).size<2;
const suggestion=z.object({id:z.string().min(1).max(80),hint:z.string().max(500),options:z.array(z.string().min(1).max(1500).refine(s=>!!s.trim())).min(3).max(6).refine(options=>new Set(options.map(s=>s.trim())).size===options.length&&!needsSuggestions({options}))});
export const suggestionsSchema=z.object({suggestions:z.array(suggestion).min(1).max(4).refine(items=>new Set(items.map(s=>s.id)).size===items.length)});
export type Suggestion=z.infer<typeof suggestion>;
export function validateSuggestions(value:unknown,questions:Question[]):Suggestion[]{
  const {suggestions}=suggestionsSchema.parse(value);
  if(suggestions.length!==questions.length||suggestions.some(s=>!questions.some(q=>q.id===s.id)))throw Error('建议选项与原问题不匹配。');
  return suggestions;
}
