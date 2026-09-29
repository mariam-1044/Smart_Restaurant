const Joi = require('joi');
const listSchema = Joi.object({
  before: Joi.date().iso().optional(),
  limit:  Joi.number().integer().min(1).max(50).default(20)
});
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required()
});
module.exports = { listSchema, idParamSchema };