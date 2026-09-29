const express = require('express');
const authController = require('../interfaces/controllers/auth.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema, updateUserSchema } = require('../application/validations/auth.validation');

const router = express.Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', protect, authController.logout);

// Protected routes
router.use(protect);
router.get('/me', authController.getMe);
router.patch('/update-profile', validate(updateProfileSchema), authController.updateProfile);
router.patch('/update-password', validate(changePasswordSchema), authController.updatePassword);

// Admin only: User management
router.get('/users', restrictTo('admin'), authController.listUsers);
router.patch('/users/:id', restrictTo('admin'), validate(updateUserSchema), authController.updateUser);

// Admin only: Approve/Reject staff
router.patch('/users/:id/status', restrictTo('admin'), authController.updateUserStatus);

module.exports = router;