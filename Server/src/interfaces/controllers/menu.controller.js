const menuService = require('../../application/services/menu.service');
const logger = require('../../infrastructure/config/logger');

exports.getAll = async (req, res) => {
    const { search, category } = req.query;
    try {
        const dishes = await menuService.getAll({ search, category });
        res.status(200).json({ success: true, count: dishes.length, data: dishes });
    } catch (error) {
        logger.error(`Menu getAll Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching menu', error: error.message });
    }
};

exports.getOne = async (req, res) => {
    try {
        const dish = await menuService.getById(req.params.id);
        if (!dish) {
            return res.status(404).json({ success: false, message: 'Dish not found' });
        }
        res.status(200).json({ success: true, data: dish });
    } catch (error) {
        logger.error(`Menu getOne Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching dish', error: error.message });
    }
};

exports.add = async (req, res) => {
    try {
        if (req.user.role === 'customer') {
            return res.status(403).json({ success: false, message: 'Customers cannot create dishes' });
        }

        const dishData = { ...req.body, version: 0, priceHistory: [] };
        if (dishData.price) {
            dishData.priceHistory = [{ price: dishData.price, changedAt: new Date(), changedBy: req.user?._id ?? null }];
        }
        const dish = await menuService.create(dishData);
        res.status(201).json({ success: true, data: dish });
    } catch (error) {
        logger.error(`Menu add Error: ${error.message}`);
        res.status(400).json({ success: false, message: 'Error creating dish', error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        if (req.user.role === 'customer') {
            return res.status(403).json({ success: false, message: 'Customers cannot update dishes' });
        }

        const expectedVersion = req.body.__version;
        const changes = { ...req.body };
        delete changes.__version;

        let priceEntry = null;
        if (changes.price !== undefined) {
            priceEntry = { price: changes.price, changedAt: new Date(), changedBy: req.user?._id ?? null };
            delete changes.price;
        }

        const result = await menuService.updateWithVersion(req.params.id, expectedVersion, changes, priceEntry);

        if (result.notFound) {
            return res.status(404).json({ success: false, message: 'Dish not found' });
        }
        if (result.conflict) {
            return res.status(409).json({
                success: false,
                errorType: 'VERSION_CONFLICT',
                message: 'This record was changed by another admin. Please refresh to see the latest version.',
                currentVersion: result.currentVersion
            });
        }
        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        logger.error(`Menu update Error: ${error.message}`);
        res.status(400).json({ success: false, message: 'Error updating dish', error: error.message });
    }
};

exports.remove = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only admins can delete dishes' });
        }

        const expectedVersion = req.body.__version;
        const result = await menuService.removeWithVersion(req.params.id, expectedVersion);

        if (result.notFound) {
            return res.status(404).json({ success: false, message: 'Dish not found' });
        }
        if (result.conflict) {
            return res.status(409).json({
                success: false,
                errorType: 'VERSION_CONFLICT',
                message: 'This record was changed by another admin. Please refresh to see the latest version.',
                currentVersion: result.currentVersion
            });
        }
        res.status(200).json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        logger.error(`Menu remove Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error deleting dish', error: error.message });
    }
};