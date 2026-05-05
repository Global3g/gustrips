export interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface QuickAction {
  readonly label: string;
  readonly prompt: string;
}
