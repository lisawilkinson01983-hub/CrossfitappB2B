/** The forward-arrow used for every "share" action in the app — distinct from SendIcon, which is for posting a comment/message. */
export function ShareIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M14 5l7 7-7 7v-4.1c-4.3 0-7.7 1.7-10 5.1.7-5.8 4-11.6 10-12.9V5z" />
    </svg>
  );
}
