export interface FunctionCall {
    name: string;
    args: {
        [key: string]: any;
    };
}
export interface ParsedOutput {
    reasoning: string;
    plan: string;
    tellUser: string;
    commands: FunctionCall[];
    completed: boolean;
}
export declare function parseOutput(gptString: string): ParsedOutput;
export declare function getLastSectionName(gptString: string): string;
export declare function parseFunctionCall(text: string): FunctionCall;
export declare function extractObjText(matchText: string, argsText: string): string;
export declare function makeDoubleExternalQuotes(text: string): string;
