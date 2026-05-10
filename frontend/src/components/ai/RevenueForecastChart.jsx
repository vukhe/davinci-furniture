import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

const HORIZON_OPTIONS = [
  { label: '7 ngày', value: 7 },
  { label: '30 ngày', value: 30 },
  { label: '60 ngày', value: 60 },
  { label: '90 ngày', value: 90 },
];

const formatCompactVND = (value) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} triệu`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${Math.round(value)}`;
};

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Math.round(value || 0))}₫`;

const buildLinePath = (points) => {
  let path = '';

  points.forEach((point, index) => {
    if (!point) return;
    path += `${index === 0 || !points[index - 1] ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)} `;
  });

  return path.trim();
};

function ForecastSvgChart({ data = [], forecastStartIndex = -1 }) {
  if (!data.length) return null;

  const width = 920;
  const height = 280;
  const pad = { top: 16, right: 22, bottom: 34, left: 68 };
  const values = data.flatMap((item) =>
    [item.actual, item.predicted, item.upper, item.lower].filter((value) => typeof value === 'number')
  );
  const maxValue = Math.max(...values, 1);
  const ticks = 4;
  const xForIndex = (index) =>
    pad.left + (index / Math.max(data.length - 1, 1)) * (width - pad.left - pad.right);
  const yForValue = (value) =>
    pad.top + (1 - value / maxValue) * (height - pad.top - pad.bottom);

  const actualPoints = data.map((item, index) =>
    typeof item.actual === 'number' ? { x: xForIndex(index), y: yForValue(item.actual) } : null
  );
  const predictedPoints = data.map((item, index) =>
    typeof item.predicted === 'number' ? { x: xForIndex(index), y: yForValue(item.predicted) } : null
  );
  const forecastBandPoints = data
    .map((item, index) => {
      if (
        typeof item.upper !== 'number' ||
        typeof item.lower !== 'number' ||
        index < forecastStartIndex
      ) {
        return null;
      }

      return {
        x: xForIndex(index),
        upperY: yForValue(item.upper),
        lowerY: yForValue(item.lower),
      };
    })
    .filter(Boolean);

  const bandPath = forecastBandPoints.length
    ? [
        ...forecastBandPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.upperY.toFixed(1)}`),
        ...forecastBandPoints
          .slice()
          .reverse()
          .map((point) => `L${point.x.toFixed(1)},${point.lowerY.toFixed(1)}`),
        'Z',
      ].join(' ')
    : '';

  const xTickStep = Math.max(1, Math.ceil(data.length / 6));
  const forecastBoundaryX = forecastStartIndex >= 0 ? xForIndex(forecastStartIndex) : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[280px]">
      <defs>
        <linearGradient id="dv-actual-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b7280" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6b7280" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="dv-forecast-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c47a2e" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#c47a2e" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {Array.from({ length: ticks + 1 }, (_, index) => {
        const y = pad.top + (index / ticks) * (height - pad.top - pad.bottom);
        const value = maxValue - (index / ticks) * maxValue;
        return (
          <g key={index}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={pad.left - 10} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
              {formatCompactVND(value)}
            </text>
          </g>
        );
      })}

      {bandPath ? <path d={bandPath} fill="url(#dv-forecast-fill)" /> : null}

      {actualPoints.some(Boolean) ? (
        <path
          d={buildLinePath(actualPoints)}
          fill="none"
          stroke="#6b7280"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {predictedPoints.some(Boolean) ? (
        <path
          d={buildLinePath(predictedPoints)}
          fill="none"
          stroke="#c47a2e"
          strokeWidth="2.8"
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {forecastBoundaryX ? (
        <>
          <line
            x1={forecastBoundaryX}
            y1={pad.top}
            x2={forecastBoundaryX}
            y2={height - pad.bottom}
            stroke="#c47a2e"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text x={forecastBoundaryX + 6} y={pad.top + 8} fontSize="10" fill="#c47a2e">
            Hôm nay
          </text>
        </>
      ) : null}

      {data.map((item, index) => {
        if (index !== 0 && index !== data.length - 1 && index % xTickStep !== 0) return null;

        return (
          <text
            key={`${item.date}-${index}`}
            x={xForIndex(index)}
            y={height - 10}
            fontSize="10"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {new Date(item.date).toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
            })}
          </text>
        );
      })}
    </svg>
  );
}

