const express = require('express');
const menuController = require('../interfaces/controllers/menu.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { dishSchema, dishPatchSchema } = require('../application/validations/menu.validation');

const router = express.Router();

// Public: View menu
router.get('/', menuController.getAll);
router.get('/:id', menuController.getOne);

// Admin only: Manage menu
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', validate(dishSchema), menuController.add);
router.patch('/:id', validate(dishPatchSchema), menuController.update);
router.delete('/:id', menuController.remove);

module.exports = router;