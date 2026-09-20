import userRepository from '../repositories/userRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import charityRepository from '../repositories/charityRepository.js';
import AppError from '../utils/AppError.js';

export const userService = {
  async me(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound('Account not found.', 'USER_NOT_FOUND');
    const charity = user.charity_id ? await charityRepository.findById(user.charity_id) : null;
    return { ...user, charity };
  },

  async updateProfile(userId, data) {
    return userRepository.updateProfile(userId, data);
  },

  async adminList(filters) {
    const { rows, total } = await userRepository.list(filters);
    return { users: rows, total };
  },

  async setStatus(userId, status, actor) {
    const updated = await userRepository.setStatus(userId, status);
    if (!updated) throw AppError.notFound('Account not found.', 'USER_NOT_FOUND');
    await auditRepository.record({
      actorId: actor.id, actorEmail: actor.email,
      action: 'user.status', entityType: 'user', entityId: userId,
      metadata: { status },
    });
    return updated;
  },
};

export default userService;
