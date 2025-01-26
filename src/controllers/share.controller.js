const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');

const prisma = new PrismaClient();

const REWARD_DAYS = 7;
const MAX_MONTHLY_REWARDS = 10;

exports.getInviteCode = async (req, res) => {
  try {
    const userId = req.user.userId;

    // We use the user's ID as the invite code for simplicity
    // In a production environment, you might want to use a more sophisticated method
    res.json({
      code: 0,
      data: {
        invite_code: userId
      }
    });
  } catch (error) {
    console.error('Get invite code error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to get invite code'
    });
  }
};

exports.useInviteCode = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const inviteeId = req.user.userId;

    // Validate invite code (sharer's user ID)
    const sharer = await prisma.user.findUnique({
      where: { id: inviteCode }
    });

    if (!sharer) {
      return res.status(404).json({
        code: 404,
        message: 'Invalid invite code'
      });
    }

    // Check if invitee has already been invited
    const existingRecord = await prisma.shareRecord.findFirst({
      where: {
        inviteeId
      }
    });

    if (existingRecord) {
      return res.status(400).json({
        code: 400,
        message: 'You have already used an invite code'
      });
    }

    // Check sharer's monthly reward limit
    const startOfMonth = dayjs().startOf('month').toDate();
    const monthlyInvites = await prisma.shareRecord.count({
      where: {
        sharerId: sharer.id,
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    if (monthlyInvites >= MAX_MONTHLY_REWARDS) {
      return res.status(400).json({
        code: 400,
        message: 'Sharer has reached monthly reward limit'
      });
    }

    // Start transaction
    await prisma.$transaction(async (prisma) => {
      // Create share record
      await prisma.shareRecord.create({
        data: {
          sharerId: sharer.id,
          inviteeId,
          rewardDays: REWARD_DAYS
        }
      });

      // Update both users' membership
      for (const userId of [sharer.id, inviteeId]) {
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        const now = new Date();
        const newExpireTime = user.expireTime && user.expireTime > now
          ? dayjs(user.expireTime).add(REWARD_DAYS, 'day').toDate()
          : dayjs().add(REWARD_DAYS, 'day').toDate();

        await prisma.user.update({
          where: { id: userId },
          data: {
            memberType: 1, // 7-day member
            expireTime: newExpireTime
          }
        });

        await prisma.member.create({
          data: {
            userId,
            memberType: 1,
            expireTime: newExpireTime
          }
        });
      }
    });

    const user = await prisma.user.findUnique({
      where: { id: inviteeId }
    });

    res.json({
      code: 0,
      data: {
        reward_days: REWARD_DAYS,
        expire_time: user.expireTime
      }
    });
  } catch (error) {
    console.error('Use invite code error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to use invite code'
    });
  }
};

exports.getShareStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const startOfMonth = dayjs().startOf('month').toDate();

    const [totalInvites, monthInvites] = await Promise.all([
      prisma.shareRecord.count({
        where: { sharerId: userId }
      }),
      prisma.shareRecord.count({
        where: {
          sharerId: userId,
          createdAt: {
            gte: startOfMonth
          }
        }
      })
    ]);

    const totalRewardDays = totalInvites * REWARD_DAYS;
    const monthRemainTimes = Math.max(0, MAX_MONTHLY_REWARDS - monthInvites);

    res.json({
      code: 0,
      data: {
        total_invites: totalInvites,
        month_invites: monthInvites,
        total_reward_days: totalRewardDays,
        month_remain_times: monthRemainTimes
      }
    });
  } catch (error) {
    console.error('Get share stats error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to get share statistics'
    });
  }
}; 