import * as React from "react";
import { GraphData, Json, SupportedGraphTypes } from "../lib/types";
export declare function Graph(props: GraphData & {
    small: boolean;
}): React.JSX.Element;
export declare const possibleXlabels: string[];
export declare const possibleYlabels: string[];
export declare function extractGraphData(data: Json, type: SupportedGraphTypes): GraphData | null;
export declare function findFirstArray(json: any, key?: string | number | null): {
    result: any[] | null;
    arrayKey: string | number | null;
};
export declare function checkStringMatch(fieldName: string, possibleLabels: string[]): boolean;
