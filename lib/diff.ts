export type DiffChunk={type:'same'|'added'|'removed';text:string};
export function compareLines(left:string,right:string):{chunks:DiffChunk[];added:number;removed:number}{
  const a=left.match(/[^\n]*\n|[^\n]+$/g)??[],b=right.match(/[^\n]*\n|[^\n]+$/g)??[],chunks:DiffChunk[]=[];
  const push=(type:DiffChunk['type'],text:string)=>{if(!text)return;const last=chunks.at(-1);if(last?.type===type)last.text+=text;else chunks.push({type,text});};
  let prefix=0;while(prefix<a.length&&prefix<b.length&&a[prefix]===b[prefix])prefix++;
  let suffix=0;while(suffix<a.length-prefix&&suffix<b.length-prefix&&a[a.length-1-suffix]===b[b.length-1-suffix])suffix++;
  push('same',a.slice(0,prefix).join(''));
  const x=a.slice(prefix,a.length-suffix),y=b.slice(prefix,b.length-suffix);
  if((x.length+1)*(y.length+1)>300000){push('removed',x.join(''));push('added',y.join(''));}
  else {
    const width=y.length+1,table=new Uint16Array((x.length+1)*width);
    for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)table[i*width+j]=x[i]===y[j]?1+table[(i+1)*width+j+1]:Math.max(table[(i+1)*width+j],table[i*width+j+1]);
    let i=0,j=0;
    while(i<x.length||j<y.length){
      if(i<x.length&&j<y.length&&x[i]===y[j]){push('same',x[i++]);j++;}
      else if(i<x.length&&(j===y.length||table[(i+1)*width+j]>=table[i*width+j+1]))push('removed',x[i++]);
      else push('added',y[j++]);
    }
  }
  if(suffix)push('same',a.slice(a.length-suffix).join(''));
  const count=(type:DiffChunk['type'])=>chunks.filter(c=>c.type===type).reduce((n,c)=>n+Array.from(c.text).length,0);
  return {chunks,added:count('added'),removed:count('removed')};
}
