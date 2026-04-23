import { Request, Response } from 'express';
import {
  getCoordinates,
  getWeatherData,
  formatCurrentWeather,
  formatForecastWeather,
  formatWeatherDetail,
} from '../services/weatherService';

/**
 * Handles Dialogflow ES Webhook Requests
 */
export const handleWebhook = async (req: Request, res: Response) => {
  const body = req.body;

  if (!body.queryResult) {
    return res.status(400).send('Invalid webhook request: missing queryResult');
  }

  const intentName = body.queryResult.intent.displayName || '';
  const parameters = body.queryResult.parameters || {};
  const userQuery = body.queryResult.queryText?.toLowerCase() || '';
  
  if(userQuery.includes('month') || userQuery.includes('year')) {
     return res.json({
        fulfillmentText: `I can provide weather forecasts for up to 7 days ahead. Would you like to know the forecast for the coming week instead.`})
  }
  const contexts = body.queryResult.outputContexts || [];

  console.log('all contexts', JSON.stringify(contexts, null, 2));

  const normalized = intentName.toLowerCase().trim();

  console.log(`[Webhook] Received Intent: "${intentName}"`);
  console.log(`[Webhook] Query Text: "${userQuery}"`);
  console.log(`[Webhook] Parameters:`, parameters);

  /**
   * Find context where forecast date/duration was saved
   */

  const weatherContext = contexts.find((ctx: any) =>
    ctx.name.toLowerCase().includes('awaiting_city_forecast')
  );

  const savedDuration = weatherContext?.parameters?.duration;

  let savedDate: string | undefined;

  // Handle date-time like "this friday"
  if (
    weatherContext?.parameters?.['date-time'] &&
    weatherContext.parameters['date-time'] !== ''
  ) {
      const contextDateTime = weatherContext.parameters['date-time'];
      console.log(`context date time ${JSON.stringify(contextDateTime)}`)
      if (typeof contextDateTime === 'string') {
      savedDate = contextDateTime;
      }
      else if (
      typeof contextDateTime === 'object' &&
      contextDateTime !== null
    ) {
      savedDate =
      contextDateTime.endDateTime ||
      contextDateTime.endDate||
        contextDateTime.startDateTime ||
        contextDateTime.startDate;
    }
  }

  // Handle date-period like "this week"
  else if (
    weatherContext?.parameters?.['date-period'] &&
    typeof weatherContext.parameters['date-period'] === 'object'
  ) {
    savedDate = weatherContext.parameters['date-period']?.endDate || weatherContext.parameters['date-period']?.startDate;
  }

  // Handle duration like "2 days later"
  else if (
    savedDuration &&
    typeof savedDuration === 'object' &&
    savedDuration.amount
  ) {
    const futureDate = new Date();
    let amount = Number(savedDuration.amount);
    const unit = savedDuration.unit;

    if(unit === 'wk') {
      amount = amount * 7
    } else if(unit === 'month' || unit === 'year'){
        return res.json({
        fulfillmentText: `I can provide weather forecasts for up to 7 days ahead. Would you like to know the forecast for the coming week instead.`,
      });
    }
    futureDate.setDate(
      futureDate.getDate() + Number(amount)
    );
    savedDate = futureDate.toISOString();
  }

  console.log(`savedDate  ${JSON.stringify(savedDate)}`);

  const dateTime =
    parameters['date'] ||
    parameters['date-time'] ||
    parameters['date-period'];

  console.log(
    `dateTime ${JSON.stringify(dateTime)} and typeof ${typeof dateTime}`
  );

  let targetDate: string | undefined = savedDate;

  /**
   * Handle direct date string
   */
  if (typeof dateTime === 'string' && dateTime !== '') {
    targetDate = dateTime;
  }

  /**
   * Handle date-time/date-period objects
   */
  else if (typeof dateTime === 'object' && dateTime !== null) {
    targetDate =
    dateTime.endDate ||
      dateTime.startDate ||
      dateTime.date_time ||
      dateTime.date || dateTime.endDateTime || dateTime.startDateTime
      undefined;
  }

  /**
   * Handle duration object from Dialogflow
   */
  const duration = parameters['duration'];

  if (
    !targetDate &&
    duration &&
    typeof duration === 'object' &&
    duration.amount
  ) {
    const futureDate = new Date();
    futureDate.setDate(
      futureDate.getDate() + Number(duration.amount)
    );
    targetDate = futureDate.toISOString();
  }

  /**
   * Handle text patterns like:
   * after 2 days
   * in 4 days
   * 3 days later
   */
  if (!targetDate) {
    const match = userQuery.match(
      /(?:after\s+(\d+)\s+days?)|(?:in\s+(\d+)\s+days?)|(?:(\d+)\s+days?\s+later)/i
    );

    const days =
      Number(match?.[1]) ||
      Number(match?.[2]) ||
      Number(match?.[3]) || Number(match?.[4]) || Number(match?.[5]) || Number(match?.[6]) || Number(match?.[7]);

    if (days) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      targetDate = futureDate.toISOString();
    }
  }

  /**
   * Handle "this week"
   */
  if (!targetDate && userQuery.includes('this week')) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    targetDate = futureDate.toISOString();
  }

  /**
   * Default to tomorrow if no date specified
   */
  if (!targetDate) {
    const tomorrow = new Date();
    // tomorrow.setDate(tomorrow.getDate() + 1);
    targetDate = tomorrow.toISOString();
  }

  console.log(`targetDate ${JSON.stringify(targetDate)}`);

  const rawCity = parameters['geo-city'] || parameters['city'];
  const city = Array.isArray(rawCity) ? rawCity[0] : rawCity;

  console.log(`city ${city}`);

  try {
    /**
     * If city missing, ask follow-up question and save date info in context
     */
    if (!city) {
      return res.json({
        fulfillmentText: 'Which city would you like the weather for?',
        outputContexts: [
          {
            name: `${body.session}/contexts/awaiting_city_forecast`,
            lifespanCount: 7,
            parameters: {
              'date-time': parameters['date-time'] || '',
              'date-period': parameters['date-period'] || '',
              duration: parameters['duration'] || '',
            },
          },
        ],
      });
    }

    const coords = await getCoordinates(city);

    if (!coords) {
      return res.json({
        fulfillmentText: `I could not find the location ${city}. Please try another city name.`,
      });
    }

    const resolvedCity = coords.name;

    let responseText = '';

    /**
     * Decide if request is for forecast weather
     */
    const isWeatherDetailRequest = normalized.includes('detail') || parameters['weather_detail'];

    const isForecastRequest =
      savedDate ||
      normalized.includes('forecast') ||
      userQuery.includes('tomorrow') ||
      userQuery.includes('this week') ||
      userQuery.includes('weekend') ||
      userQuery.includes('after') ||
      userQuery.includes('later') ||
      userQuery.includes('day')
    /**
     * Forecast Weather Logic
     */

    if (isWeatherDetailRequest) {
      const detail = parameters['weather_detail'];

      if (!detail) {
        responseText = `What specific detail would you like to know about the weather in ${resolvedCity}? For example temperature, humidity, wind, rain, pressure, or clouds.`;
      } else {
        const weatherData = await getWeatherData(coords.lat, coords.lon);

        responseText = formatWeatherDetail(
          resolvedCity,
          weatherData,
          detail,
          targetDate
        );
      }
    }
    else if (isForecastRequest) {
      const weatherData = await getWeatherData(coords.lat, coords.lon);

      

      responseText = formatForecastWeather(
        resolvedCity,
        weatherData,
        targetDate
      );
    }

    /**
     * Weather Detail Logic
     */
    

    /**
     * Current Weather Logic
     */
    else if (
      normalized.includes('current')
    ) {
      const weatherData = await getWeatherData(coords.lat, coords.lon);

      responseText = formatCurrentWeather(
        resolvedCity,
        weatherData
      );
    }

    /**
     * Unknown Intent
     */
    else {
      console.warn(`[Webhook] No keyword match for intent: "${intentName}"`);

      responseText = `I've received your request for ${resolvedCity}, but I'm still learning how to handle the specific question related to "${intentName}".`;
    }

    return res.json({
      fulfillmentText: responseText,
      fulfillmentMessages: [
        {
          text: {
            text: [responseText],
          },
        },
      ],
      source: 'weather-webhook-service',
    });
  } catch (error: any) {
    console.error('[Webhook Error]:', error.message);

    return res.json({
      fulfillmentText: `I'm having trouble getting the weather data for ${
        city || 'that location'
      }. Please ensure your API key and city name are correct.`,
    });
  }
};
