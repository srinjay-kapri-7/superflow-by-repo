import * as React from "react";
export declare function AutoGrowingTextArea(props: {
    className: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    minHeight?: number;
    maxHeight?: number;
    onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
}): React.JSX.Element;
