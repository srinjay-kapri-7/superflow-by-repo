import * as React from "react";
import {
  ArrowPathIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  CheckCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import ChatItem from "./chatItems";
import {
  ChatItemType,
  ChatProps,
  StreamingStep,
  StreamingStepInput,
} from "../lib/types";
import { AutoGrowingTextArea } from "./autoGrowingTextarea";
import {
  addTrailingSlash,
  classNames,
  getRandomThree,
  scrollToBottom,
} from "../lib/utils";
import { LoadingSpinner } from "./loadingspinner";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { parseOutput } from "../lib/parser";
import FollowUpSuggestions from "./followUpSuggestions";
import useMessageCache from "../lib/useMessageCache";
import { MicrophoneIcon } from "@heroicons/react/24/solid";

export default function Chat(props: ChatProps) {
  const [userText, setUserText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Empty the chat and rerun the API call if loading stops when the last message is a loading message
  useEffect(() => {
    if (
      // Loading just stopped
      !loading &&
      // Kill switch hasn't been clicked
      !killSwitchClicked.current &&
      // Chat isn't empty
      devChatContents.length > 0 &&
      // Last message is a loading message
      devChatContents[devChatContents.length - 1].role === "loading"
    ) {
      setDevChatContents((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, an unexpected error has occurred.\n\nPlease click 'clear chat' (top right) and try again.",
        },
      ]);
    }
  }, [loading]);

  const [recordingAudio, setRecordingAudio] = useState<boolean>(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [audioCancelled, setAudioCancelled] = useState<boolean>(false);

  useEffect(() => {
    if (props.enableSpeech !== null && props.enableSpeech === false) return;
    if ("webkitSpeechRecognition" in window) {
      setRecognition(new (window as any).webkitSpeechRecognition() as any);
    }
  }, []);

  useEffect(() => {
    if (!recognition || recordingAudio) return;
    let finalTranscript = "";
    // If false, stops recording when it detects the end of speech
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = props.speechLanguage ?? "en";
    recognition.onstart = () => {
      finalTranscript = "";
    };

    recognition.onresult = (event: {
      results: SpeechRecognitionResultList;
      resultIndex: number;
    }) => {
      Array.from(event.results, (result, index) => {
        if (index >= event.resultIndex && result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        }
      });
    };
    recognition.onend = () => {
      if (!audioCancelled && finalTranscript.length > 0) {
        setUserText(finalTranscript);
      }
      setRecordingAudio(false);
      setAudioCancelled(false);
    };
    setRecognition(recognition);
  }, [recognition, audioCancelled]);

  useEffect(() => {
    // Start or stop recognition based on recordingAudio state
    if (recordingAudio) {
      recognition?.start();
    } else {
      recognition?.stop();
    }
  }, [recordingAudio, recognition]);

  // This is a hack to prevent the effect from running twice in development
  // It's because React strict mode runs in development in nextjs, which renders everything
  // twice to check for bugs/side effects (not sure if this is needed any more)
  const alreadyRunning = useRef(false);

  // TODO: Grab suggestions from DB if none are provided
  const [suggestions, setSuggestions] = useState<string[]>(
    props.suggestions ? props.suggestions.slice(0, 3) : [],
  );
  useEffect(() => {
    if (props.suggestions && props.suggestions.length > 0) {
      setSuggestions(getRandomThree(props.suggestions));
    }
  }, [props.suggestions]);

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [devChatContents, setDevChatContents] = useState<StreamingStepInput[]>(
    props.welcomeText
      ? [{ role: "assistant", content: props.welcomeText }]
      : [],
  );
  // Update welcome text if it changes
  useEffect(() => {
    if (props.welcomeText) {
      if (devChatContents.length === 0) {
        // No welcome text previously - add it
        setDevChatContents([{ role: "assistant", content: props.welcomeText }]);
      } else if (
        devChatContents.length === 1 &&
        devChatContents[0].role === "assistant"
      ) {
        // Just welcome text previously - replace
        setDevChatContents([{ role: "assistant", content: props.welcomeText }]);
      }
    } else {
      // Welcome text removed
      if (
        devChatContents.length === 1 &&
        devChatContents[0].role === "assistant"
      ) {
        setDevChatContents((prev) => prev.slice(1));
      }
    }
  }, [props.welcomeText]);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);

  const killSwitchClicked = useRef(false);
  const hostname = addTrailingSlash(
    props.superflowsUrl || "https://claraai.yactraq.com/",
  );

  const { clearMessageCache, updateDevChatContents, getMessagesFromCache } =
    useMessageCache(
      setConversationId,
      setDevChatContents,
      props.superflowsApiKey,
    );

  useEffect(() => {
    getMessagesFromCache();
    if (props.initialMessage) {
      callSuperflowsApi([
        ...devChatContents,
        { role: "user", content: props.initialMessage },
      ]);
    }
    scrollToBottom(scrollRef, "instant", true);
  }, []);

  const callSuperflowsApi = useCallback(
    async (chat: StreamingStepInput[]) => {
      // Below adds a message so the loading spinner comes up while we're waiting
      updateDevChatContents(conversationId, [
        ...chat,
        { role: "assistant", content: "" },
      ]);
      setFollowUpSuggestions([]);
      if (loading || alreadyRunning.current) return;
      alreadyRunning.current = true;
      setLoading(true);

      let firstTry = true,
        retry = false;
      let response, responseJson: { error: string };
      while (firstTry || retry) {
        firstTry = false;
        response = await fetch(new URL("api/v1/answers", hostname).href, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${props.superflowsApiKey}`,
          },
          body: JSON.stringify({
            user_input:
              chat[chat.length - 1].role === "user"
                ? chat[chat.length - 1].content
                : "",
            conversation_id: conversationId,
            user_api_key: props.userApiKey,
            user_description: props.userDescription,
            mock_api_responses: props.mockApiResponses ?? false,
            stream: true,
            api_params: props.apiParams,
            debug: props.debugMode,
            user_id: props.userId,
          }),
        });

        if (!response.ok) {
          if (response.status === 404) {
            responseJson = {
              error: `${response.status}: ${response.statusText}. Check the hostname used is correct ${response.url}`,
            };
          } else {
            try {
              responseJson = (await response.json()) as {
                error: string;
              };
            } catch (e) {
              responseJson = {
                error: `${response.status}: ${response.statusText}`,
              };
              // Only retry once when response is 500 with no body (rare Vercel edge function bug)
              retry =
                !retry && response.status === 500 && response.statusText === "";
            }
          }
        }
      }
      if (!response.ok) {
        console.error(responseJson.error);
        updateDevChatContents(null, [
          ...chat,
          {
            role: "assistant",
            content: responseJson.error,
          },
        ]);
        alreadyRunning.current = false;
        setLoading(false);
        return;
      }

      const data = response.body;
      if (!data) return;

      const reader = data.getReader();
      const decoder = new TextDecoder();
      const outputMessages = [
        { role: "assistant", content: "" },
      ] as ChatItemType[];
      let incompleteChunk = "";
      let localConversationId = conversationId;

      let done = false,
        value: Uint8Array;
      while (!done) {
        ({ value, done } = await reader.read());
        if (killSwitchClicked.current) {
          console.log("Kill switch clicked");
          await reader.cancel("Cancel clicked");
          setLoading(false);
          updateDevChatContents(localConversationId, [...chat]);
          alreadyRunning.current = false;
          setTimeout(() => {
            killSwitchClicked.current = false;
          }, 1000);
          return;
        }
        const chunkValue = incompleteChunk + decoder.decode(value);
        // One server-side chunk can be split across multiple client-side chunks,
        // so we catch errors thrown by JSON.parse() and append the next chunk
        try {
          // Can be multiple server-side chunks in one client-side chunk,
          // separated by "data: ". The .slice(6) removes the "data: " at
          // the start of the string
          chunkValue
            .slice(6)
            .split("data: ")
            .map((chunkOfChunk) => {
              if (chunkOfChunk.length === 0) return null;
              return JSON.parse(chunkOfChunk) as StreamingStep;
            })
            .filter(Boolean)
            .forEach((data) => {
              if (conversationId === null) {
                setConversationId(data.id);
                localConversationId = data.id;
              }
              if (
                // Different message role from the last message
                data.role !== outputMessages[outputMessages.length - 1]?.role ||
                // Not the assistant (e.g. function, debug etc where the entire contents of a message is 1 chunk)
                data.role !== "assistant" ||
                // Includes explicit new message tag
                data.content.includes("<<[NEW-MESSAGE]>>")
              ) {
                if (
                  data.role === "assistant" &&
                  data.content.includes("<<[NEW-MESSAGE]>>")
                )
                  data.content = data.content.replace("<<[NEW-MESSAGE]>>", "");
                // Add new message
                outputMessages.push({ ...data });
              } else {
                // Append message data to preceding message
                outputMessages[outputMessages.length - 1].content +=
                  data.content;
              }
              updateDevChatContents(localConversationId, [
                ...chat,
                ...outputMessages,
              ]);
            });
          incompleteChunk = "";
        } catch (e) {
          console.warn(
            "If there is a JSON parsing error below, this is likely caused by a very large API response that the AI won't be able to handle.\n\n" +
              "We suggest filtering the API response to only include the data you need by setting the 'Include all keys in responses' and " +
              "'Include these keys in response' fields at the bottom of the edit action modal at https://claraai.yactraq.com\n\n",
            e,
          );
          incompleteChunk = chunkValue;
        }
      }
      setLoading(false);
      alreadyRunning.current = false;

      // If not an assistant message (confirmation, error etc) don't give follow-up suggestions
      if (outputMessages[outputMessages.length - 1].role !== "assistant")
        return;

      // Get follow-up suggestions
      if (props.suggestions && props.suggestions.length > 5) {
        setFollowUpSuggestions(getRandomThree(props.suggestions));
        return;
      }
      if (localConversationId !== null) {
        const followUpResponse = await fetch(
          new URL("api/v1/follow-ups", hostname).href,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${props.superflowsApiKey}`,
            },
            body: JSON.stringify({
              conversation_id: localConversationId,
              user_description: props.userDescription,
            }),
          },
        );
        if (!followUpResponse.ok) {
          console.error(
            "Error getting follow-up suggestions",
            followUpResponse,
          );
          return;
        }
        const followUpJson = (await followUpResponse.json()) as {
          suggestions: string[];
        };
        if (!alreadyRunning.current) {
          setFollowUpSuggestions(followUpJson.suggestions);
        }
      }
    },
    [
      props.userApiKey,
      props.userDescription,
      props.mockApiResponses,
      loading,
      setLoading,
      devChatContents,
      updateDevChatContents,
      conversationId,
      setFollowUpSuggestions,
      killSwitchClicked.current,
      alreadyRunning.current,
    ],
  );
  const onConfirm = useCallback(
    async (confirm: boolean): Promise<void> => {
      setLoading(true);
      const response = await fetch(new URL("api/v1/confirm", hostname).href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${props.superflowsApiKey}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_api_key: props.userApiKey ?? "", // Need a fallback or zod fails
          confirm: confirm,
          mock_api_responses: props.mockApiResponses,
          api_params: props.apiParams,
        }),
      });

      const json = (await response.json()) as {
        outs: StreamingStepInput[];
        error: string;
      };
      if (response.status === 200) {
        const newChat = [...devChatContents, ...json.outs];
        updateDevChatContents(conversationId, newChat);
        if (confirm) {
          await callSuperflowsApi(newChat);
        }
      } else {
        // Handle errors here - add them to chat
        console.error(json.error);
        updateDevChatContents(conversationId, [
          ...devChatContents,
          {
            role: "error",
            content: json.error,
          },
        ]);
      }

      setLoading(false);
    },
    [
      devChatContents,
      updateDevChatContents,
      callSuperflowsApi,
      conversationId,
      setLoading,
      props.userApiKey,
      props.mockApiResponses,
    ],
  );

  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);
  const [feedbackButtonsVisible, setFeedbackButtonsVisible] =
    useState<boolean>(false);

  const [negativeFeedbackText, setNegativeFeedbackText] = useState<
    string | null
  >(null);

  const [showNegativeFeedbackTextbox, setShowNegativeFeedbackTextbox] =
    useState(false);

  useEffect(() => {
    setFeedbackButtonsVisible(shouldTriggerFeedback(devChatContents, loading));
  }, [devChatContents, loading]);

  const feedbackBody = {
    conversation_id: conversationId,
    conversation_length_at_feedback: devChatContents.filter(({ role }) =>
      ["function", "assistant", "user"].includes(role),
    ).length,
    feedback_positive: feedback === "yes",
    negative_feedback_text: negativeFeedbackText,
  };

  useEffect(() => {
    (async () => {
      if (feedback === null) return;
      await fetch(new URL("api/v1/feedback", hostname).href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${props.superflowsApiKey}`,
        },
        body: JSON.stringify(feedbackBody),
      });
      setTimeout(() => {
        setFeedbackButtonsVisible(false);
        setFeedback(null);
        setNegativeFeedbackText(null);
      }, 1000);
    })();
  }, [feedback]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    setWidth(containerRef.current.offsetWidth);
  }, [containerRef.current]);

  return (
    <div
      ref={containerRef}
      className="superflows-styling sf-flex sf-min-h-0 sf-h-full sf-w-full sf-flex-1 sf-flex-col"
    >
      <div
        ref={scrollRef}
        className={classNames(
          "sf-relative sf-overflow-y-auto sf-overflow-x-hidden sf-h-full sf-flex sf-flex-col sf-flex-1 sf-pb-4",
          loading ? "sf-scroll-auto" : "sf-scroll-smooth",
        )}
        id={"sf-scrollable-chat-contents"}
      >
        {/* Show clear chat button only when there is chat to clear */}
        {devChatContents.length > 0 && !loading && (
          <button
            className={
              "sf-z-30 sf-ml-auto sf-sticky sf-top-2 sf-right-2 sf-flex sf-flex-row sf-place-items-center sf-gap-x-1 sf-px-2 sf-py-1 sf-rounded-md sf-bg-white sf-border focus:sf-outline-none focus:sf-ring-2 focus:sf-ring-gray-500 sf-transition sf-border-gray-300 hover:sf-border-gray-400 sf-text-gray-500 hover:sf-text-gray-600"
            }
            onClick={() => {
              clearMessageCache();
              setDevChatContents([]);
              setConversationId(null);
              setShowNegativeFeedbackTextbox(false);
              setNegativeFeedbackText(null);
            }}
          >
            <ArrowPathIcon className="sf-h-4 sf-w-4" /> Clear chat
          </button>
        )}
        <div className="sf-mt-6 sf-flex-1 sf-px-1 sf-shrink-0 sf-flex sf-flex-col sf-justify-end">
          {devChatContents.map((chatItem: StreamingStepInput, idx: number) => {
            const chat = devChatContents.slice(0, idx);
            const lastUserIdx = chat.findLastIndex(
              (chat) => chat.role === "user",
            );
            const precedingFunctionMessagesWithUrls = chat
              .slice(lastUserIdx + 1)
              .filter(
                (chat) => chat.role === "function" && chat.urls,
              ) as Extract<StreamingStepInput, { role: "function" }>[];
            // Remove repeated urls
            const uniqueUrls = precedingFunctionMessagesWithUrls
              .map((m) => m.urls)
              .flat()
              .filter((url, idx, self) => self.indexOf(url) === idx);
            return (
              <ChatItem
                key={idx.toString()}
                chatItem={chatItem}
                AIname={props.AIname}
                // Below ensures that loading spinner is only shown on the message currently streaming in
                isLoading={loading && idx === devChatContents.length - 1}
                onConfirm={onConfirm}
                // If the function call is adjacent to other function calls we don't need to tell them it
                // was empty - otherwise we get a lot of empty messages clogging up the chat interface
                prevAndNextChatRoles={[
                  devChatContents[idx - 1]?.role,
                  devChatContents[idx + 1]?.role,
                ]}
                devMode={props.devMode}
                precedingUrls={
                  // If the message is the most recent or followed by a user message, we should show the url
                  [undefined, "user"].includes(devChatContents[idx + 1]?.role)
                    ? uniqueUrls
                    : []
                }
                width={width}
                showThoughts={props.showThoughts}
                showFunctionCalls={props.showFunctionCalls}
                scrollRef={scrollRef}
              />
            );
          })}
          {(devChatContents.length === 0 ||
            (devChatContents.length === 1 && props.welcomeText)) &&
            suggestions.length > 0 && (
              <div className="sf-py-4 sf-px-1.5">
                <h2
                  className={classNames(
                    "sf-ml-2 sf-font-medium sf-text-gray-900",
                    width > 640 ? "sf-text-base" : "sf-text-little",
                  )}
                >
                  Suggestions
                </h2>
                <div className="sf-mt-1 sf-flex sf-flex-col sf-gap-y-1 sf-place-items-baseline">
                  {suggestions.map((text) => (
                    <button
                      key={text}
                      className="sf-text-left sf-px-2 sf-py-1 sf-rounded-md sf-border sf-bg-white sf-text-little sf-text-gray-800 sf-shadow hover:sf-border-gray-400 sf-transition-all"
                      onClick={() => {
                        setUserText("");
                        void callSuperflowsApi([
                          ...devChatContents,
                          { role: "user", content: text.trim() },
                        ]);
                      }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          {devChatContents.length > 1 && followUpSuggestions.length > 0 && (
            <FollowUpSuggestions
              devChatContents={devChatContents}
              followUpSuggestions={followUpSuggestions}
              onClick={(text) => {
                setUserText("");
                void callSuperflowsApi([
                  ...devChatContents,
                  { role: "user", content: text.trim() },
                ]);
              }}
              scrollRef={scrollRef}
              width={width}
            />
          )}
        </div>
      </div>
      {/* Textbox user types into */}
      <div className="sf-flex sf-flex-col sf-relative">
        <AutoGrowingTextArea
          className={classNames(
            "sf-text-sm sf-resize-none sf-mx-1 sf-rounded sf-py-2 sf-px-4 sf-border-gray-300 sf-border sf-border-solid focus:sf-ring-1 focus:sf-outline-0 sf-text-black placeholder:sf-text-gray-400",
            userText.length > 300 ? "sf-overflow-auto-y" : "sf-overflow-hidden",
            props.styling?.buttonColor
              ? `focus:sf-border-gray-500 focus:sf-ring-gray-500`
              : "focus:sf-border-purple-300 focus:sf-ring-purple-300",
          )}
          placeholder={"Send a message"}
          value={userText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            if (userText === "") {
              setUserText(e.target.value.trim());
            } else {
              setUserText(e.target.value);
            }
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (
                userText &&
                !showNegativeFeedbackTextbox &&
                !loading &&
                !alreadyRunning.current
              ) {
                void callSuperflowsApi([
                  ...devChatContents,
                  { role: "user", content: userText },
                ]);
                setUserText("");
              }
            }
          }}
        />
        <div className="sf-flex sf-flex-shrink-0 sf-w-full sf-justify-between sf-px-1 sf-py-2 sf-place-items-center">
          <button
            className={classNames(
              "sf-flex sf-flex-row sf-gap-x-1 sf-place-items-center sf-ml-4 sf-justify-center sf-select-none focus:sf-outline-0 sf-rounded-md sf-px-3 sf-py-2 sf-text-sm sf-shadow-sm sf-border sf-h-10",
              loading
                ? "sf-text-gray-500 sf-bg-gray-100 hover:sf-bg-gray-200 sf-border-gray-300"
                : "sf-invisible",
            )}
            onClick={() => {
              killSwitchClicked.current = true;
              alreadyRunning.current = false;
              setLoading(false);
            }}
          >
            Cancel
          </button>
          <div className="sf-h-16 sf-relative">
            {feedbackButtonsVisible ? (
              <FeedbackButtons
                feedback={feedback}
                setFeedback={setFeedback}
                negativeFeedbackText={negativeFeedbackText}
                setNegativeFeedbackText={setNegativeFeedbackText}
                showNegativeTextbox={showNegativeFeedbackTextbox}
                setShowNegativeTextbox={setShowNegativeFeedbackTextbox}
              />
            ) : props.textBelowInput ? (
              <>
                <div className="sf-peer sf-text-xs sf-text-gray-500 sf-mx-1">
                  {(width < 600
                    ? props.textBelowInput.slice(0, 100)
                    : props.textBelowInput
                  )
                    .split(/(\[.*]\(\S*\))/)
                    .map((text, idx) => {
                      const markdownLinkMatch = text.match(/\[(.*)]\((\S*)\)/);
                      if (markdownLinkMatch) {
                        return (
                          <a
                            key={idx}
                            className="sf-text-blue-500 hover:sf-underline"
                            href={markdownLinkMatch[2]}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {markdownLinkMatch[1]}
                          </a>
                        );
                      }
                      return text;
                    })}
                  {width < 600 && props.textBelowInput.length > 100
                    ? "..."
                    : ""}
                </div>
                {width < 600 && props.textBelowInput.length > 100 ? (
                  <div className="popup sf--top-6 sf--left-2 sf-border sf-border-gray-200 sf-text-xs sf-text-gray-500">
                    {props.textBelowInput}
                  </div>
                ) : undefined}
              </>
            ) : undefined}
          </div>
          <div className={"sf-flex sf-flex-row sf-gap-x-2.5"}>
            {recognition && (
              <>
                {recordingAudio && (
                  <button
                    className={classNames(
                      "sf-py-1 sf-flex sf-items-center sf-justify-center sf-flex-col sf-text-2xs sf-text-gray-800",
                    )}
                    onClick={() => {
                      setAudioCancelled(true);
                      setRecordingAudio(false);
                    }}
                  >
                    <TrashIcon className="sf-h-5 sf-w-5" />
                    Cancel
                  </button>
                )}
                <button
                  className={classNames(
                    "sf-rounded-md active:sf-outline active:sf-outline-sky-600 sf-flex sf-items-center sf-bg-blue-500 hover:sf-bg-blue-400",
                    recordingAudio ? "sf-px-6" : "sf-px-6 sf-py-1",
                  )}
                  onClick={() => {
                    setRecordingAudio((recordingAudio) => !recordingAudio);
                  }}
                >
                  {!recordingAudio ? (
                    <MicrophoneIcon
                      className={classNames("sf-fill-white", "sf-h-6 sf-w-6")}
                    />
                  ) : (
                    <div className="sf-mt-1 sf-flex sf-space-y-1 sf-flex-col sf-justify-center sf-space-x-1 sf-py-0.5">
                      <RecordingDots />
                      <div className="sf-text-2xs sf-text-blue-100">
                        Tap to end recording
                      </div>
                    </div>
                  )}
                </button>
              </>
            )}
            <button
              ref={props.initialFocus}
              type="submit"
              className={classNames(
                "sf-flex sf-flex-row sf-gap-x-1 sf-h-10 sf-place-items-center sf-justify-center sf-select-none focus:sf-outline-0 sf-rounded-md sf-px-3 sf-py-2 sf-text-sm sf-font-semibold sf-text-white sf-shadow-sm",
                loading || !userText
                  ? "sf-bg-gray-500 sf-cursor-not-allowed"
                  : `hover:sf-opacity-90 focus:sf-outline focus:sf-outline-2 focus:sf-outline-offset-2 focus:sf-outline-sky-500`,
                !props.styling?.buttonColor &&
                  !(loading || !userText) &&
                  "sf-bg-purple-500",
                showNegativeFeedbackTextbox && "sf-invisible",
              )}
              onClick={() => {
                if (!loading && userText) {
                  void callSuperflowsApi([
                    ...devChatContents,
                    { role: "user", content: userText },
                  ]);
                  setUserText("");
                  killSwitchClicked.current = false;
                }
              }}
              style={
                props.styling?.buttonColor && !(loading || !userText)
                  ? { backgroundColor: props.styling?.buttonColor }
                  : {}
              }
            >
              {loading && <LoadingSpinner classes="sf-h-4 sf-w-4" />}
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function shouldTriggerFeedback(
  devChatContents: StreamingStepInput[],
  loading?: boolean,
): boolean {
  if (loading) return false;
  if (devChatContents.length === 0) return false;

  const sinceLastUserMessage = devChatContents.slice(
    devChatContents.findLastIndex((chat) => chat.role === "user"),
  );
  if (!sinceLastUserMessage.some((chat) => chat.role === "function"))
    return false;
  const lastMessage = sinceLastUserMessage[sinceLastUserMessage.length - 1];
  if (lastMessage.role !== "assistant") return false;
  const parsed = parseOutput(lastMessage.content);

  const lastFunctionMessage = sinceLastUserMessage
    .filter((chat) => chat.role === "function")
    .reverse()[0] as Exclude<StreamingStepInput, { role: "graph" }>;

  const lastFunctionMessageIsError = lastFunctionMessage
    ? functionMessageIsError(lastFunctionMessage.content)
    : false;

  return (
    lastMessage.role === "assistant" &&
    parsed.tellUser.length > 0 &&
    !lastFunctionMessageIsError
  );
}

function functionMessageIsError(messageContent: string): boolean {
  return (
    messageContent.includes("ERROR") ||
    // Below text is added on backend when a function returns an error
    messageContent.includes("The function returned a ") ||
    // Below is present when a 404 is returned from an API
    (messageContent.includes("404") &&
      messageContent.toLowerCase().includes("not found")) ||
    // If there's no response body, this is sent
    messageContent.includes("Action failed")
  );
}

function FeedbackButtons(props: {
  feedback: "yes" | "no" | null;
  setFeedback: (feedback: "yes" | "no" | null) => void;
  negativeFeedbackText: string | null;
  setNegativeFeedbackText: (text: string) => void;
  showNegativeTextbox: boolean;
  setShowNegativeTextbox: (show: boolean) => void;
}) {
  const [showThankYouMessage, setShowThankYouMessage] = useState(false);

  const handleNegativeFeedbackSubmission = () => {
    props.setFeedback("no");
    setShowThankYouMessage(true);
    props.setShowNegativeTextbox(false);
    setTimeout(() => setShowThankYouMessage(false), 5000);
  };

  return (
    <div className="sf-flex sf-flex-row">
      {!showThankYouMessage && !props.showNegativeTextbox ? (
        <div
          className={classNames(
            "sf-flex sf-flex-col sf-place-items-center sf-gap-y-1 sf-text-xs sm:sf-text-sm",
          )}
        >
          <div className="sf-flex sf-flex-row sf-gap-x-4 sf-px-2 sf-text-gray-900 sf-whitespace-nowrap">
            Was this response helpful?
          </div>
          <div className="sf-flex sf-flex-row sf-gap-x-2">
            <button
              onClick={() => props.setShowNegativeTextbox(true)}
              className={classNames(
                "sf-flex sf-flex-row sf-gap-x-1 sf-font-medium sf-place-items-center sf-text-gray-50 sf-px-4 sf-rounded-md sf-py-1.5 sf-text-xs sf-transition sf-bg-red-500 sf-ring-red-500",
              )}
            >
              <HandThumbDownIcon className="sf-h-5 sf-w-5 sm:sf-h-4" />
              No
            </button>
            <button
              onClick={() => {
                props.setFeedback("yes");
                setShowThankYouMessage(true);
                setTimeout(() => setShowThankYouMessage(false), 5000);
              }}
              className={classNames(
                "sf-flex sf-flex-row sf-gap-x-1 sf-font-medium sf-place-items-center sf-text-gray-50 sf-px-4 sf-rounded-md sf-py-1.5 sf-text-xs  sf-bg-green-500 sf-ring-green-500 ",
              )}
            >
              <HandThumbUpIcon className="sf-h-5 sf-w-5 sm:sf-h-4" />
              Yes
            </button>
          </div>
        </div>
      ) : props.showNegativeTextbox && !showThankYouMessage ? (
        <div
          className={classNames(
            "sf-align-center sf-flex sf-flex-row sf-my-auto",
            showThankYouMessage && "sf-hidden",
          )}
        >
          <div className="sf-relative">
            <input
              className={classNames(
                "sf-peer sf-pt-4 sf-pb-1 sf-h-10 sf-text-sm sf-resize-none sf-mx-1 sf-rounded sf-px-4 sf-border-gray-300 sf-border focus:sf-ring-1 focus:sf-outline-0 placeholder:sf-text-gray-400 focus:sf-border-purple-400 focus:sf-ring-purple-400",
              )}
              placeholder=""
              autoFocus={true}
              value={props.negativeFeedbackText ?? ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleNegativeFeedbackSubmission();
                }
              }}
              onChange={(e) => props.setNegativeFeedbackText(e.target.value)}
            />
            <div
              className={classNames(
                "sf-absolute sf-pointer-events-none sf-text-sm sf-text-gray-400 sf-left-4 sf-top-3 peer-focus:sf-scale-75 peer-focus:sf--translate-y-5/8 sf-select-none sf-transition sf-duration-300",
                props.negativeFeedbackText
                  ? "sf--translate-x-1/8 sf--translate-y-5/8 sf-scale-75"
                  : "peer-focus:sf--translate-x-1/8",
              )}
            >
              What went wrong?
            </div>
          </div>
          <button
            className="sf-h-10 sf-place-items-center sf-rounded-md sf-px-3 sf-my-auto sf-text-sm sf-font-semibold sf-text-white sf-shadow-sm hover:sf-bg-purple-600 sf-bg-purple-500"
            onClick={() => handleNegativeFeedbackSubmission()}
          >
            Done
          </button>
        </div>
      ) : (
        showThankYouMessage && (
          <div
            className={classNames(
              "sf-my-auto sf-flex sf-flex-row sf-whitespace-nowrap",
            )}
          >
            Thanks for your feedback!
            <CheckCircleIcon className="sf-h-5 sf-w-5 sf-ml-1 sf-mr-2 sf-text-green-500 sf-my-auto" />
          </div>
        )
      )}
    </div>
  );
}

const RecordingDots = () => (
  <div className="sf-flex sf-justify-center sf-items-center sf-space-x-1">
    {[...Array(3)].map((_, i) => (
      <span
        key={i}
        className={classNames(
          "sf-bg-white sf-rounded-full sf-w-2 sf-h-2 sf-animate-bounce",
          i === 0
            ? ""
            : i === 1
            ? "sf-animation-delay-02"
            : "sf-animation-delay-04",
        )}
      />
    ))}
  </div>
);
