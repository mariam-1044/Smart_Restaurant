const inventoryService = require("../../application/services/inventory.service");
const { toCsv } = require("../../infrastructure/csv/rfc4180");
const logger = require("../../infrastructure/config/logger");

exports.getAll = async (req, res) => {
    try {
        const ingredients = await inventoryService.getAllIngredients(req.query);
        res.status(200).json({ success: true, count: ingredients.length, data: ingredients });
    } catch (error) {
        logger.error(`Inventory getAll Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching ingredients', error: error.message });
    }
};

exports.getOne = async (req, res) => {
    try {
        const ingredient = await inventoryService.getById(req.params.id);
        if (!ingredient) {
            return res.status(404).json({ success: false, message: 'Ingredient not found' });
        }
        res.status(200).json({ success: true, data: ingredient });
    } catch (error) {
        logger.error(`Inventory getOne Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching ingredient', error: error.message });
    }
};

exports.add = async (req, res) => {
    try {
        const ingredient = await inventoryService.createIngredient(req.body);
        res.status(201).json({ success: true, data: ingredient });
    } catch (error) {
        logger.error(`Inventory add Error: ${error.message}`);
        res.status(400).json({ success: false, message: 'Error creating ingredient', error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const ingredient = await inventoryService.updateIngredient(req.params.id, req.body);
        if (!ingredient) {
            return res.status(404).json({ success: false, message: 'Ingredient not found' });
        }
        res.status(200).json({ success: true, data: ingredient });
    } catch (error) {
        logger.error(`Inventory update Error: ${error.message}`);
        res.status(400).json({ success: false, message: 'Error updating ingredient', error: error.message });
    }
};

exports.remove = async (req, res) => {
    try {
        const ingredient = await inventoryService.deleteIngredient(req.params.id);
        if (!ingredient) {
            return res.status(404).json({ success: false, message: 'Ingredient not found' });
        }
        res.status(200).json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        logger.error(`Inventory remove Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error deleting ingredient', error: error.message });
    }
};

exports.lowStock = async (req, res) => {
    try {
        const ingredients = await inventoryService.getLowStockIngredients();
        res.status(200).json({ success: true, count: ingredients.length, data: ingredients });
    } catch (error) {
        logger.error(`Inventory lowStock Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching low stock items', error: error.message });
    }
};

exports.expired = async (req, res) => {
    try {
        const ingredients = await inventoryService.getExpiredIngredients();
        res.status(200).json({ success: true, count: ingredients.length, data: ingredients });
    } catch (error) {
        logger.error(`Inventory expired Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching expired items', error: error.message });
    }
};

exports.nearExpiry = async (req, res) => {
    try {
        const days = req.query.days || 3;
        const ingredients = await inventoryService.getNearExpiryIngredients(days);
        const data = ingredients.map(i => {
            const obj = i.toObject ? i.toObject() : i;
            const diffMs = new Date(obj.expiryDate) - new Date();
            obj.daysUntilExpiry = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            return obj;
        });
        res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        logger.error(`Inventory nearExpiry Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching near expiry items', error: error.message });
    }
};

exports.alerts = async (req, res) => {
    try {
        const alerts = await inventoryService.getInventoryAlerts();
        res.status(200).json({ success: true, data: alerts });
    } catch (error) {
        logger.error(`Inventory alerts Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error fetching inventory alerts', error: error.message });
    }
};

exports.exportCsv = async (req, res) => {
    try {
        const isFiltered = req.query.filtered === 'true';

        let items;
        if (isFiltered) {
            const filterQuery = { ...req.query };
            delete filterQuery.filtered;
            delete filterQuery.page;
            delete filterQuery.limit;
            items = await inventoryService.getAllIngredients(filterQuery);
        } else {
            const { filtered, page, limit, ...exportParams } = req.query;
            items = await inventoryService.exportRows(exportParams);
        }

        const headers = ['name', 'quantity', 'unit', 'minStock', 'costPerUnit', 'expiryDate', 'wasteQuantity'];
        const dataRows = items.map(i => [
            i.name,
            i.quantity,
            i.unit,
            i.minStock,
            i.costPerUnit,
            i.expiryDate ? new Date(i.expiryDate).toISOString().slice(0, 10) : '',
            i.wasteQuantity
        ]);
        const csvBody = toCsv(headers, dataRows);

        const dateStr = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="inventory-${dateStr}.csv"`);
        res.status(200).send(csvBody);
    } catch (error) {
        logger.error(`Inventory exportCsv Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error exporting inventory', error: error.message });
    }
};
