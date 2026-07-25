// Reusable Input field with label, error state, and icon support
const Input = ({
  label,
  error,
  icon: Icon,
  className = '',
  inputClassName = '',
  type = 'text',
  required = false,
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon size={18} />
          </div>
        )}
        <input
          type={type}
          className={`
            w-full rounded-xl border border-gray-200 bg-white px-4 py-3
            text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent
            transition-all duration-200
            min-h-[44px]
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-400 focus:ring-red-400' : ''}
            ${inputClassName}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
};

export default Input;
