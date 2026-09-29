const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { listSchema, idParamSchema } = require('../application/validations/notification.validation');
const ctrl = require('../interfaces/controllers/notification.controller');

router.use(protect);
router.use(restrictTo('admin', 'staff'));

router.get('/',                                                    ctrl.list);
router.get('/unread-count',                                        ctrl.unreadCount);
router.patch('/read-all',                                          ctrl.markAllRead);
router.patch('/:id/read',                                          validate(idParamSchema, 'params'), ctrl.markRead);

module.exports = router;