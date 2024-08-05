import { MutableRefObject } from "react";
export declare function classNames(...classes: (string | undefined | null | boolean)[]): string;
export declare function functionNameToDisplay(name: string): string;
export declare function convertToMarkdownTable(data: Record<string, any> | any[], caption?: string): string;
export declare function removeUUIDs(data: Record<string, any> | any[]): Record<string, any> | any[];
export declare function processObjectForDisplay(data: Record<string, any> | any[], fieldName?: string[]): Record<string, any> | any[];
export declare function addTrailingSlash(string: string): string;
export declare function scrollToBottom(scrollRef: MutableRefObject<HTMLDivElement>, behavior?: "smooth" | "instant" | "auto", force?: boolean, threshold?: number): void;
export declare function getRandomThree<Item>(array: Item[]): Item[];
