import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart,
} from 'recharts';
import { Trophy, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';

// Color palettes
const PIE_COLORS    = ['#F97316', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6'];
const STATUS_COLORS = {
  PENDING:          '#FBBF24',
  APPROVED:         '#60A5FA',
  PREPARING:        '#A78BFA',
  OUT_FOR_DELIVERY: '#F97316',
  DELIVERED:        '#34D399',
  REJECTED:         '#F87171',
};

// Custom tooltip for revenue chart
const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-orange-600 font-bold">Rs. {Number(payload[0]?.value || 0).toLocaleString()}</p>
      {payload[1] && (
        <p className="text-blue-500 text-xs mt-0.5">{payload[1].value} orders</p>
      )}
    </div>
  );
};

const AdminAnalyticsPage = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [days,    setDays]    = useState(30);

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/analytics?days=${days}`)
      .then((r) => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors min-h-[40px] ${
                days === d
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-400'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400">No data yet.</div>
      ) : (
        <>
          {/* ── Revenue Trend (NEW) ── */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={18} className="text-green-500" />
              <h2 className="font-bold text-gray-900">Revenue Trend</h2>
              <span className="text-xs text-gray-400 ml-1">last {days} days</span>
            </div>
            {data.dailyRevenue?.every((d) => d.revenue === 0) ? (
              <p className="text-gray-400 text-sm text-center py-8">No revenue data in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(500, (data.dailyRevenue?.length || 0) * 20) }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.dailyRevenue} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#F97316" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        interval={days <= 7 ? 0 : days <= 30 ? 4 : 9}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                      />
                      <Tooltip content={<RevenueTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#F97316"
                        strokeWidth={2}
                        fill="url(#revenueGrad)"
                        dot={days <= 14}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* ── Status Breakdown + Category — side by side ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Order Status Breakdown (NEW) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle size={18} className="text-green-500" />
                <h2 className="font-bold text-gray-900">Order Status Breakdown</h2>
              </div>
              {!data.statusBreakdown?.length ? (
                <p className="text-gray-400 text-sm text-center py-8">No orders in this period.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={data.statusBreakdown}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        innerRadius={35}
                        paddingAngle={3}
                      >
                        {data.statusBreakdown.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] || '#9CA3AF'}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, name) => [`${v} orders`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {data.statusBreakdown.map((s) => {
                      const total = data.statusBreakdown.reduce((sum, x) => sum + x.count, 0);
                      const pct   = total > 0 ? ((s.count / total) * 100).toFixed(0) : 0;
                      return (
                        <div key={s.status} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: STATUS_COLORS[s.status] || '#9CA3AF' }}
                            />
                            <span className="text-gray-700">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: STATUS_COLORS[s.status] || '#9CA3AF',
                                }}
                              />
                            </div>
                            <span className="font-semibold text-gray-900 w-6 text-right">{s.count}</span>
                            <span className="text-gray-400 text-xs w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Category pie */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-5">Sales by Category</h2>
              {data.categoryBreakdown.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={data.categoryBreakdown}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) =>
                          percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                        }
                        labelLine={false}
                      >
                        {data.categoryBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, 'Revenue']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {data.categoryBreakdown.map((cat, i) => (
                      <div key={cat.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-gray-700">{cat.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">Rs. {Number(cat.revenue).toLocaleString()}</span>
                          <span className="text-gray-400 text-xs ml-2">({cat.quantity} sold)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Best Sellers ── */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={18} className="text-amber-500" />
              <h2 className="font-bold text-gray-900">Best Selling Products</h2>
              <span className="text-xs text-gray-400 ml-1">by quantity sold</span>
            </div>

            {data.bestSellers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No orders in this period.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: Math.max(400, data.bestSellers.length * 80) }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.bestSellers} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(v, name) =>
                            name === 'quantity'
                              ? [`${v} sold`, 'Qty']
                              : [`Rs. ${Number(v).toLocaleString()}`, 'Revenue']
                          }
                        />
                        <Legend />
                        <Bar dataKey="quantity" name="Qty Sold" fill="#F97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 rounded-xl">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Product</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Category</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Sold</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.bestSellers.slice(0, 10).map((p, i) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400 font-bold">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{p.category}</td>
                          <td className="px-4 py-3 font-semibold text-orange-600">{p.quantity}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">Rs. {Number(p.revenue).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ── Time of Day + Hourly ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Clock size={18} className="text-blue-500" />
                <h2 className="font-bold text-gray-900">Orders by Time of Day</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.timeOfDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} orders`, 'Orders']} />
                  <Bar dataKey="orders" fill="#60A5FA" radius={[4, 4, 0, 0]}>
                    {data.timeOfDay.map((_, index) => (
                      <Cell key={index} fill={['#FED7AA', '#FCA5A5', '#F97316', '#7C3AED'][index % 4]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {data.timeOfDay.map(({ name, orders: cnt }) => (
                  <div key={name} className="bg-gray-50 rounded-xl px-3 py-2 text-sm">
                    <p className="text-gray-500 text-xs">{name}</p>
                    <p className="font-bold text-gray-900">{cnt} orders</p>
                  </div>
                ))}
              </div>
            </div>

            {data.hourly.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-5">Hourly Distribution</h2>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: 300 }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.hourly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip formatter={(v) => [`${v} orders`, 'Orders']} />
                        <Bar dataKey="orders" fill="#F97316" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
