const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * @description Schema for User accounts (Admin, Staff, & Customer).
 */
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "User must have a name"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "User must have an email"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email"]
    },
    password: {
        type: String,
        required: [true, "User must have a password"],
        minlength: 8,
        select: false
    },
    role: {
        type: String,
        enum: ["admin", "staff", "customer"],
        default: "admin"
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "inactive"],
        default: "approved"
        // default: function() {
        //     return this.role === "admin" || this.role === "customer" ? "approved" : "pending";
        // }
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    phone: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        trim: true
    },
    version: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

userSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
