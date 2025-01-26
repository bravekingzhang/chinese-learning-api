const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { getWechatAccessToken, getWechatUserInfo } = require('../utils/wechat');

const prisma = new PrismaClient();

exports.login = async (req, res) => {
  try {
    const { code, phone, inviteCode } = req.body;

    // 1. Get WeChat access token and openid
    const { access_token, openid } = await getWechatAccessToken(code);

    // 2. Get user info from WeChat
    const wechatUserInfo = await getWechatUserInfo(access_token, openid);

    // 3. Find or create user
    let user = await prisma.user.findUnique({
      where: { openId: openid }
    });

    const isNewUser = !user;

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          openId: openid,
          phone,
          nickname: wechatUserInfo.nickname,
          avatar: wechatUserInfo.headimgurl
        }
      });

      // Handle invite code if provided
      if (inviteCode) {
        await handleInviteCode(user.id, inviteCode);
      }
    }

    // 4. Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      code: 0,
      data: {
        token,
        is_new_user: isNewUser,
        user_info: {
          nickname: user.nickname,
          avatar: user.avatar,
          points: user.points,
          is_member: user.memberType > 0 && user.expireTime > new Date()
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      code: 500,
      message: 'Login failed'
    });
  }
};

exports.getUserInfo = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: 'User not found'
      });
    }

    res.json({
      code: 0,
      data: {
        nickname: user.nickname,
        avatar: user.avatar,
        points: user.points,
        phone: user.phone,
        member_type: user.memberType,
        expire_time: user.expireTime
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Failed to get user info'
    });
  }
};

exports.getTodayPoints = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPoints = await prisma.pointsRecord.aggregate({
      where: {
        userId: req.user.userId,
        createdAt: { gte: today },
        type: 1 // Only count points gained from exercise generation
      },
      _sum: {
        points: true
      }
    });

    const todayEarned = todayPoints._sum.points || 0;
    const maxDailyPoints = 100;

    res.json({
      code: 0,
      data: {
        today_points: todayEarned,
        remain_points: Math.max(0, maxDailyPoints - todayEarned)
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Failed to get today points'
    });
  }
};

exports.getPointsRecords = async (req, res) => {
  try {
    const { page = 1, size = 20 } = req.query;
    const skip = (page - 1) * size;

    const [total, records] = await Promise.all([
      prisma.pointsRecord.count({
        where: { userId: req.user.userId }
      }),
      prisma.pointsRecord.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(size),
        select: {
          id: true,
          points: true,
          type: true,
          remark: true,
          createdAt: true
        }
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
      message: 'Failed to get points records'
    });
  }
};

async function handleInviteCode(newUserId, inviteCode) {
  const sharer = await prisma.user.findFirst({
    where: { id: inviteCode } // Using user ID as invite code for simplicity
  });

  if (!sharer) return;

  // Create share record
  await prisma.shareRecord.create({
    data: {
      sharerId: sharer.id,
      inviteeId: newUserId,
      rewardDays: 7
    }
  });

  // Update both users' member expiry time
  const rewardDays = 7;
  const now = new Date();

  for (const userId of [sharer.id, newUserId]) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    const newExpireTime = user.expireTime && user.expireTime > now
      ? new Date(user.expireTime.getTime() + rewardDays * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + rewardDays * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        memberType: 1, // 7-day member
        expireTime: newExpireTime
      }
    });
  }
}