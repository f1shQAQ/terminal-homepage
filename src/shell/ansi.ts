// 只用 ANSI 调色板里的颜色，主题切换时输出会跟着变
export const paint = (code: string, text: string) => `\x1b[${code}m${text}\x1b[0m`;

export const bold = (s: string) => paint('1', s);
export const dim = (s: string) => paint('2', s);
export const red = (s: string) => paint('31', s);
export const green = (s: string) => paint('32', s);
export const yellow = (s: string) => paint('33', s);
export const blue = (s: string) => paint('34', s);
export const magenta = (s: string) => paint('35', s);
export const cyan = (s: string) => paint('36', s);

export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
