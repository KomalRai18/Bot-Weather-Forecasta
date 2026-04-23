const axios = require('axios');

const testWebhook = async () => {
  const url = 'http://localhost:3000/webhook';

  const testCases = [
    {
      name: 'Current Weather Intent (Karachi)',
      description: 'Standard intent with city provided.',
      data: {
        queryResult: {
          intent: { displayName: 'Current Weather Intent' },
          parameters: { 'geo-city': 'Karachi' }
        }
      }
    },
    {
      name: 'Current Weather City Intent (Lahore)',
      description: 'Follow-up intent when city was missing. Should default to Today.',
      data: {
        queryResult: {
          intent: { displayName: 'Current Weather City Intent' },
          parameters: { 'geo-city': 'Lahore' }
        }
      }
    },
    {
      name: 'Forecast Weather Intent (Dubai - Tomorrow)',
      description: 'Forecast with specific date.',
      data: {
        queryResult: {
          intent: { displayName: 'Forecast Weather Intent' },
          parameters: { 
            'geo-city': 'Dubai',
            'date': new Date(Date.now() + 86400000).toISOString()
          }
        }
      }
    },
    {
      name: 'Forecast Weather City Intent (Islamabad - Default)',
      description: 'Follow-up intent for forecast with missing date. Should default to Tomorrow.',
      data: {
        queryResult: {
          intent: { displayName: 'Forecast Weather City Intent' },
          parameters: { 'geo-city': 'Islamabad' }
        }
      }
    },
    {
      name: 'Forecast Weather Intent (Lowercase Case Fix)',
      description: 'Verifies that lowercase intent names are now handled correctly.',
      data: {
        queryResult: {
          intent: { displayName: 'Forecast weather intent' },
          parameters: { 
            'geo-city': 'Karachi',
            'date': new Date(Date.now() + 86400000).toISOString()
          }
        }
      }
    },
    {
        name: 'Weather Detail Intent (London - Humidity)',
        description: 'Specific detail request.',
        data: {
          queryResult: {
            intent: { displayName: 'Weather Detail Intent' },
            parameters: { 
              'geo-city': 'London',
              'weather_detail': 'humidity'
            }
          }
        }
      }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.name}`);
      console.log(`Description: ${testCase.description}`);
      const response = await axios.post(url, testCase.data);
      console.log('Response:', response.data.fulfillmentText);
      console.log('---');
    } catch (error) {
      console.error(`Error in ${testCase.name}:`, error.message);
    }
  }
};

testWebhook();