export default function RevenueForecastChart() {
  const [horizon, setHorizon] = useState(30);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const token = useSelector((state) => state.auth?.token);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    const loadForecast = async () => {
      setLoading(true);
      setError(null);

      try {
        const [histRes, forecastRes] = await Promise.all([
          fetch(`${AI_SERVICE_URL}/api/ai/forecast/historical?admin_token=${token}`, { signal: controller.signal }),
          fetch(`${AI_SERVICE_URL}/api/ai/forecast/revenue?horizon=${horizon}&admin_token=${token}`, { signal: controller.signal }),
        ]);

        if (!histRes.ok || !forecastRes.ok) {
          throw new Error('forecast-fetch-failed');
        }

        const histData = await histRes.json();
        const forecastData = await forecastRes.json();

        const historical = (histData.daily || []).slice(-30).map((item) => ({
          date: item.ds,
          actual: Number(item.y || 0),
          isForecast: false,
        }));
        const forecast = (forecastData.forecast || []).map((item) => ({
          date: item.ds,
          predicted: Math.round(Number(item.yhat || 0)),
          upper: Math.round(Number(item.yhat_upper || 0)),
          lower: Math.round(Number(item.yhat_lower || 0)),
          isForecast: true,
        }));

        setChartData([...historical, ...forecast]);
        setMeta({
          method: forecastData.method,
          mae: forecastData.mae,
          trainedOn: forecastData.trained_on,
          total: histData.total,
          avgDaily: histData.avg_daily,
          forecastTotal: forecast.reduce((sum, item) => sum + Number(item.predicted || 0), 0),
          forecastStartIndex: historical.length,
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') return;
        setChartData([]);
        setMeta(null);
        setError('Không thể tải dữ liệu dự đoán. Đảm bảo AI service đang chạy.');
      } finally {
        setLoading(false);
      }
    };

    loadForecast();

    return () => controller.abort();
  }, [horizon, token]);

  if (!token) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-700 text-sm">
        Vui lòng đăng nhập để xem dự đoán doanh thu.
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-100 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-heading font-semibold text-stone-800 flex items-center gap-2">
            📈 Dự đoán doanh thu
            <span className="text-[10px] font-bold text-davinci-gold bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">AI</span>
          </h3>
          {meta ? (
            <p className="text-xs text-stone-400 mt-1">
              Model: <span className="capitalize font-medium">{meta.method}</span>
              {meta.mae ? ` · MAE: ${formatCurrency(meta.mae)}` : ''}
              {meta.trainedOn ? ` · ${meta.trainedOn} ngày dữ liệu` : ''}
            </p>
          ) : (
            <p className="text-xs text-stone-400 mt-1">So sánh doanh thu lịch sử với vùng dự báo trong ngắn hạn.</p>
          )}
        </div>

        <div className="flex gap-1 bg-stone-50 rounded-lg p-1">
          {HORIZON_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setHorizon(option.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                horizon === option.value
                  ? 'bg-davinci-gold text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {meta ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-stone-50 rounded-xl p-3">
            <p className="text-xs text-stone-400">Tổng doanh thu (lịch sử)</p>
            <p className="text-lg font-semibold text-stone-800 mt-1">{formatCurrency(meta.total)}</p>
          </div>
          <div className="bg-stone-50 rounded-xl p-3">
            <p className="text-xs text-stone-400">Trung bình / ngày</p>
            <p className="text-lg font-semibold text-stone-800 mt-1">{formatCurrency(meta.avgDaily)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-amber-600">Dự đoán {horizon} ngày tới</p>
            <p className="text-lg font-semibold text-davinci-gold mt-1">{formatCurrency(meta.forecastTotal)}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-stone-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-500" />
          Doanh thu thực tế
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-davinci-gold" />
          Đường dự báo
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-100" />
          Biên độ ước lượng
        </span>
      </div>

      {loading ? (
        <div className="h-[280px] flex items-center justify-center text-stone-400 animate-pulse">
          <div className="text-center">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-sm">Đang tải dữ liệu dự đoán...</p>
          </div>
        </div>
      ) : error ? (
        <div className="h-[280px] flex items-center justify-center">
          <div className="text-center text-sm text-red-500">
            <div className="text-2xl mb-2">⚠️</div>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <ForecastSvgChart data={chartData} forecastStartIndex={meta?.forecastStartIndex ?? -1} />
      )}
    </div>
  );
}
