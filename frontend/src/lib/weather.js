const CHENGDU_COORDINATES = {
  latitude: 30.5728,
  longitude: 104.0668,
};

const WEATHER_CODE_LABELS = {
  0: '晴朗',
  1: '大部晴朗',
  2: '局部多云',
  3: '阴天',
  45: '有雾',
  48: '雾凇',
  51: '毛毛雨',
  53: '细雨',
  55: '密集毛毛雨',
  56: '冻毛毛雨',
  57: '强冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '强冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '阵雨',
  81: '强阵雨',
  82: '暴雨阵雨',
  85: '阵雪',
  86: '强阵雪',
  95: '雷暴',
  96: '雷暴伴小冰雹',
  99: '强雷暴伴冰雹',
};

function createWeatherUrl() {
  const searchParams = new URLSearchParams({
    latitude: String(CHENGDU_COORDINATES.latitude),
    longitude: String(CHENGDU_COORDINATES.longitude),
    current: 'temperature_2m,apparent_temperature,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '1',
    timezone: 'Asia/Shanghai',
  });

  return `https://api.open-meteo.com/v1/forecast?${searchParams.toString()}`;
}

export function getWeatherLabel(weatherCode) {
  return WEATHER_CODE_LABELS[weatherCode] ?? '天气平稳';
}

export async function fetchChengduWeather(fetchImpl = window.fetch) {
  const response = await fetchImpl(createWeatherUrl());

  if (!response.ok) {
    throw new Error(`天气请求失败：${response.status}`);
  }

  const payload = await response.json();
  const current = payload.current;
  const daily = payload.daily;

  if (!current || !daily || !Array.isArray(daily.temperature_2m_max) || !Array.isArray(daily.temperature_2m_min)) {
    throw new Error('天气数据格式不正确');
  }

  return {
    temperature: Math.round(current.temperature_2m),
    apparentTemperature: Math.round(current.apparent_temperature),
    weatherLabel: getWeatherLabel(current.weather_code),
    highTemperature: Math.round(daily.temperature_2m_max[0]),
    lowTemperature: Math.round(daily.temperature_2m_min[0]),
  };
}
