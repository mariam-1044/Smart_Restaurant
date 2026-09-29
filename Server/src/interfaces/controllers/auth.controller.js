const jwt = require("jsonwebtoken");
const User = require("../../domain/models/User");
const authService = require("../../application/services/auth.service");
const logger = require("../../infrastructure/config/logger");

const signToken = (id, version) => {
    return jwt.sign({ id, version }, process.env.JWT_SECRET || "super-secret-key", {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    });
};

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id, user.tokenVersion);
    user.password = undefined;

    res.status(statusCode).json({
        success: true,
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            },
            token
        }
    });
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const userRole = role || 'customer';

        const newUser = await User.create({
            name,
            email,
            password,
            role: userRole,
            status: (userRole === 'admin' || userRole === 'customer') ? 'approved' : 'pending'
        });

        res.status(201).json({
            success: true,
            message: "Registration successful. Please proceed to login."
        });
    } catch (error) {
        logger.error(`Register Error: ${error.message}`);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Please provide email and password" });
        }

        const user = await User.findOne({ email }).select("+password");

        if (!user || !(await user.correctPassword(password, user.password))) {
            return res.status(401).json({ success: false, message: "Invalid email or password. Please try again." });
        }

        if (user.status !== "approved") {
            return res.status(403).json({
                success: false,
                message: `Your account status is ${user.status}. Please contact the administrator.`
            });
        }

        createSendToken(user, 200, res);
    } catch (error) {
        logger.error(`Login Error: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        if (req.user && req.user.id) {
            await User.findByIdAndUpdate(req.user.id, { $inc: { tokenVersion: 1 } });
        }
        res.status(200).json({
            success: true,
            message: "Logged out successfully."
        });
    } catch (error) {
        logger.error(`Logout Error: ${error.message}`);
        res.status(500).json({ success: false, message: "Error during logout" });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!["approved", "rejected", "active", "inactive"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        // Optimistic concurrency. See spec FR-035 and research.md Decision 1.
        const expectedVersion = req.body.__version;
        const updateData = { status };
        const result = await User.findOneAndUpdate(
            { _id: req.params.id, version: expectedVersion },
            { $set: updateData, $inc: { version: 1 } },
            { new: true }
        );
        if (!result) {
            const fresh = await User.findById(req.params.id).select('version');
            return res.status(409).json({
                success: false,
                errorType: 'VERSION_CONFLICT',
                message: 'This record was changed by another admin. Please refresh to see the latest version.',
                currentVersion: fresh ? fresh.version : null
            });
        }
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.listUsers = async (req, res, next) => {
    try {
        const users = await User.find({}, 'name email role status createdAt version').sort({ createdAt: -1 }).lean();
        res.json({ success: true, data: users });
    } catch (e) { next(e); }
};

exports.updateUser = async (req, res, next) => {
    try {
        const expectedVersion = req.body.__version;
        const updates = {};
        if (req.body.role !== undefined) updates.role = req.body.role;
        if (req.body.status !== undefined) updates.status = req.body.status;
        const updated = await User.findOneAndUpdate(
            { _id: req.params.id, version: expectedVersion },
            { $set: updates, $inc: { version: 1 } },
            { new: true }
        );
        if (!updated) {
            const fresh = await User.findById(req.params.id).select('version');
            return res.status(409).json({
                success: false,
                errorType: 'VERSION_CONFLICT',
                message: 'This record was changed by another admin. Please refresh to see the latest version.',
                currentVersion: fresh ? fresh.version : null
            });
        }
        res.json({ success: true, data: updated });
    } catch (e) { next(e); }
};

exports.updateProfile = async (req, res) => {
    try {
        const { email, ...rest } = req.body;
        if (email !== undefined) {
            const current = String(req.user.email || '').trim().toLowerCase();
            const incoming = String(email).trim().toLowerCase();
            if (incoming !== current) {
                return res.status(400).json({
                    success: false,
                    message: 'email changes require the email-verification flow (not yet available)'
                });
            }
        }
        const updated = await authService.updateProfile(req.user._id, rest);
        return res.status(200).json({ success: true, data: { user: updated } });
    } catch (err) {
        logger.error(`updateProfile Error: ${err.message}`);
        return res.status(500).json({ success: false, message: 'Error updating profile' });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Both currentPassword and newPassword are required',
                violations: []
            });
        }

        const violations = [];
        if (newPassword.length < 8) violations.push('min_length');
        if (!/[A-Za-z]/.test(newPassword)) violations.push('missing_letter');
        if (!/[0-9]/.test(newPassword)) violations.push('missing_digit');

        if (violations.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'password policy violation',
                violations
            });
        }

        const result = await authService.updatePassword(req.user._id, currentPassword, newPassword);

        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        if (err && err.code === 'current_password_incorrect') {
            return res.status(401).json({
                success: false,
                message: 'current password incorrect'
            });
        }
        if (err && err.code === 'same_as_current') {
            return res.status(400).json({
                success: false,
                message: 'password policy violation',
                violations: ['same_as_current']
            });
        }
        if (err && err.code === 'user_not_found') {
            return res.status(401).json({
                success: false,
                message: 'Authentication error'
            });
        }
        logger.error(`updatePassword Error: ${err.message}`);
        return res.status(500).json({ success: false, message: 'Error updating password' });
    }
};