const axios = require('axios');

const KOUZI_API_URL = process.env.KOUZI_API_URL;
const KOUZI_API_KEY = process.env.KOUZI_API_KEY;

const kouziClient = axios.create({
  baseURL: KOUZI_API_URL,
  headers: {
    'Authorization': `Bearer ${KOUZI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

exports.generateExercise = async (baseChars, difficulty, style) => {
  try {
    const response = await kouziClient.post('/exercise/generate', {
      base_chars: baseChars,
      difficulty,
      style
    });

    return {
      level_1: response.data.level_1,
      level_2: response.data.level_2,
      level_3: response.data.level_3,
      level_4: response.data.level_4
    };
  } catch (error) {
    console.error('Failed to generate exercise:', error);
    throw new Error('Failed to generate exercise');
  }
};

exports.generateAudio = async (text) => {
  try {
    const response = await kouziClient.post('/audio/generate', {
      text,
      voice_type: 1 // Default voice type
    }, {
      responseType: 'arraybuffer'
    });

    return response.data;
  } catch (error) {
    console.error('Failed to generate audio:', error);
    throw new Error('Failed to generate audio');
  }
};