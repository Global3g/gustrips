export interface ChatToolCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'tool';
  readonly content: string;
  /** Only set for role='tool' — name of the tool that produced this result. */
  readonly toolName?: string;
  /** Set on assistant messages that requested tool calls (so we can echo
   *  the function-call back to Gemini in subsequent turns). */
  readonly toolCalls?: ReadonlyArray<ChatToolCall>;
}

export interface QuickAction {
  readonly label: string;
  readonly prompt: string;
}
