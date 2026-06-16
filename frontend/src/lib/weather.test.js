import { describe, expect, it, vi } from 'vitest';
import { fetchChengduWeather, getWeatherLabel } from './weather';

describe('getWeatherLabel', () => {
  it('maps known WMO weather codes to Chinese labels', () => {
    expect(getWeatherLabel(0)).toBe('晴朗');
    expect(getWeatherLabel(63)).toBe('中雨');
  });

  it('falls back to a generic label for unknown codes', () => {
    expect(getWeatherLabel(999)).toBe('天气平稳');
  });
});

describe('fetchChengduWeather', () => {
  it('returns normalized weather data from the Open-Meteo payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 26.4,
          apparent_temperature: 27.2,
          weather_code: 1,
        },
        daily: {
          temperature_2m_max: [29.1],
          temperature_2m_min: [21.2],
        },
      }),
    });

    await expect(fetchChengduWeather(fetchMock)).resolves.toEqual({
      temperature: 26,
      apparentTemperature: 27,
      weatherLabel: '大部晴朗',
      highTemperature: 29,
      lowTemperature: 21,
    });
  });

  it('throws when the weather endpoint returns an error response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(fetchChengduWeather(fetchMock)).rejects.toThrow('天气请求失败：503');
  });
});
