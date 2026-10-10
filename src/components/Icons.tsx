type P = { className?: string };
const base = (className: string, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const ShieldIcon = ({ className = "h-4 w-4 shrink-0 text-emerald-600" }: P) =>
  base(className, (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ));
export const CalendarIcon = ({ className = "h-5 w-5" }: P) =>
  base(className, (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ));
export const PinIcon = ({ className = "h-5 w-5" }: P) =>
  base(className, (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ));
export const MailIcon = ({ className = "h-5 w-5" }: P) =>
  base(className, (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ));
export const RefundIcon = ({ className = "h-5 w-5" }: P) =>
  base(className, (
    <>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" />
      <path d="M3 3v5h5" />
    </>
  ));
export const IdIcon = ({ className = "h-5 w-5" }: P) =>
  base(className, (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2" />
      <path d="M14 10h4M14 14h4" />
    </>
  ));
export const PhoneIcon = ({ className = "h-4 w-4" }: P) =>
  base(className, <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />);

export const TicketIcon = ({ className = "h-5 w-5" }: P) =>
  base(className, (
    <>
      <path d="M2 9a3 3 0 010 6v2a2 2 0 002 2h16a2 2 0 002-2v-2a3 3 0 010-6V7a2 2 0 00-2-2H4a2 2 0 00-2 2z" />
      <path d="M13 5v2M13 17v2M13 11v2" />
    </>
  ));
export const ChevronIcon = ({ className = "h-5 w-5" }: P) => base(className, <path d="M9 6l6 6-6 6" />);
export const TagIcon = ({ className = "h-5 w-5" }: P) =>
  base(className, (
    <>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ));
