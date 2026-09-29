const Dish = require('../../domain/models/Dish');

class MenuService {
    async getAll({ search, category } = {}) {
        const filter = {};
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }
        if (category) {
            filter.category = category;
        }
        return await Dish.find(filter).populate('ingredients.ingredient');
    }

    async getById(id) {
        return await Dish.findById(id).populate('ingredients.ingredient');
    }

    async create(data) {
        return await Dish.create(data);
    }

    async update(id, data) {
        return await Dish.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }

    async updateWithVersion(id, expectedVersion, changes, priceEntry) {
        const currentDish = await Dish.findById(id);
        if (!currentDish) return { notFound: true };

        const updateDoc = { $set: changes, $inc: { version: 1 } };
        if (priceEntry) {
            updateDoc.$push = { priceHistory: { $each: [priceEntry], $slice: -10 } };
        }

        const result = await Dish.findOneAndUpdate(
            { _id: id, version: expectedVersion },
            updateDoc,
            { new: true }
        );
        if (!result) {
            const fresh = await Dish.findById(id).select('version');
            return { conflict: true, currentVersion: fresh ? fresh.version : null };
        }
        return { ok: true, data: result };
    }

    async removeWithVersion(id, expectedVersion) {
        const result = await Dish.findOneAndDelete({ _id: id, version: expectedVersion });
        if (!result) {
            const fresh = await Dish.findById(id).select('version');
            if (!fresh) return { notFound: true };
            return { conflict: true, currentVersion: fresh.version };
        }
        return { ok: true };
    }

    async remove(id) {
        return await Dish.findByIdAndDelete(id);
    }
}

module.exports = new MenuService();