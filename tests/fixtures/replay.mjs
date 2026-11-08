// Replays recorded exchanges in place of fetch.
import fs from 'node:fs';

const dir=new URL('.',import.meta.url);
export const key=(url,body)=>JSON.stringify([url,body??null]);
export function replay() {
  const {index}=JSON.parse(fs.readFileSync(new URL('index.json',dir),'utf8'));
  return async(url,o={})=>{
    const file=index[key(url,o.body)];
    if(!file)throw Error(`No recorded response for ${url} ${o.body??''}`);
    return new Response(fs.readFileSync(new URL(file,dir),'utf8'));
  };
}
