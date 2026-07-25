// Reusable Button — variants: primary, secondary, outline, danger, ghost
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  disabled = false,
  type = 'button',
  fullWidth = false,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer';

  const variants = {
    primary:
      'bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-400 shadow-md hover:shadow-lg',
    secondary:
      'bg-amber-400 hover:bg-amber-500 text-gray-900 focus:ring-amber-300 shadow-md',
    outline:
      'border-2 border-orange-500 text-orange-500 hover:bg-orange-50 focus:ring-orange-400',
    danger:
      'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400',
    ghost:
      'text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
    success:
      'bg-green-500 hover:bg-green-600 text-white focus:ring-green-400',
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-5 py-2.5 text-base min-h-[44px]',
    lg: 'px-7 py-3 text-lg min-h-[52px]',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
