import React from "react";
import { AssistantMessage, GraphMessage, StreamingStepInput, UserMessage } from "../lib/types";
export interface FunctionCall {
    name: string;
    args: {
        [key: string]: any;
    };
}
export interface ToConfirm extends FunctionCall {
    actionId: number;
}
type ChatItemRole = Pick<StreamingStepInput, "role">["role"];
export default function ChatItem(props: {
    chatItem: StreamingStepInput;
    devMode: boolean;
    AIname?: string;
    onConfirm?: (confirm: boolean) => Promise<void>;
    isLoading?: boolean;
    prevAndNextChatRoles?: (ChatItemRole | undefined)[];
    precedingUrls?: {
        name: string;
        url: string;
    }[];
    showThoughts?: boolean;
    showFunctionCalls?: boolean;
    width: number;
    scrollRef: React.MutableRefObject<HTMLDivElement | null>;
}): React.JSX.Element;
export declare function UserChatItem(props: {
    chatItem: UserMessage;
    prevAndNextChatRoles?: ChatItemRole[];
    width: number;
}): React.JSX.Element;
export declare function PlainTextChatItem(props: {
    chatItem: StreamingStepInput;
    AIname?: string;
    onConfirm?: (confirm: boolean) => Promise<void>;
}): React.JSX.Element;
export declare function FunctionVizChatItem(props: {
    chatItem: Extract<StreamingStepInput, {
        role: "function";
    }>;
    prevAndNextChatRoles?: ChatItemRole[];
    width: number;
}): React.JSX.Element;
export declare function GraphVizChatItem(props: {
    chatItem: GraphMessage;
    prevAndNextChatRoles?: ChatItemRole[];
    width: number;
}): React.JSX.Element;
export declare function ConfirmationChatItem(props: {
    chatItem: StreamingStepInput;
    onConfirm?: (confirm: boolean) => Promise<void>;
}): React.JSX.Element;
export declare function AssistantChatItem(props: {
    chatItem: AssistantMessage;
    AIname?: string;
    isLoading?: boolean;
    prevAndNextChatRoles?: ChatItemRole[];
    precedingUrls?: {
        name: string;
        url: string;
    }[];
    showThoughts?: boolean;
    width: number;
}): React.JSX.Element;
export declare function Tabs(props: {
    tabOpen: "table" | "graph";
    setTabOpen: (tab: "table" | "graph") => void;
    small?: boolean;
}): React.JSX.Element;
export {};
