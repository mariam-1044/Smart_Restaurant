const User = require('../../domain/models/User');
const bcrypt = require('bcryptjs');

class AuthService {
    async updateProfile(userId, fields) {
        const allowed = {};
        if (fields.name !== undefined) allowed.name = fields.name;
        if (fields.phone !== undefined) allowed.phone = fields.phone;
        if (fields.avatar !== undefined) allowed.avatar = fields.avatar;

        const updated = await User.findByIdAndUpdate(
            userId,
            { $set: allowed },
            { new: true, runValidators: true }
        ).select('-password');
        return updated;
    }

    async updatePassword(userId, currentPassword, newPassword) {
        const user = await User.findById(userId).select('+password');
        if (!user) {
            throw { code: 'user_not_found' };
        }

        const ok = await user.correctPassword(currentPassword, user.password);
        if (!ok) {
            throw { code: 'current_password_incorrect' };
        }

        if (currentPassword === newPassword) {
            throw { code: 'same_as_current' };
        }

        user.password = newPassword;
        await user.save();
        return { success: true };
    }
}

module.exports = new AuthService();