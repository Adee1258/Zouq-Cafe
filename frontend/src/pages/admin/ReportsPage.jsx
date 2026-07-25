import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Download, Calendar, TrendingUp, ShoppingBag, Banknote, CreditCard } from 'lucide-react';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';

const fmt = (n) => `Rs. ${Number(n).toLocaleString()}`;

const SummaryCard = ({ icon: Icon, label, value, sub, color }) => {
  const colors = { orange: 'text-orange-500 bg-orange-50', green: 'text-green-500 bg-green-50', blue: 'text-blue-500 bg-blue-50' };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-extrabold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const AdminReportsPage = () => {
  const today = new Date().toISOString().split('T')[0];
  const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(sevenAgo);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/reports?startDate=${startDate}&endDate=${endDate}`);
      setData(res.data.data);
    } catch { /* keep */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [startDate, endDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/admin/reports/export?startDate=${startDate}&endDate=${endDate}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `zouqcafe-report-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm min-h-[44px]">
            <Calendar size={15} className="text-gray-400" />
            <input
              type="date" value={startDate} max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="outline-none text-gray-700 bg-transparent"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date" value={endDate} min={startDate} max={today}
              onChange={(e) => setEndDate(e.target.value)}
              className="outline-none text-gray-700 bg-transparent"
            />
          </div>
          {/* Quick ranges */}
          {[
            { label: '7d', days: 7 },
            { label: '30d', days: 30 },
            { label: '90d', days: 90 },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => {
                setEndDate(today);
                setStartDate(new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0]);
              }}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-orange-400 hover:text-orange-500 transition-colors min-h-[44px]"
            >
              {label}
            </button>
          ))}
          <Button variant="outline" size="sm" isLoading={exporting} onClick={handleExport}>
            <Download size={15} className="mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400">No data available.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard icon={ShoppingBag} label="Total Orders" value={data.summary.totalOrders} color="orange" />
            <SummaryCard icon={TrendingUp} label="Total Revenue" value={fmt(data.summary.totalRevenue)} color="green" />
            <SummaryCard
              icon={Banknote} label="COD"
              value={fmt(data.summary.cod.revenue)}
              sub={`${data.summary.cod.count} orders`}
              color="orange"
            />
            <SummaryCard
              icon={CreditCard} label="Online"
              value={fmt(data.summary.online.revenue)}
              sub={`${data.summary.online.count} orders`}
              color="blue"
            />
          </div>

          {/* Revenue Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-5">Daily Revenue</h2>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 400 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v, name) => [fmt(v), name === 'cod' ? 'COD' : name === 'online' ? 'Online' : 'Revenue']}
                      labelFormatter={(d) => new Date(d).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
                    />
                    <Legend formatter={(v) => v === 'cod' ? 'Cash on Delivery' : 'Online Payment'} />
                    <Bar dataKey="cod" stackId="a" fill="#F97316" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="online" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Orders Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-5">Daily Orders</h2>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 400 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date" tick={{ fontSize: 11 }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })} />
                    <Bar dataKey="orders" fill="#F97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* COD vs Online breakdown table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Payment Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Method', 'Orders', 'Revenue', '% of Total'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { method: 'Cash on Delivery', ...data.summary.cod },
                    { method: 'Online Payment', ...data.summary.online },
                  ].map((row) => (
                    <tr key={row.method} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900">{row.method}</td>
                      <td className="px-5 py-3.5 text-gray-600">{row.count}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{fmt(row.revenue)}</td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {data.summary.totalRevenue > 0
                          ? `${((row.revenue / data.summary.totalRevenue) * 100).toFixed(1)}%`
                          : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReportsPage;
