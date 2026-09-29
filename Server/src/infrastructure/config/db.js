const mongoose = require("mongoose");
const logger = require('./logger');


module.exports = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart-restaurant";
        
        mongoose.set('strictQuery', false);
        
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
        
        console.log("MongoDB Connected Successfully");
        logger.info("MongoDB Connected Successfully");
    } catch (error) {
        console.error("MongoDB Connection Failed:", error.message);
        logger.error(`MongoDB Connection Error: ${error.message}`);
        
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};
