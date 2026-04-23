import axios from 'axios';

const GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';

/**
 * Get coordinates for a given city name
 */
export const getCoordinates = async (city: string) => {
  try {

    const response = await axios.get(GEO_URL, {
      params: {
        q: city,
        limit: 1,
        appid: process.env.OPENWEATHER_API_KEY,
      },
    });

    if (response.data && response.data.length > 0) {
      return {
        lat: response.data[0].lat,
        lon: response.data[0].lon,
        name: response.data[0].name,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching coordinates:', error);
    throw new Error('Could not find city coordinates.');
  }
};

/**
 * Get current + forecast weather data using One Call API 3.0
 */
export const getWeatherData = async (lat: number, lon: number) => {
  try {
    const response = await axios.get(ONE_CALL_URL, {
      params: {
        lat,
        lon,
        units: 'metric',
        exclude: 'minutely,alerts',
        appid: process.env.OPENWEATHER_API_KEY,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching One Call weather data:', error);
    throw new Error('Could not fetch weather data.');
  }
};

/**
 * Formats current weather data into a readable string
 */
export const formatCurrentWeather = (city: string, data: any): string => {
  const temp = Math.round(data.current.temp);
  const desc = data.current.weather?.[0]?.description || 'unknown weather';
  const humidity = data.current.humidity;
  const wind = data.current.wind_speed;

  return `Current weather in ${city} is ${temp}°C with ${desc}. Humidity is ${humidity}% and wind speed is ${wind} m/s.`;
};

/**
 * Formats forecast data into a readable string for a specific date
 */
export const formatForecastWeather = (
  city: string,
  data: any,
  targetDate?: string
): string => {
  const forecastList = data.daily;

  if (!forecastList || forecastList.length === 0) {
    return `Sorry, I could not find forecast data for ${city}.`;
  }

  const requestedDate = targetDate ? new Date(targetDate) : new Date();
  console.log(`requested date ${JSON.stringify(requestedDate)}`)

  if (!targetDate) {
    requestedDate.setDate(requestedDate.getDate() + 1);
  }

  requestedDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffInDays = Math.ceil(
    (requestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays < 0) {
    return `I can only provide current or future weather forecasts for ${city}.`;
  }

  if (diffInDays > 8) {
    return `Sorry, I can only provide forecast data for up to the next 7 days for ${city}.`;
  }

  const matchingForecast = forecastList[diffInDays];

  if (matchingForecast) {
    const temp = Math.round(matchingForecast.temp.day);
    const desc =
      matchingForecast.weather?.[0]?.description || 'unknown weather';
    const dateStr = requestedDate.toDateString();

    let dayLabel = dateStr;

    if (diffInDays === 0) {
      dayLabel = 'Today';
    } else if (diffInDays === 1) {
      dayLabel = 'Tomorrow';
    }

    return `The forecast for ${city} on ${dayLabel} is around ${temp}°C with ${desc}.`;
  }

  return `Sorry, I could not find forecast data for ${city} on that date.`;
};

/**
 * Formats specific weather details (humidity, pressure, etc.)
 */
export const formatWeatherDetail = (
  city: string,
  data: any,
  detail: string,
  targetDate: string,
): string => {
  const forecastList = data.daily;
  const requestedDate = targetDate ? new Date(targetDate) : new Date();
  console.log(`requested date ${JSON.stringify(requestedDate)}`)

  if (!targetDate) {
    requestedDate.setDate(requestedDate.getDate() + 1);
  }

  requestedDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffInDays = Math.ceil(
    (requestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays < 0) {
    return `I can only provide current or future weather forecasts for ${city}.`;
  }

  if (diffInDays > 8) {
    return `Sorry, I can only provide forecast data for up to the next 7 days for ${city}.`;
  }

  const matchingForecast = forecastList[diffInDays];
  if(!matchingForecast) {
    return `Sorry, I could not find forecast data for ${city} on that date`
  }
 
    const temp = Math.round(matchingForecast.temp.day);
    const desc =
      matchingForecast.weather?.[0]?.description || 'unknown weather';
    const dateStr = requestedDate.toDateString();

    let dayLabel = dateStr;

    if (diffInDays === 0) {
      dayLabel = 'Today';
    } else if (diffInDays === 1) {
      dayLabel = 'Tomorrow';
    }

   switch (detail.toLowerCase()) {
    case 'temperature':
    case 'temp':
      return `The temperature in ${city} is ${Math.round(data.current.temp)}°C on ${dayLabel}`;

    case 'humidity':
      return `The humidity in ${city} is ${data.current.humidity}% on ${dayLabel}`;

    case 'wind':
    case 'wind speed':
    case 'breeze':
      return `The wind speed in ${city} is ${data.current.wind_speed} m/s on ${dayLabel}`;

    case 'pressure':
    case 'air pressure':
      return `The air pressure in ${city} is ${data.current.pressure} hPa on ${dayLabel}`;

    case 'clouds':
    case 'cloudiness':
    case 'cloud cover':
    case 'cloud':
      return `The cloud coverage in ${city} is ${data.current.clouds}% on ${dayLabel}`;

    case 'rain': {
      const rain =
        data.current.rain?.['1h'] ||
        data.hourly?.[0]?.rain?.['1h'] ||
        0;

      return `The rainfall in ${city} is ${rain} mm on ${dayLabel}`;
    }

    case 'uv':
    case 'uv index':
      return `The UV index in ${city} is ${data.current.uvi}.`;

    case 'feels like':
      return `It currently feels like ${Math.round(data.current.feels_like)}°C in ${city}.`;

    case 'sunrise':
      return `Sunrise in ${city} is at ${new Date(
        data.current.sunrise * 1000
      ).toLocaleTimeString()}.`;

    case 'sunset':
      return `Sunset in ${city} is at ${new Date(
        data.current.sunset * 1000
      ).toLocaleTimeString()}.`;

    default:
      return `I can check details like temperature, humidity, wind, rain, clouds, pressure, UV index, sunrise, sunset, and feels like temperature. Which one would you like to know for ${city}?`;
  }
};
