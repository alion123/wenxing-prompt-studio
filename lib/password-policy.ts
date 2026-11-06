// Matches the Supabase "lowercase, uppercase letters, digits and symbols" preset.
export const PASSWORD_RULE='至少8位，包含大写字母、小写字母、数字和特殊符号（如 ! @ # _）';
const symbols="!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";
export function passwordChecks(password:string){
 return [
  {label:'至少8位',ok:password.length>=8},
  {label:'大写字母 A–Z',ok:/[A-Z]/.test(password)},
  {label:'小写字母 a–z',ok:/[a-z]/.test(password)},
  {label:'数字 0–9',ok:/[0-9]/.test(password)},
  {label:'特殊符号，如 ! @ # _',ok:[...password].some(c=>symbols.includes(c))},
 ];
}
export function newPasswordError(password:string):string{
 return passwordChecks(password).every(x=>x.ok)?'':`密码需${PASSWORD_RULE}。`;
}
