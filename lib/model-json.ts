// Some providers return finish_reason=stop with fully emitted values but omit the
// final container delimiter. Only close matching containers; never invent data.
export function parseModelJSON(content: string): unknown {
  try { return JSON.parse(content); }
  catch (original) {
    const stack: string[] = []; let quoted = false; let escaped = false;
    if (!content.trimStart().startsWith('{')) throw original;
    for (const c of content) {
      if (quoted) {
        if (escaped) escaped=false;
        else if (c === '\\') escaped=true;
        else if (c === '"') quoted=false;
      } else if (c === '"') quoted=true;
      else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
      else if (c === '}' || c === ']') { if (stack.pop() !== c) throw original; }
    }
    if (quoted || stack.length === 0 || stack.length > 3 || !/[}\]]\s*$/.test(content)) throw original;
    return JSON.parse(content + stack.reverse().join(''));
  }
}
