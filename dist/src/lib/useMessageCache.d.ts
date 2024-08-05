import { StreamingStepInput } from "./types";
import React from "react";
export default function useMessageCache(setConversationId: React.Dispatch<React.SetStateAction<number>>, setDevChatContents: React.Dispatch<React.SetStateAction<StreamingStepInput[]>>, superflowsApiKey: string): {
    clearMessageCache: () => void;
    updateDevChatContents: (conversationId: number | null, messages: StreamingStepInput[]) => void;
    getMessagesFromCache: () => void;
};
