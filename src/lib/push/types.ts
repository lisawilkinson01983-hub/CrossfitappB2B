export type PushMessage = {
  title: string;
  body: string;
  /** In-app path to open when the notification is tapped, e.g. "/posts/abc". */
  url: string;
  /** Groups related notifications together on the lock screen (e.g. one conversation). */
  threadId?: string;
};

export type SendResult = {
  token: string;
  ok: boolean;
  /** Apple/Google say this token will never work again — forget the device. */
  tokenInvalid?: boolean;
  error?: string;
};
