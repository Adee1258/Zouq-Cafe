// Status badge — for order status, availability, etc.
const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default:    'bg-gray-100 text-gray-700',
    primary:    'bg-orange-100 text-orange-700',
    success:    'bg-green-100 text-green-700',
    warning:    'bg-amber-100 text-amber-700',
    danger:     'bg-red-100 text-red-700',
    info:       'bg-blue-100 text-blue-700',
    purple:     'bg-purple-100 text-purple-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

// Maps order status strings to badge variants
export const orderStatusVariant = (status) => {
  const map = {
    PENDING:          'warning',
    APPROVED:         'info',
    PREPARING:        'primary',
    OUT_FOR_DELIVERY: 'purple',
    DELIVERED:        'success',
    REJECTED:         'danger',
  };
  return map[status] || 'default';
};

export const orderStatusLabel = (status) => {
  const map = {
    PENDING:          'Pending',
    APPROVED:         'Approved',
    PREPARING:        'Preparing',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED:        'Delivered',
    REJECTED:         'Rejected',
  };
  return map[status] || status;
};

export default Badge;
