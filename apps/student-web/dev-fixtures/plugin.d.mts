/** 开发期假接口的类型声明（实现在 plugin.mjs，只在 STUDENT_FX=1 的 dev server 里加载）。 */
import type { Plugin } from 'vite';
export declare function fixturePlugin(): Plugin;
