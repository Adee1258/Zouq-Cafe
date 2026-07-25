// Loading spinner — use for full-page and inline loading states
const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div
      className={`${sizes[size]} rounded-full border-orange-200 border-t-orange-500 animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
};

// Full-page loading overlay
export const PageLoader = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-orange-50/80 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-3">
      <Spinner size="lg" />
      <p className="text-orange-600 font-medium">Loading...</p>
    </div>
  </div>
);

export default Spinner;
