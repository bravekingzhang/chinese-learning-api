const { PrismaClient } = require('@prisma/client');
const { generateExercise, generateAudio } = require('../utils/kouzi');
const { uploadToOSS } = require('../utils/oss');

const prisma = new PrismaClient();

exports.generate = async (req, res) => {
  try {
    const { type, chars, unitId, imageUrl, difficulty = 1, style = 1 } = req.body;
    const userId = req.user.userId;

    // Check daily points limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPoints = await prisma.pointsRecord.aggregate({
      where: {
        userId,
        createdAt: { gte: today },
        type: 1
      },
      _sum: {
        points: true
      }
    });

    const todayEarned = todayPoints._sum.points || 0;
    if (todayEarned >= 100) {
      return res.status(400).json({
        code: 400,
        message: 'Daily points limit reached'
      });
    }

    // Check membership for non-first daily generation
    if (todayEarned > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user.memberType || !user.expireTime || user.expireTime < new Date()) {
        return res.status(403).json({
          code: 403,
          message: 'Membership required for multiple generations per day'
        });
      }
    }

    // Generate exercise content based on type
    let baseChars;
    if (type === 1) {
      baseChars = chars;
    } else if (type === 2) {
      baseChars = await getUnitChars(unitId);
    } else if (type === 3) {
      baseChars = await extractCharsFromImage(imageUrl);
    } else {
      return res.status(400).json({
        code: 400,
        message: 'Invalid generation type'
      });
    }

    // Generate exercise content using Kouzi API
    const content = await generateExercise(baseChars, difficulty, style);

    // Generate audio for each level
    const [audioUrl1, audioUrl2, audioUrl3, audioUrl4] = await Promise.all([
      generateAndUploadAudio(content.level_1),
      generateAndUploadAudio(content.level_2),
      generateAndUploadAudio(content.level_3),
      generateAndUploadAudio(content.level_4)
    ]);

    // Save exercise record
    const exercise = await prisma.exerciseRecord.create({
      data: {
        userId,
        baseChars,
        difficulty,
        content,
        audioUrl1,
        audioUrl2,
        audioUrl3,
        audioUrl4
      }
    });

    // Add points record
    await prisma.pointsRecord.create({
      data: {
        userId,
        points: 10,
        type: 1,
        remark: '生成题目'
      }
    });

    // Update user points
    await prisma.user.update({
      where: { id: userId },
      data: {
        points: {
          increment: 10
        }
      }
    });

    res.json({
      code: 0,
      data: {
        id: exercise.id,
        content: exercise.content,
        audio_url_1: exercise.audioUrl1,
        audio_url_2: exercise.audioUrl2,
        audio_url_3: exercise.audioUrl3,
        audio_url_4: exercise.audioUrl4
      }
    });
  } catch (error) {
    console.error('Exercise generation error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to generate exercise'
    });
  }
};

exports.shuffle = async (req, res) => {
  try {
    const { exerciseId } = req.body;

    const exercise = await prisma.exerciseRecord.findUnique({
      where: {
        id: exerciseId,
        userId: req.user.userId
      }
    });

    if (!exercise) {
      return res.status(404).json({
        code: 404,
        message: 'Exercise not found'
      });
    }

    // Shuffle content
    const content = exercise.content;
    for (const level of ['level_1', 'level_2', 'level_3', 'level_4']) {
      content[level] = shuffleArray(content[level]);
    }

    // Generate new audio for shuffled content
    const [audioUrl1, audioUrl2, audioUrl3, audioUrl4] = await Promise.all([
      generateAndUploadAudio(content.level_1),
      generateAndUploadAudio(content.level_2),
      generateAndUploadAudio(content.level_3),
      generateAndUploadAudio(content.level_4)
    ]);

    // Update exercise record
    await prisma.exerciseRecord.update({
      where: { id: exerciseId },
      data: {
        content,
        audioUrl1,
        audioUrl2,
        audioUrl3,
        audioUrl4
      }
    });

    res.json({
      code: 0,
      data: {
        content,
        audio_url_1: audioUrl1,
        audio_url_2: audioUrl2,
        audio_url_3: audioUrl3,
        audio_url_4: audioUrl4
      }
    });
  } catch (error) {
    console.error('Exercise shuffle error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to shuffle exercise'
    });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { page = 1, size = 20 } = req.query;
    const skip = (page - 1) * size;

    const [total, records] = await Promise.all([
      prisma.exerciseRecord.count({
        where: { userId: req.user.userId }
      }),
      prisma.exerciseRecord.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(size)
      })
    ]);

    res.json({
      code: 0,
      data: {
        total,
        list: records
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Failed to get exercise history'
    });
  }
};

exports.deleteHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const exercise = await prisma.exerciseRecord.findUnique({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!exercise) {
      return res.status(404).json({
        code: 404,
        message: 'Exercise not found'
      });
    }

    await prisma.exerciseRecord.delete({
      where: { id }
    });

    res.json({
      code: 0,
      message: 'Exercise deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Failed to delete exercise'
    });
  }
};

// Helper functions
async function generateAndUploadAudio(content) {
  const audioBuffer = await generateAudio(content);
  const filename = `audio/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
  return await uploadToOSS(filename, audioBuffer);
}

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

async function getUnitChars(unitId) {
  // TODO: Implement unit characters retrieval
  return '天地人和为贵';
}

async function extractCharsFromImage(imageUrl) {
  // TODO: Implement character extraction from image
  return '天地人和为贵';
} 