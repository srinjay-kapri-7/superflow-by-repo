import { StreamingStepInput } from "../lib/types";
import React from "react";
export default function FollowUpSuggestions(props: {
    devChatContents: StreamingStepInput[];
    followUpSuggestions: string[];
    onClick: (text: string) => void;
    scrollRef: React.RefObject<HTMLDivElement>;
    width: number;
}): React.JSX.Element;
