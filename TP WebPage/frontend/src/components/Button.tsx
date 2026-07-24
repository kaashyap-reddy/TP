import { ButtonHTMLAttributes, ReactNode, useRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white border border-transparent hover:bg-blue-700 active:bg-blue-800 focus-visible:ring-blue-500 shadow-sm',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-blue-500',
  outline: 'bg-transparent text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-blue-500',
  ghost: 'bg-transparent text-gray-600 border border-transparent hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-blue-500',
  danger: 'bg-red-600 text-white border border-transparent hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500 shadow-sm',
  success: 'bg-green-600 text-white border border-transparent hover:bg-green-700 active:bg-green-800 focus-visible:ring-green-500 shadow-sm',
  link: 'bg-transparent text-blue-600 border border-transparent hover:underline focus-visible:ring-blue-500 shadow-none p-0 h-auto'
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  // 44x44 minimum touch target for icon-only controls, per WCAG target-size guidance.
  icon: 'h-11 w-11 p-0'
};

const SPINNER = (
  <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

// Icon-only buttons (size="icon") must carry an accessible name -- either children is plain
// text (rare for icon buttons) or an aria-label is required. Enforced via a union so the
// TypeScript compiler catches a missing label at every call site instead of relying on review.
type ButtonProps = ButtonBaseProps &
  ({ size: 'icon'; 'aria-label': string; children: ReactNode } | { size?: 'sm' | 'md' | 'lg'; 'aria-label'?: string; children: ReactNode });

export default function Button({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  loading = false,
  loadingLabel,
  fullWidth = false,
  type = 'button',
  disabled,
  className,
  children,
  onClick,
  'aria-label': ariaLabel,
  ...rest
}: ButtonProps) {
  // Defense-in-depth against double submission: even if a caller forgets to flip `loading`
  // fast enough (e.g. an async handler that awaits before setting state), a click that arrives
  // while we're already mid-loading is dropped rather than firing the handler a second time.
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (loadingRef.current) return;
    onClick?.(event);
  }

  const isIconOnly = size === 'icon';
  const baseClass =
    'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      title={isIconOnly ? ariaLabel : undefined}
      onClick={handleClick}
      className={`${baseClass} ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]}${fullWidth ? ' w-full' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {loading ? (
        <>
          {SPINNER}
          {!isIconOnly && (loadingLabel ?? children)}
        </>
      ) : (
        <>
          {leadingIcon}
          {children}
          {trailingIcon}
        </>
      )}
    </button>
  );
}
